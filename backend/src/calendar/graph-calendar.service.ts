import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';
import { RoomsService } from '../rooms/rooms.service';
import { parseGraphDateTime, intervalsOverlap } from '../common/graph-datetime.util';

interface CacheEntry {
  status: RoomStatus;
  expires: number;
}

/** Outlook category stamped on kiosk-created events so we only ever mutate our own. */
const KIOSK_CATEGORY = 'MeetingRoomKiosk';

@Injectable()
export class GraphCalendarService extends CalendarService {
  private readonly logger = new Logger(GraphCalendarService.name);
  private graphClient: Client;

  /** Manual delegated token (POC fallback / admin override). */
  private currentToken: string;

  /** MSAL client for the app-only (client-credentials) flow — null in POC mode. */
  private readonly msalClient: ConfidentialClientApplication | null;

  /** Short-lived per-room status cache to smooth out kiosk + admin poll bursts. */
  private readonly statusCache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = Number(process.env.STATUS_CACHE_TTL_MS ?? 5000);

  constructor(private readonly roomsService: RoomsService) {
    super();
    this.currentToken = process.env.GRAPH_TEMP_TOKEN ?? '';
    this.msalClient = this.buildMsalClient();
    this.initClient();
  }

  private buildMsalClient(): ConfidentialClientApplication | null {
    const clientId = process.env.AZURE_CLIENT_ID?.trim();
    const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
    const tenantId = process.env.AZURE_TENANT_ID?.trim();

    if (!clientId || !clientSecret || !tenantId) {
      this.logger.warn(
        'Azure AD app credentials not fully configured — falling back to manual GRAPH_TEMP_TOKEN. ' +
          'Set AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET for automatic token refresh.',
      );
      return null;
    }

    this.logger.log('MSAL client-credentials flow enabled (automatic token refresh).');
    return new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });
  }

  private initClient() {
    // authProvider is invoked per request; MSAL caches and refreshes tokens
    // internally, so there is no need to re-init the client on token swap.
    this.graphClient = Client.init({
      authProvider: (done) => {
        this.getAccessToken()
          .then((token) => done(null, token))
          .catch((err) => done(err, null));
      },
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.msalClient) {
      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });
      if (!result?.accessToken) throw new Error('MSAL token acquisition returned no access token');
      return result.accessToken;
    }
    if (!this.currentToken) {
      throw new Error('No Graph token available (set GRAPH_TEMP_TOKEN or configure Azure AD app).');
    }
    return this.currentToken;
  }

  // Called by AppConfigController when an admin pastes a new manual token.
  override updateToken(token: string): void {
    this.currentToken = token;
    this.statusCache.clear();
    this.logger.log('Manual Graph token updated via admin UI');
  }

  /** Resolve which mailbox to query. Empty calendarEmail → the token user's own calendar (/me). */
  private resolveMailbox(roomId: string): { calendarPath: string; eventsPath: string } {
    const room = this.roomsService.findByIdOrName(roomId);
    const email = room?.calendarEmail?.trim();
    if (email) {
      const u = `/users/${encodeURIComponent(email)}`;
      return { calendarPath: `${u}/calendarView`, eventsPath: `${u}/events` };
    }
    return { calendarPath: '/me/calendarView', eventsPath: '/me/events' };
  }

  /** Retry Graph calls on throttling (429) / transient unavailability (503). */
  private async withGraphRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        const code = err?.statusCode ?? err?.code ?? err?.status;
        if (code !== 429 && code !== 503) throw err;
        lastErr = err;
        const retryAfterHeader = err?.headers?.['retry-after'] ?? err?.headers?.get?.('retry-after');
        const retryAfter = Number(retryAfterHeader);
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** i;
        this.logger.warn(`Graph throttled (${code}); retrying in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastErr;
  }

  private async fetchCalendarView(calendarPath: string, from: Date, to: Date): Promise<any[]> {
    const result = await this.withGraphRetry(() =>
      this.graphClient
        .api(`${calendarPath}?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}`)
        .header('Prefer', 'outlook.timezone="UTC"')
        .get(),
    );
    return result.value ?? [];
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const cached = this.statusCache.get(roomId);
    if (cached && cached.expires > Date.now()) return cached.status;

    try {
      const { calendarPath } = this.resolveMailbox(roomId);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const events = await this.fetchCalendarView(calendarPath, startOfDay, endOfDay);
      const now = new Date();

      const currentEvent = events.find((e: any) => {
        const start = parseGraphDateTime(e.start.dateTime);
        const end = parseGraphDateTime(e.end.dateTime);
        return start <= now && end >= now;
      });

      const dailySchedule = events.map((e: any) => ({
        start: parseGraphDateTime(e.start.dateTime).toISOString(),
        end: parseGraphDateTime(e.end.dateTime).toISOString(),
        title: e.subject || 'Foglalt',
        organizer: e.organizer?.emailAddress?.name || 'Rendszer',
      }));

      const nextEvent = events
        .filter((e: any) => parseGraphDateTime(e.start.dateTime) > now)
        .sort(
          (a: any, b: any) =>
            parseGraphDateTime(a.start.dateTime).getTime() - parseGraphDateTime(b.start.dateTime).getTime(),
        )[0];

      // ── Meeting lifecycle (check-in / manual release / extend) ──
      let occupied = !!currentEvent;
      let effectiveEndISO: string | null = null;
      let currentId: string | null = null;
      let checkedIn = false;
      let checkInRequired = false;
      let autoReleaseAt: string | null = null;

      if (currentEvent) {
        const startISO = parseGraphDateTime(currentEvent.start.dateTime).toISOString();
        const endMs = parseGraphDateTime(currentEvent.end.dateTime).getTime();
        const flags = this.applyLifecycle(roomId, startISO, endMs, now);
        if (!flags) {
          occupied = false; // manually released earlier this session
        } else {
          currentId = currentEvent.id ?? startISO;
          effectiveEndISO = new Date(flags.endMs).toISOString();
          checkedIn = flags.checkedIn;
          checkInRequired = flags.checkInRequired;
          autoReleaseAt = flags.autoReleaseAt;
        }
      }

      const status: RoomStatus = {
        roomId,
        isOccupied: occupied,
        currentMeetingTitle: occupied ? currentEvent.subject : null,
        currentMeetingOrganizer: occupied
          ? currentEvent.organizer?.emailAddress?.name ?? 'Ismeretlen szervező'
          : null,
        currentMeetingEnd: effectiveEndISO,
        nextMeetingStart: nextEvent ? parseGraphDateTime(nextEvent.start.dateTime).toISOString() : null,
        schedule: dailySchedule,
        currentMeetingId: currentId,
        currentMeetingCheckedIn: checkedIn,
        checkInRequired,
        autoReleaseAt,
      };

      this.statusCache.set(roomId, { status, expires: Date.now() + this.cacheTtlMs });
      this.lastGraphOkAt = new Date().toISOString();
      return status;
    } catch (error: any) {
      this.lastGraphErrorAt = new Date().toISOString();
      this.logger.error(`Graph API error in getRoomStatus (${roomId})`, error.body ?? error.message ?? error);
      throw error;
    }
  }

  async bookRoom(
    roomId: string,
    durationMinutes: number,
    organizer: string,
    title?: string,
    startTime?: string,
  ): Promise<boolean> {
    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const subject = title?.trim() ? title.trim() : `Kiosk booking: ${organizer}`;
    const { calendarPath, eventsPath } = this.resolveMailbox(roomId);

    // ── Double-booking guard: reject if the target window already has an event ──
    try {
      const existing = await this.fetchCalendarView(calendarPath, start, end);
      const clash = existing.some((e: any) =>
        intervalsOverlap(parseGraphDateTime(e.start.dateTime), parseGraphDateTime(e.end.dateTime), start, end),
      );
      if (clash) {
        throw new ConflictException('A terem a kért időszakban már foglalt.');
      }
    } catch (error: any) {
      if (error instanceof ConflictException) throw error;
      // A read failure here shouldn't silently allow a blind write. Rethrow the
      // original error so the controller can map an expired-token 401 correctly.
      this.logger.error('Conflict pre-check failed', error.body ?? error.message ?? error);
      throw error;
    }

    const event = {
      subject,
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
      // Marker so we can safely identify (and only ever mutate) kiosk-created events.
      categories: [KIOSK_CATEGORY],
    };

    try {
      const response = await this.withGraphRetry(() => this.graphClient.api(eventsPath).post(event));
      this.logger.log(`Graph event created (${roomId}) id=${response.id}`);
      this.statusCache.delete(roomId);
      return true;
    } catch (error: any) {
      this.logger.error('Graph booking rejected', error.body ?? error.message ?? error);
      throw error; // controller maps 401/403 → 401, others → 5xx
    }
  }

  // ── Meeting lifecycle ────────────────────────────────────────────────────────

  // Graph auto-release stays off: silently hiding an event that still exists in
  // Outlook would let the room be double-booked. No-shows are handled by the
  // manual "release now" button; automatic release needs a scheduled job (see
  // docs/RECOMMENDATIONS.md). Check-in / extend still work.
  protected override autoReleaseEnabled(): boolean {
    return false;
  }

  private isKioskEvent(e: any): boolean {
    return Array.isArray(e?.categories) && e.categories.includes(KIOSK_CATEGORY);
  }

  private async findCurrentEvent(roomId: string, now: Date): Promise<any | null> {
    const { calendarPath } = this.resolveMailbox(roomId);
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
    const events = await this.fetchCalendarView(calendarPath, dayStart, dayEnd);
    return (
      events.find((e: any) => {
        const s = parseGraphDateTime(e.start.dateTime);
        const en = parseGraphDateTime(e.end.dateTime);
        return s <= now && en >= now;
      }) ?? null
    );
  }

  async checkIn(roomId: string): Promise<boolean> {
    const now = new Date();
    const current = await this.findCurrentEvent(roomId, now);
    if (!current) return false;
    this.recordCheckIn(roomId, parseGraphDateTime(current.start.dateTime).toISOString());
    this.statusCache.delete(roomId);
    return true;
  }

  async releaseNow(roomId: string): Promise<boolean> {
    const now = new Date();
    const current = await this.findCurrentEvent(roomId, now);
    if (!current) return false;
    // Only ever delete events this system created — never someone's real meeting.
    if (!this.isKioskEvent(current)) return false;

    const { eventsPath } = this.resolveMailbox(roomId);
    await this.withGraphRetry(() => this.graphClient.api(`${eventsPath}/${current.id}`).delete());
    this.recordRelease(roomId, parseGraphDateTime(current.start.dateTime).toISOString());
    this.statusCache.delete(roomId);
    this.logger.log(`Graph event released (${roomId}) id=${current.id}`);
    return true;
  }

  async extendMeeting(roomId: string, addMinutes: number): Promise<boolean> {
    const now = new Date();
    const current = await this.findCurrentEvent(roomId, now);
    if (!current || !this.isKioskEvent(current)) return false;

    const currentEnd = parseGraphDateTime(current.end.dateTime);
    const newEnd = new Date(currentEnd.getTime() + addMinutes * 60000);

    // Reject the extension if it would collide with the next meeting.
    const { calendarPath, eventsPath } = this.resolveMailbox(roomId);
    const following = await this.fetchCalendarView(calendarPath, currentEnd, newEnd);
    const clash = following.some(
      (e: any) => e.id !== current.id &&
        intervalsOverlap(parseGraphDateTime(e.start.dateTime), parseGraphDateTime(e.end.dateTime), currentEnd, newEnd),
    );
    if (clash) throw new ConflictException('A hosszabbítás ütközik a következő foglalással.');

    await this.withGraphRetry(() =>
      this.graphClient.api(`${eventsPath}/${current.id}`).patch({
        end: { dateTime: newEnd.toISOString(), timeZone: 'UTC' },
      }),
    );
    this.statusCache.delete(roomId);
    this.logger.log(`Graph event extended (${roomId}) id=${current.id} +${addMinutes}min`);
    return true;
  }
}

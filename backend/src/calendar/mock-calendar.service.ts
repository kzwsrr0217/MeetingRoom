import { Injectable, ConflictException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { RoomStatus } from './domain/room-status.model';
import { intervalsOverlap } from '../common/graph-datetime.util';

interface ActiveBooking {
  start: Date;
  end: Date;
  title: string;
  organizer: string;
  private: boolean;
}

const PRIVATE_TITLE = 'Privát megbeszélés';

type ScheduleEntry = { start: string; end: string; title: string; organizer: string };

// Normalise so both the display name ("MMH Séd") and the slug id ("mmh-sed")
// match the demo keywords ("sed", "balaton", "mars").
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

@Injectable()
export class MockCalendarService extends CalendarService {
  // In-memory store: bookings made via the kiosk persist until they expire
  private readonly activeBookings = new Map<string, ActiveBooking>();

  protected override autoReleaseEnabled(): boolean {
    // Default ON for the demo — only kiosk bookings are lifecycle-managed anyway.
    return process.env.AUTO_RELEASE?.trim() !== 'false';
  }

  // Fixed daily schedule per room for demo purposes (relative to today)
  private getSimulatedSchedule(roomId: string): ScheduleEntry[] {
    const at = (h: number, m = 0): string => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    if (norm(roomId).includes('balaton')) {
      return [
        { start: at(8, 0),  end: at(9, 0),  title: 'Vezetőségi értekezlet',  organizer: 'Dr. Kovács István' },
        { start: at(10, 0), end: at(11, 30), title: 'Q2 Tervezési megbeszélés', organizer: 'Szabó Péter' },
        { start: at(13, 30), end: at(14, 30), title: 'Ügyfél bemutató',        organizer: 'Horváth Kata' },
        { start: at(15, 0), end: at(16, 30), title: 'Sprint Review',           organizer: 'Dr. Kovács István' },
      ];
    }
    if (norm(roomId).includes('mars')) {
      return [
        { start: at(15, 0), end: at(17, 0), title: 'Mars Colonization Sync', organizer: 'Elon M. (SpaceX)' },
      ];
    }
    if (norm(roomId).includes('sed')) {
      return [
        { start: at(8,  0), end: at(9,  0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(10, 0), end: at(11, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(12, 0), end: at(13, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(14, 0), end: at(15, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
        { start: at(16, 0), end: at(17, 0), title: 'Heti Séd-Review', organizer: 'Nagy Anna' },
      ];
    }
    return [];
  }

  /** The live kiosk booking for a room, if it exists and hasn't expired. */
  private currentActiveBooking(roomId: string, now: Date): ActiveBooking | null {
    const booking = this.activeBookings.get(roomId);
    if (booking && booking.end <= now) {
      this.activeBookings.delete(roomId);
      return null;
    }
    return booking && booking.start <= now ? booking : null;
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const now = new Date();
    const currentHour = now.getHours();

    const pendingRaw = this.activeBookings.get(roomId) ?? null;
    if (pendingRaw && pendingRaw.end <= now) this.activeBookings.delete(roomId);
    const pending = this.activeBookings.get(roomId) ?? null;
    const current = pending && pending.start <= now ? pending : null;

    // ── A live kiosk booking is running → apply check-in / release / extend ──
    if (current) {
      const startISO = current.start.toISOString();
      const flags = this.applyLifecycle(roomId, startISO, current.end.getTime(), now);

      if (flags) {
        const effectiveEnd = new Date(flags.endMs).toISOString();
        const shownTitle = current.private ? PRIVATE_TITLE : current.title;
        const shownOrganizer = current.private ? null : current.organizer;
        const simulated = this.getSimulatedSchedule(roomId);
        const merged = [
          { start: startISO, end: effectiveEnd, title: shownTitle, organizer: shownOrganizer ?? '', },
          ...simulated.filter(e => e.start !== startISO),
        ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        return {
          roomId,
          isOccupied: true,
          currentMeetingTitle: shownTitle,
          currentMeetingOrganizer: shownOrganizer,
          currentMeetingEnd: effectiveEnd,
          nextMeetingStart: null,
          schedule: merged,
          currentMeetingId: startISO,
          currentMeetingCheckedIn: flags.checkedIn,
          checkInRequired: flags.checkInRequired,
          autoReleaseAt: flags.autoReleaseAt,
          currentMeetingPrivate: current.private,
        };
      }
      // Released / no-show → drop the booking and fall through to "free"
      this.activeBookings.delete(roomId);
    }

    // ── Time-based backdrop simulation (room-specific) ──
    let isOccupied = false;
    let title: string | null = null;
    let organizer: string | null = null;

    if (norm(roomId).includes('balaton')) {
      isOccupied = true;
      title = 'Vezetőségi értekezlet';
      organizer = 'Dr. Kovács István';
    } else if (norm(roomId).includes('mars')) {
      isOccupied = currentHour > 14;
      title = 'Mars Colonization Sync';
      organizer = 'Elon M. (SpaceX)';
    } else if (norm(roomId).includes('sed')) {
      isOccupied = currentHour % 2 === 0;
      title = 'Heti Séd-Review';
      organizer = 'Nagy Anna';
    }

    const hourEnd = new Date(now);
    hourEnd.setHours(currentHour + 1, 0, 0, 0);

    const simulated = this.getSimulatedSchedule(roomId);
    const schedule = pending
      ? [
          ...simulated.filter(e => e.start !== pending.start.toISOString()),
          { start: pending.start.toISOString(), end: pending.end.toISOString(), title: pending.title, organizer: pending.organizer },
        ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      : simulated;

    return {
      roomId,
      isOccupied,
      currentMeetingTitle: isOccupied ? title : null,
      currentMeetingOrganizer: isOccupied ? organizer : null,
      currentMeetingEnd: isOccupied ? hourEnd.toISOString() : null,
      nextMeetingStart: isOccupied ? null : (pending ? pending.start.toISOString() : hourEnd.toISOString()),
      schedule,
      currentMeetingId: null,
      currentMeetingCheckedIn: false,
      checkInRequired: false,
      autoReleaseAt: null,
    };
  }

  async bookRoom(
    roomId: string,
    durationMinutes: number,
    organizer: string,
    title?: string,
    startTime?: string,
    isPrivate?: boolean,
  ): Promise<boolean> {
    const start = startTime ? new Date(startTime) : new Date();
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const resolvedTitle = title?.trim() || `Gyors foglalás (${durationMinutes} perc)`;

    // Double-booking guard: reject if a live (non-expired) kiosk booking overlaps.
    const existing = this.activeBookings.get(roomId);
    if (existing && existing.end > new Date() && intervalsOverlap(existing.start, existing.end, start, end)) {
      throw new ConflictException('A terem a kért időszakban már foglalt.');
    }

    this.activeBookings.set(roomId, { start, end, title: resolvedTitle, organizer, private: !!isPrivate });

    console.log(
      `[Mock] Foglalás rögzítve: ${roomId} | ${resolvedTitle} | Kezdés: ${start.toLocaleTimeString('hu-HU')} | Vége: ${end.toLocaleTimeString('hu-HU')} | Szervező: ${organizer}`,
    );
    return true;
  }

  async checkIn(roomId: string): Promise<boolean> {
    const now = new Date();
    const current = this.currentActiveBooking(roomId, now);
    if (!current) return false;
    this.recordCheckIn(roomId, current.start.toISOString());
    return true;
  }

  async releaseNow(roomId: string): Promise<boolean> {
    const now = new Date();
    const current = this.currentActiveBooking(roomId, now);
    if (!current) return false;
    this.recordRelease(roomId, current.start.toISOString());
    this.activeBookings.delete(roomId);
    return true;
  }

  async extendMeeting(roomId: string, addMinutes: number): Promise<boolean> {
    const now = new Date();
    const current = this.currentActiveBooking(roomId, now);
    if (!current) return false;
    // Mock owns the booking object, so just move its end (no extension overlay).
    current.end = new Date(current.end.getTime() + addMinutes * 60000);
    return true;
  }
}

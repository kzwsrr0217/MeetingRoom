import { RoomStatus } from './domain/room-status.model';

export interface LifecycleFlags {
  /** Effective end time in ms (includes any granted extension). */
  endMs: number;
  checkedIn: boolean;
  checkInRequired: boolean;
  autoReleaseAt: string | null;
}

/**
 * Base calendar service. Holds the in-memory meeting-lifecycle state shared by
 * both the mock and Graph implementations: check-ins, manual releases, and
 * granted extensions. Subclasses decide what "release"/"extend" mean against
 * their store (mock map vs. real Outlook events).
 */
export abstract class CalendarService {
  private readonly checkedIn = new Map<string, string>();      // roomId -> checked-in meeting start ISO
  private readonly released = new Set<string>();               // `${roomId}|${startISO}`
  private readonly extraMinutes = new Map<string, number>();   // `${roomId}|${startISO}` -> minutes

  /** Grace window after start before an unconfirmed meeting is a no-show. */
  protected readonly graceMs = Number(process.env.CHECKIN_GRACE_MIN ?? 10) * 60000;

  abstract getRoomStatus(roomId: string): Promise<RoomStatus>;
  abstract bookRoom(roomId: string, durationMinutes: number, organizer: string, title?: string, startTime?: string, isPrivate?: boolean): Promise<boolean>;

  /** Check in to the room's current meeting. Returns false if nothing is running. */
  abstract checkIn(roomId: string): Promise<boolean>;
  /** End the room's current meeting immediately. Returns false if nothing is running. */
  abstract releaseNow(roomId: string): Promise<boolean>;
  /** Extend the current meeting by N minutes if the slot is free. */
  abstract extendMeeting(roomId: string, addMinutes: number): Promise<boolean>;

  // No-op in mock mode; GraphCalendarService overrides to re-init the Graph client
  updateToken(_token: string): void {}

  // ── Diagnostics for /health (readiness) — updated without extra Graph calls ──
  protected lastGraphOkAt: string | null = null;
  protected lastGraphErrorAt: string | null = null;

  getDiagnostics(): { lastOkAt: string | null; lastErrorAt: string | null } {
    return { lastOkAt: this.lastGraphOkAt, lastErrorAt: this.lastGraphErrorAt };
  }

  // ── Shared lifecycle state helpers ──────────────────────────────────────────

  private key(roomId: string, startISO: string): string {
    return `${roomId}|${startISO}`;
  }

  protected recordCheckIn(roomId: string, startISO: string): void {
    this.checkedIn.set(roomId, startISO);
  }
  protected isCheckedIn(roomId: string, startISO: string): boolean {
    return this.checkedIn.get(roomId) === startISO;
  }
  protected recordRelease(roomId: string, startISO: string): void {
    this.released.add(this.key(roomId, startISO));
  }
  protected isReleased(roomId: string, startISO: string): boolean {
    return this.released.has(this.key(roomId, startISO));
  }
  protected recordExtension(roomId: string, startISO: string, minutes: number): void {
    const k = this.key(roomId, startISO);
    this.extraMinutes.set(k, (this.extraMinutes.get(k) ?? 0) + minutes);
  }
  protected extensionMs(roomId: string, startISO: string): number {
    return (this.extraMinutes.get(this.key(roomId, startISO)) ?? 0) * 60000;
  }

  /** Whether no-show meetings are auto-released. Override per implementation. */
  protected autoReleaseEnabled(): boolean {
    return true;
  }

  /**
   * Apply lifecycle state to a meeting. Returns null when the meeting should be
   * treated as free (manually released, or an auto-released no-show); otherwise
   * returns the effective end + check-in flags.
   */
  protected applyLifecycle(roomId: string, startISO: string, endMs: number, now: Date): LifecycleFlags | null {
    if (this.isReleased(roomId, startISO)) return null;

    const checkedIn = this.isCheckedIn(roomId, startISO);
    const deadline = new Date(startISO).getTime() + this.graceMs;

    if (!checkedIn && now.getTime() > deadline && this.autoReleaseEnabled()) {
      this.recordRelease(roomId, startISO);
      return null;
    }

    return {
      endMs: endMs + this.extensionMs(roomId, startISO),
      checkedIn,
      checkInRequired: !checkedIn && now.getTime() <= deadline,
      autoReleaseAt: checkedIn ? null : new Date(deadline).toISOString(),
    };
  }
}

export class RoomStatus {
  roomId: string;
  isOccupied: boolean;
  currentMeetingTitle: string | null;
  currentMeetingOrganizer: string | null;
  currentMeetingEnd: string | null;
  nextMeetingStart: string | null;
  schedule: { start: string; end: string; title: string; organizer: string }[];

  // ── Meeting lifecycle (check-in / no-show / release / extend) ──────────────
  /** Stable id of the current meeting (ISO start for mock, event id for Graph). */
  currentMeetingId?: string | null;
  /** True once someone has checked in to the current meeting. */
  currentMeetingCheckedIn?: boolean;
  /** True while the current meeting is running, unconfirmed, and within grace. */
  checkInRequired?: boolean;
  /** When an unconfirmed meeting will be auto-released as a no-show (ISO), or null. */
  autoReleaseAt?: string | null;
  /** True when the current meeting is private — title/organiser are masked. */
  currentMeetingPrivate?: boolean;
}

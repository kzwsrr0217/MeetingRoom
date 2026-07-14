/**
 * Parse a Microsoft Graph `dateTime` string as UTC.
 *
 * When a request sends `Prefer: outlook.timezone="UTC"`, Graph returns the
 * `dateTime` WITHOUT a trailing `Z` (e.g. `2026-07-14T08:00:00.0000000`) and
 * reports the zone separately in `timeZone`. `new Date(...)` would then treat
 * the value as **local** time, shifting every meeting by the host's UTC offset.
 *
 * This helper appends `Z` when the string carries no explicit zone, so the
 * value is always interpreted as UTC.
 */
export function parseGraphDateTime(dateTime: string): Date {
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateTime);
  return new Date(hasZone ? dateTime : `${dateTime}Z`);
}

/** Two [start,end) intervals overlap when each starts before the other ends. */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

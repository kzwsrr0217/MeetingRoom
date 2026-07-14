import { parseGraphDateTime, intervalsOverlap } from './graph-datetime.util';

describe('parseGraphDateTime', () => {
  it('treats a zone-less Graph dateTime as UTC (not local)', () => {
    // Graph returns this shape with Prefer: outlook.timezone="UTC"
    const d = parseGraphDateTime('2026-07-14T08:00:00.0000000');
    expect(d.toISOString()).toBe('2026-07-14T08:00:00.000Z');
  });

  it('respects an explicit Z suffix', () => {
    const d = parseGraphDateTime('2026-07-14T08:00:00Z');
    expect(d.toISOString()).toBe('2026-07-14T08:00:00.000Z');
  });

  it('respects an explicit numeric offset', () => {
    const d = parseGraphDateTime('2026-07-14T10:00:00+02:00');
    expect(d.toISOString()).toBe('2026-07-14T08:00:00.000Z');
  });
});

describe('intervalsOverlap', () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 1, h, m));

  it('detects overlapping intervals', () => {
    expect(intervalsOverlap(at(9), at(10), at(9, 30), at(10, 30))).toBe(true);
  });

  it('treats touching intervals as non-overlapping (end == start)', () => {
    expect(intervalsOverlap(at(9), at(10), at(10), at(11))).toBe(false);
  });

  it('detects fully disjoint intervals', () => {
    expect(intervalsOverlap(at(9), at(10), at(11), at(12))).toBe(false);
  });
});

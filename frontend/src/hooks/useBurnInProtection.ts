import { useState, useEffect } from 'react';

// Cycle through 1px offsets so no pixel shows the same colour for long — protects
// always-on LCD/OLED panels from image retention.
const OFFSETS: [number, number][] = [
  [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const SHIFT_INTERVAL_MS = 45_000;

// Office hours: outside this window the panel dims to save power and reduce burn-in.
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;

export interface BurnInStyle {
  /** CSS transform for a 1px shift. */
  transform: string;
  /** 0 during office hours, up to ~0.55 at night — apply as a black overlay opacity. */
  nightDim: number;
}

export const useBurnInProtection = (): BurnInStyle => {
  const [idx, setIdx] = useState(0);
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const shift = setInterval(() => setIdx(i => (i + 1) % OFFSETS.length), SHIFT_INTERVAL_MS);
    const clock = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => { clearInterval(shift); clearInterval(clock); };
  }, []);

  const [dx, dy] = OFFSETS[idx];
  const isNight = hour < DAY_START_HOUR || hour >= DAY_END_HOUR;

  return {
    transform: `translate(${dx}px, ${dy}px)`,
    nightDim: isNight ? 0.55 : 0,
  };
};

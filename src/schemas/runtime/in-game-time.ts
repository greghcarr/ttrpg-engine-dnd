import { z } from 'zod';

export const InGameTimeSchema = z.object({
  totalMinutes: z.number().int().min(0).default(0),
});
export type InGameTime = z.infer<typeof InGameTimeSchema>;

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

export interface InGameClockBreakdown {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
}

export const breakdownInGameTime = (time: InGameTime): InGameClockBreakdown => ({
  days: Math.floor(time.totalMinutes / MINUTES_PER_DAY),
  hours: Math.floor((time.totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
  minutes: time.totalMinutes % MINUTES_PER_HOUR,
});

export const formatInGameTime = (time: InGameTime): string => {
  const { days, hours, minutes } = breakdownInGameTime(time);
  const dd = String(days).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `Day ${dd} ${hh}:${mm}`;
};

export const advanceInGameTime = (time: InGameTime, minutes: number): InGameTime => {
  if (minutes < 0) throw new Error('Cannot advance in-game time by a negative amount');
  return { totalMinutes: time.totalMinutes + minutes };
};

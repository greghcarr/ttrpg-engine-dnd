// Spell-duration string parser.
//
// PHB 2024 spell duration strings are short, predictable, and worded
// consistently. We don't need a real grammar; a handful of patterns
// covers every spell in the book. Anything we don't recognise returns
// `undefined` and the engine treats the effect as never-expiring (which
// matches "Until dispelled" and is the safest default for unknown
// shapes — better than spuriously clearing a buff at minute 1).

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;
const ROUND_MINUTES = 1; // a 6-second round rounds up to one minute for time-tracking purposes.

/**
 * Returns the duration of a spell in in-game minutes, or `undefined` for
 * spells with no fixed expiry (Instantaneous, Until dispelled, Special,
 * or any phrasing we don't recognise).
 */
export const parseSpellDurationMinutes = (duration: string): number | undefined => {
  const normalized = duration.trim().toLowerCase();
  if (normalized === '' || normalized === 'instantaneous' || normalized.startsWith('until dispel')) {
    return undefined;
  }
  if (normalized === 'special') return undefined;
  // SRD 5.2.1 phrasing is "Concentration, up to N units" for concentration
  // spells. Strip the optional "concentration, " prefix before matching the
  // numeric duration; the engine treats "concentration" as one signal among
  // many (it's also expressed by the spell's `concentration: true` flag).
  // "Up to N units" phrasing matches the same N units.
  const m = /^(?:concentration,?\s+)?(?:up to\s+)?(\d+)\s+(round|rounds|minute|minutes|hour|hours|day|days)/.exec(normalized);
  if (m === null) return undefined;
  const count = Number.parseInt(m[1]!, 10);
  const unit = m[2]!;
  if (unit.startsWith('round')) return count * ROUND_MINUTES;
  if (unit.startsWith('minute')) return count;
  if (unit.startsWith('hour')) return count * MINUTES_PER_HOUR;
  if (unit.startsWith('day')) return count * MINUTES_PER_DAY;
  return undefined;
};

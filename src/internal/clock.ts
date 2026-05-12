// Wallclock helpers. Used by planners that need to stamp events with the
// current time when the caller did not supply one. Centralised here so the
// behaviour is consistent across the engine and trivial to mock if needed.

export const nowIso = (): string => new Date().toISOString();

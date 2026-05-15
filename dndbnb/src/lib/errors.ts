// Error formatting helper.
//
// Supabase's PostgrestError / FunctionsHttpError / AuthError instances
// are *not* always `Error` subclasses after going through the JS
// network layer; they come back as plain objects with `message`,
// `details`, `hint`, `code` fields. The naive
// `err instanceof Error ? err.message : String(err)` pattern then
// falls through to `String({...})` which yields the famously useless
// "[object Object]" string.
//
// This helper handles every shape we've actually seen:
//   * Error instance -> .message
//   * { message: string, ... } -> message (plus hint/details when useful)
//   * string -> as-is
//   * anything else -> JSON.stringify, falling back to String()
// It also logs the raw error to the console so the devtools panel
// has the unredacted object for debugging.

export const errorMessage = (err: unknown): string => {
  // Always dump the raw error so devtools has the full PostgREST/auth
  // payload (code, hint, details) even if the UI only shows the
  // human message.
  // eslint-disable-next-line no-console
  console.error(err);

  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e.message === 'string') parts.push(e.message);
    if (typeof e.hint === 'string' && e.hint) parts.push(`hint: ${e.hint}`);
    if (typeof e.details === 'string' && e.details) parts.push(`details: ${e.details}`);
    if (typeof e.code === 'string' && e.code && parts.length === 0) {
      parts.push(`code: ${e.code}`);
    }
    if (parts.length > 0) return parts.join(' | ');

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return String(err);
};

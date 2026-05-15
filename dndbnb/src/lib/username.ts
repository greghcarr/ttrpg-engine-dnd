// Username utilities.
//
// dndbnb is a username-only product: no real email is ever collected.
// Supabase Auth, however, is email-based. We bridge the two by
// synthesizing a non-routable email per username, of the form
// `<username>@dndbnb.invalid`. The `.invalid` TLD (RFC 2606) is
// reserved as permanently unresolvable, so even an accidental
// `mailto:` will fail closed.
//
// Knock-on consequences:
//   * Email confirmation should be off in the Supabase project
//     (Auth -> Settings), since the synthetic addresses can't
//     actually receive mail.
//   * Password reset via email link is unavailable; a future slice
//     can offer "security question" or admin-issued reset flows.
//   * Username uniqueness piggybacks on Supabase's email-uniqueness
//     constraint; no separate enforcement needed in slice 1.

export const USERNAME_DOMAIN = 'dndbnb.invalid';

const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 30;
// Lowercase letters, digits, underscore, dash. Must start with a
// letter or digit so usernames don't look like flags or invisible.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export const USERNAME_RULES = `${USERNAME_MIN_LEN}-${USERNAME_MAX_LEN} characters, lowercase letters, digits, underscore, or dash. Must start with a letter or digit.`;

export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();

export const validateUsername = (username: string): string | null => {
  if (username.length < USERNAME_MIN_LEN) return `Username must be at least ${USERNAME_MIN_LEN} characters.`;
  if (username.length > USERNAME_MAX_LEN) return `Username must be at most ${USERNAME_MAX_LEN} characters.`;
  if (!USERNAME_PATTERN.test(username)) return USERNAME_RULES;
  return null;
};

export const usernameToEmail = (username: string): string =>
  `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;

export const emailToUsername = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const suffix = `@${USERNAME_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
};

// Sign-in screen.
//
// Username + password. No email is collected: the username is
// hashed to a synthetic, non-routable address (see lib/username.ts)
// and Supabase Auth handles the actual credential storage on top.

import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import {
  USERNAME_RULES,
  normalizeUsername,
  usernameToEmail,
  validateUsername,
} from '@/lib/username';

type Mode = 'sign-in' | 'sign-up';

interface RedirectState {
  readonly from?: string;
}

const PASSWORD_MIN_LEN = 8;

export const SignIn = (): JSX.Element => {
  const session = useSession();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session) {
    const from = (location.state as RedirectState | null)?.from ?? '/characters';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const normalized = normalizeUsername(username);
    const validationError = validateUsername(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const email = usernameToEmail(normalized);
      if (mode === 'sign-in') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(humanizeAuthError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="auth-card">
      <h2>{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</h2>
      <form onSubmit={submit}>
        <label>
          Username
          <input
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LEN}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'sign-up' && <p className="form-hint">{USERNAME_RULES}</p>}
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Working...' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <p className="auth-toggle">
        {mode === 'sign-in' ? (
          <>
            New here?{' '}
            <button type="button" className="link-button" onClick={() => setMode('sign-up')}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button type="button" className="link-button" onClick={() => setMode('sign-in')}>
              Sign in
            </button>
          </>
        )}
      </p>
    </section>
  );
};

// Supabase auth errors leak the synthetic email into messages. Strip
// the @dndbnb.invalid suffix and rephrase a few common cases so the
// user never sees the internal email format.
const humanizeAuthError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err);
  const cleaned = raw.replace(/@dndbnb\.invalid/g, '');
  if (/invalid login credentials/i.test(cleaned)) return 'Invalid username or password.';
  if (/already registered/i.test(cleaned) || /already.*exists/i.test(cleaned)) {
    return 'That username is taken.';
  }
  return cleaned;
};

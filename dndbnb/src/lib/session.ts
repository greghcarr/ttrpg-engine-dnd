// Auth session store.
//
// Wraps Supabase's auth.onAuthStateChange in a Zustand store so React
// components can subscribe to login state via `useSession()`. The
// initial session is hydrated synchronously from localStorage by the
// Supabase client; the listener keeps it fresh as tokens refresh.

import { useEffect } from 'react';
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { emailToUsername } from '@/lib/username';

interface SessionState {
  readonly session: Session | null;
  readonly user: User | null;
  readonly loading: boolean;
  readonly setSession: (session: Session | null) => void;
  readonly setLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (loading) => set({ loading }),
}));

export const useInstallSessionListener = (): void => {
  useEffect(() => {
    const { setSession, setLoading } = useSessionStore.getState();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
};

export const useSession = (): Session | null => useSessionStore((s) => s.session);
export const useUser = (): User | null => useSessionStore((s) => s.user);
export const useSessionLoading = (): boolean => useSessionStore((s) => s.loading);
export const useUsername = (): string | null =>
  useSessionStore((s) => emailToUsername(s.user?.email));

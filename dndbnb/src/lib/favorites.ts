// Current user's favorite-set store.
//
// The full list of favorited character IDs lives in a Zustand store so
// any list view (Browse, MyCharacters, Favorites) can render the
// star state instantly without each row hitting the database. The
// store loads once when the user signs in and is mutated optimistically
// on toggle; if the Supabase write fails, the mutation is rolled back.

import { useEffect } from 'react';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/session';

interface FavoritesState {
  readonly ids: ReadonlySet<string>;
  readonly loaded: boolean;
  readonly setAll: (ids: ReadonlySet<string>) => void;
  readonly add: (id: string) => void;
  readonly remove: (id: string) => void;
}

export const useFavoritesStore = create<FavoritesState>((set) => ({
  ids: new Set(),
  loaded: false,
  setAll: (ids) => set({ ids, loaded: true }),
  add: (id) =>
    set((s) => {
      const next = new Set(s.ids);
      next.add(id);
      return { ids: next };
    }),
  remove: (id) =>
    set((s) => {
      const next = new Set(s.ids);
      next.delete(id);
      return { ids: next };
    }),
}));

// Loads favorites for the current user once when they sign in. Keeps
// loading idempotent across StrictMode double-mounts.
export const useLoadFavorites = (): void => {
  const user = useUser();
  useEffect(() => {
    if (!user) {
      useFavoritesStore.getState().setAll(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from('favorites')
      .select('character_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        useFavoritesStore.getState().setAll(new Set(data.map((r) => r.character_id)));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
};

export const useIsFavorite = (characterId: string | null | undefined): boolean =>
  useFavoritesStore((s) => (characterId ? s.ids.has(characterId) : false));

// Optimistically toggles a favorite. Reverts the store on Supabase
// error so the UI stays in sync with the server.
export const toggleFavorite = async (characterId: string): Promise<void> => {
  const { ids, add, remove } = useFavoritesStore.getState();
  const wasFavorite = ids.has(characterId);
  if (wasFavorite) {
    remove(characterId);
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('character_id', characterId);
    if (error) {
      add(characterId);
      throw error;
    }
  } else {
    add(characterId);
    const { error } = await supabase
      .from('favorites')
      .insert({ character_id: characterId });
    if (error) {
      remove(characterId);
      throw error;
    }
  }
};

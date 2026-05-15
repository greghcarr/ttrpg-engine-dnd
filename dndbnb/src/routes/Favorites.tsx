// My-Favorites page.
//
// Joins the user's favorites against the characters they can read
// (their own + public). The join is done client-side via two queries
// to keep RLS straightforward.

import { useEffect, useState } from 'react';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { CharacterCard, type CharacterCardModel } from '@/components/CharacterCard';
import { useUser } from '@/lib/session';

type Row = Pick<
  CharacterRow,
  'id' | 'name' | 'updated_at' | 'is_public' | 'primary_class_id'
>;

export const Favorites = (): JSX.Element => {
  const user = useUser();
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async (): Promise<void> => {
      const { data: favs, error: favErr } = await supabase
        .from('favorites')
        .select('character_id')
        .eq('user_id', user.id);
      if (cancelled) return;
      if (favErr) {
        setError(favErr.message);
        return;
      }
      const ids = (favs ?? []).map((f) => f.character_id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }
      const { data: chars, error: charsErr } = await supabase
        .from('characters')
        .select('id, name, updated_at, is_public, primary_class_id')
        .in('id', ids)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (charsErr) {
        setError(charsErr.message);
        return;
      }
      setRows(chars ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>My favorite characters</h2>
      </div>
      {error ? (
        <p className="status error">{error}</p>
      ) : rows === null ? (
        <p className="status">Loading favorites...</p>
      ) : rows.length === 0 ? (
        <p className="empty">
          No favorites yet. Browse public characters and tap the star.
        </p>
      ) : (
        <ul className="character-list">
          {rows.map((row) => (
            <CharacterCard
              key={row.id}
              character={cardModel(row)}
              showFavorite
              showVisibilityBadge
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const cardModel = (row: Row): CharacterCardModel => ({
  id: row.id,
  name: row.name,
  updated_at: row.updated_at,
  is_public: row.is_public,
  primary_class_id: row.primary_class_id,
});

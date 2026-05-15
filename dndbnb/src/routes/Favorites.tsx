// My-Favorites page.
//
// Joins the user's favorites against the characters they can read
// (their own + public). The join is done client-side via two queries
// to keep RLS straightforward.

import { useEffect, useState } from 'react';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { CharacterCard, type CharacterCardModel } from '@/components/CharacterCard';
import { Pagination, usePageSize } from '@/components/Pagination';
import { useUser } from '@/lib/session';
import { fetchUsernames } from '@/lib/campaigns';

type Row = Pick<
  CharacterRow,
  'id' | 'owner_id' | 'name' | 'updated_at' | 'is_public' | 'primary_class_id' | 'species_id'
>;

export const Favorites = (): JSX.Element => {
  const user = useUser();
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [usernames, setUsernames] = useState<ReadonlyMap<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [hasMore, setHasMore] = useState(false);

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
        setHasMore(false);
        return;
      }
      const { data: chars, error: charsErr } = await supabase
        .from('characters')
        .select('id, owner_id, name, updated_at, is_public, primary_class_id, species_id')
        .in('id', ids)
        .order('updated_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize);
      if (cancelled) return;
      if (charsErr) {
        setError(charsErr.message);
        return;
      }
      const fetched = chars ?? [];
      setHasMore(fetched.length > pageSize);
      const trimmed = fetched.slice(0, pageSize);
      setRows(trimmed);
      try {
        const map = await fetchUsernames(trimmed.map((r) => r.owner_id));
        if (!cancelled) setUsernames(map);
      } catch {
        // Non-fatal -- cards fall back to "Updated on ..." without
        // the "by ..." segment.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, page, pageSize]);

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>My favorite characters</h2>
      </div>
      {error ? (
        <p className="status error">{error}</p>
      ) : rows === null ? (
        <p className="status">Loading favorites...</p>
      ) : rows.length === 0 && page === 0 ? (
        <p className="empty">
          No favorites yet. Browse public characters and tap the star.
        </p>
      ) : (
        <>
          <ul className="character-list">
            {rows.map((row) => (
              <CharacterCard
                key={row.id}
                character={cardModel(row, usernames.get(row.owner_id) ?? null)}
                showFavorite
                showVisibilityBadge
              />
            ))}
          </ul>
          <Pagination
            page={page}
            hasMore={hasMore}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(next: number) => {
              setPageSize(next);
              setPage(0);
            }}
          />
        </>
      )}
    </section>
  );
};

const cardModel = (row: Row, ownerLabel: string | null): CharacterCardModel => ({
  id: row.id,
  name: row.name,
  updated_at: row.updated_at,
  is_public: row.is_public,
  primary_class_id: row.primary_class_id,
  species_id: row.species_id,
  ownerLabel,
});

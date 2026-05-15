// Public-character browse page.
//
// Lists every character whose owner flagged it `is_public`, newest
// first, paginated. The list is gated by Supabase RLS to public rows
// only; the anon-key client can't see anyone's private characters
// even if it asks.

import { useEffect, useState } from 'react';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { CharacterCard, type CharacterCardModel } from '@/components/CharacterCard';

const PAGE_SIZE = 24;

type Row = Pick<
  CharacterRow,
  'id' | 'name' | 'updated_at' | 'is_public' | 'primary_class_id'
>;

export const Browse = (): JSX.Element => {
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    supabase
      .from('characters')
      .select('id, name, updated_at, is_public, primary_class_id')
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          return;
        }
        const fetched = data ?? [];
        // We fetched one extra row to know whether there's another page.
        setHasMore(fetched.length > PAGE_SIZE);
        setRows(fetched.slice(0, PAGE_SIZE));
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>Browse public characters</h2>
      </div>
      {error ? (
        <p className="status error">{error}</p>
      ) : rows === null ? (
        <p className="status">Loading public characters...</p>
      ) : rows.length === 0 && page === 0 ? (
        <p className="empty">
          No public characters yet. Be the first: open one of yours and switch it to public.
        </p>
      ) : (
        <>
          <ul className="character-list">
            {rows.map((row) => (
              <CharacterCard key={row.id} character={cardModel(row)} showFavorite />
            ))}
          </ul>
          {(page > 0 || hasMore) && (
            <div className="pagination">
              <button
                type="button"
                className="ghost"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className="pagination-page">Page {page + 1}</span>
              <button
                type="button"
                className="ghost"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
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

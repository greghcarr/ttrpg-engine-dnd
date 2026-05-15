// "My Characters" page.
//
// Lists characters owned by the signed-in user. Empty state links to
// the creator wizard at /characters/new.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { useUser } from '@/lib/session';
import { CharacterCard, type CharacterCardModel } from '@/components/CharacterCard';
import { PlusIcon } from '@/components/Icons';

type Row = Pick<
  CharacterRow,
  'id' | 'name' | 'updated_at' | 'is_public' | 'primary_class_id'
>;

export const MyCharacters = (): JSX.Element => {
  const user = useUser();
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('characters')
      .select('id, name, updated_at, is_public, primary_class_id')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRows(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (rows === null && !error) return <p className="status">Loading characters...</p>;
  if (error) return <p className="status error">{error}</p>;

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>My characters</h2>
        <Link
          to="/characters/new"
          className="icon-btn"
          title="Create character"
          aria-label="Create character"
        >
          <PlusIcon />
        </Link>
      </div>
      {rows && rows.length === 0 ? (
        <p className="empty">
          No characters yet. <Link to="/characters/new">Start the creator</Link>.
        </p>
      ) : (
        <ul className="character-list">
          {rows?.map((row) => (
            <CharacterCard
              key={row.id}
              character={toCardModel(row)}
              showFavorite
              showVisibilityBadge
              onDeleted={(deletedId) =>
                setRows((current) => (current ?? []).filter((r) => r.id !== deletedId))
              }
              onError={setError}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

const toCardModel = (row: Row): CharacterCardModel => ({
  id: row.id,
  name: row.name,
  updated_at: row.updated_at,
  is_public: row.is_public,
  primary_class_id: row.primary_class_id,
});

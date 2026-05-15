// "My Characters" page.
//
// Lists characters owned by the signed-in user. Empty state offers a
// "Create sample" button as a quick way to seed something for poking
// around with; the proper path is the creator wizard at /characters/new.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SCHEMA_VERSION } from 'ttrpg-engine-dnd';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { useUser } from '@/lib/session';
import { buildSampleCharacter } from '@/lib/sample-character';
import { CharacterCard, type CharacterCardModel } from '@/components/CharacterCard';
import { errorMessage } from '@/lib/errors';

type Row = Pick<CharacterRow, 'id' | 'name' | 'updated_at' | 'is_public'>;

export const MyCharacters = (): JSX.Element => {
  const user = useUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('characters')
      .select('id, name, updated_at, is_public')
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

  const createSample = async (): Promise<void> => {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      const character = buildSampleCharacter();
      const { data, error: err } = await supabase
        .from('characters')
        .insert({
          name: character.name,
          payload: character,
          schema_version: SCHEMA_VERSION,
        })
        .select('id')
        .single();
      if (err) throw err;
      navigate(`/characters/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  if (rows === null && !error) return <p className="status">Loading characters...</p>;
  if (error) return <p className="status error">{error}</p>;

  return (
    <section className="characters-page">
      <div className="page-header">
        <h2>My characters</h2>
        <div className="page-header-actions">
          <button
            type="button"
            className="ghost"
            onClick={createSample}
            disabled={creating}
            title="Insert a hard-coded L5 wizard for testing"
          >
            {creating ? 'Creating...' : 'Sample wizard'}
          </button>
          <Link to="/characters/new" className="primary-link">
            Create character
          </Link>
        </div>
      </div>
      {rows && rows.length === 0 ? (
        <p className="empty">
          No characters yet. <Link to="/characters/new">Start the creator</Link>, or drop in
          the sample wizard to poke around the read-only sheet.
        </p>
      ) : (
        <ul className="character-list">
          {rows?.map((row) => (
            <CharacterCard
              key={row.id}
              character={toCardModel(row)}
              showFavorite
              showVisibilityBadge
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
});

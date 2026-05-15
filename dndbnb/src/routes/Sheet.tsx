// Read-only character sheet.
//
// Loads a single character row from Supabase by route param, parses
// the payload back through the engine's CharacterSchema, derives the
// computed view, and renders a small definition list. RLS guarantees
// the user can only fetch characters they own, characters flagged
// public, or characters shared via campaign membership.
//
// Toolbar actions: export PDF (anyone with read access), toggle
// public/private (owner only), attach/detach to campaign (owner),
// clone (anyone with read access), favorite (any signed-in user).

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CharacterSchema,
  SCHEMA_VERSION,
  computeDerivedCharacter,
  newCharacterId,
  resolveContent,
  type Character,
} from 'ttrpg-engine-dnd';
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { useUser } from '@/lib/session';
import { FavoriteButton } from '@/components/FavoriteButton';
import { listMyCampaigns, type CampaignSummary } from '@/lib/campaigns';
import { errorMessage } from '@/lib/errors';

const content = resolveContent([loadStarterPack()]);

type SheetRow = Pick<
  CharacterRow,
  'id' | 'owner_id' | 'name' | 'is_public' | 'payload' | 'campaign_id'
>;

export const Sheet = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const navigate = useNavigate();
  const [row, setRow] = useState<SheetRow | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [campaigns, setCampaigns] = useState<ReadonlyArray<CampaignSummary> | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from('characters')
      .select('id, owner_id, name, is_public, payload, campaign_id')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          return;
        }
        setRow(data);
        try {
          setCharacter(CharacterSchema.parse(data.payload));
        } catch (parseErr) {
          setError(errorMessage(parseErr));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isOwner = !!user && !!row && user.id === row.owner_id;

  // Lazy-load the owner's campaign list only when they're actually the
  // owner — saves a query on every public-sheet view.
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    listMyCampaigns()
      .then((rows) => {
        if (!cancelled) setCampaigns(rows);
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  const derived = useMemo(
    () =>
      character
        ? computeDerivedCharacter({ character, itemInstances: {}, content })
        : null,
    [character],
  );

  const onExportPdf = async (): Promise<void> => {
    if (!character || !derived) return;
    setExporting(true);
    try {
      const { generateCharacterSheetPdf } = await import('@/lib/pdf/character-sheet');
      const bytes = await generateCharacterSheetPdf({ character, derived, content });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(character.name)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const onToggleVisibility = async (): Promise<void> => {
    if (!row || !isOwner) return;
    setToggling(true);
    setError(null);
    try {
      const target = !row.is_public;
      const { error: err } = await supabase
        .from('characters')
        .update({ is_public: target })
        .eq('id', row.id);
      if (err) throw err;
      setRow({ ...row, is_public: target });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  const onAttachCampaign = async (campaignId: string | null): Promise<void> => {
    if (!row || !isOwner) return;
    setAttaching(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('characters')
        .update({ campaign_id: campaignId })
        .eq('id', row.id);
      if (err) throw err;
      setRow({ ...row, campaign_id: campaignId });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAttaching(false);
    }
  };

  const onDelete = async (): Promise<void> => {
    if (!row || !isOwner || !character) return;
    if (
      !confirm(
        `Delete "${character.name}"? This can't be undone. The character is removed for everyone, including any campaign it's attached to.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('characters').delete().eq('id', row.id);
      if (err) throw err;
      navigate('/characters');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const onClone = async (): Promise<void> => {
    if (!character || !user) return;
    setCloning(true);
    setError(null);
    try {
      const cloned: Character = {
        ...character,
        id: newCharacterId(),
        name: cloneName(character.name),
      };
      const { data, error: err } = await supabase
        .from('characters')
        .insert({
          name: cloned.name,
          payload: cloned,
          schema_version: SCHEMA_VERSION,
        })
        .select('id')
        .single();
      if (err) throw err;
      navigate(`/characters/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCloning(false);
    }
  };

  if (error) return <p className="status error">{error}</p>;
  if (!character || !derived || !row) return <p className="status">Loading character...</p>;

  const rows: ReadonlyArray<readonly [string, string | number]> = [
    ['Name', character.name],
    ['Species', character.speciesId],
    ['Background', character.backgroundId],
    ['Class', character.classes.map((c) => `${c.classId} ${c.level}`).join(' / ')],
    ['HP', `${character.hp.current} / ${character.hp.max}`],
    ['Proficiency bonus', `+${derived.proficiencyBonus}`],
    ['Languages known', derived.knownLanguages.join(', ') || '(none)'],
  ];

  const currentCampaign =
    row.campaign_id && campaigns
      ? campaigns.find((c) => c.id === row.campaign_id) ?? null
      : null;

  return (
    <section className="sheet-page">
      <div className="sheet-toolbar">
        <p className="breadcrumb">
          <Link to="/characters">&larr; All characters</Link>
        </p>
        <div className="sheet-actions">
          {user && <FavoriteButton characterId={row.id} />}
          {isOwner && (
            <button
              type="button"
              className="ghost"
              onClick={onToggleVisibility}
              disabled={toggling}
              title={row.is_public ? 'Make private' : 'Share publicly'}
            >
              {toggling
                ? 'Working...'
                : row.is_public
                  ? 'Make private'
                  : 'Make public'}
            </button>
          )}
          {user && !isOwner && (
            <button type="button" className="ghost" onClick={onClone} disabled={cloning}>
              {cloning ? 'Cloning...' : 'Clone to my characters'}
            </button>
          )}
          <button type="button" className="ghost" onClick={onExportPdf} disabled={exporting}>
            {exporting ? 'Building PDF...' : 'Export PDF'}
          </button>
          {isOwner && (
            <button
              type="button"
              className="ghost danger"
              onClick={onDelete}
              disabled={deleting}
              title="Permanently delete this character"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
      <div className="sheet-meta">
        <span className={`badge ${row.is_public ? 'badge-public' : 'badge-private'}`}>
          {row.is_public ? 'Public' : 'Private'}
        </span>
        {currentCampaign && (
          <Link to={`/campaigns/${currentCampaign.id}`} className="campaign-link">
            in {currentCampaign.name}
          </Link>
        )}
      </div>
      {isOwner && (
        <div className="campaign-attach">
          <label>
            Campaign
            <select
              value={row.campaign_id ?? ''}
              disabled={attaching || campaigns === null}
              onChange={(e) =>
                onAttachCampaign(e.target.value === '' ? null : e.target.value)
              }
            >
              <option value="">Not in a campaign</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <dl className="sheet">
        {rows.map(([k, v]) => (
          <div key={k} className="sheet-row">
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'character';

// "Velka (clone)", "Velka (clone 2)", etc., capped so the DB constraint
// (length <= 80) can't be tripped by deep clone-of-clone chains.
const cloneName = (name: string): string => {
  const match = name.match(/^(.*?)\s*\(clone(?:\s+(\d+))?\)$/);
  if (match) {
    const base = match[1] ?? name;
    const n = match[2] ? parseInt(match[2], 10) + 1 : 2;
    return truncate(`${base} (clone ${n})`);
  }
  return truncate(`${name} (clone)`);
};

const truncate = (s: string): string => (s.length > 80 ? s.slice(0, 80) : s);

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
  type DerivedCharacter,
} from 'ttrpg-engine-dnd';
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import { supabase, type CharacterRow } from '@/lib/supabase';
import { useUser } from '@/lib/session';
import { FavoriteButton } from '@/components/FavoriteButton';
import { CopyIcon, GlobeIcon, PencilIcon, TrashIcon } from '@/components/Icons';
import { listMyCampaigns, type CampaignSummary } from '@/lib/campaigns';
import { errorMessage } from '@/lib/errors';
import { classColorVars } from '@/lib/class-colors';

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
  // First click that flips the character from private to public shows
  // a confirm dialog. Subsequent toggles on the same page visit skip
  // it since the user has acknowledged what going public means.
  const [confirmedPublic, setConfirmedPublic] = useState(false);

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

  const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onExport = async (format: 'json' | 'csv' | 'pdf'): Promise<void> => {
    if (!character || !derived) return;
    setExporting(true);
    setError(null);
    try {
      const base = slugify(character.name);
      if (format === 'json') {
        // The ttrpg-engine-dnd `Character` JSON is the source of truth
        // and round-trips back through CharacterSchema.parse.
        const blob = new Blob([JSON.stringify(character, null, 2)], {
          type: 'application/json',
        });
        triggerDownload(blob, `${base}.json`);
      } else if (format === 'csv') {
        const blob = new Blob([characterToCsv(character, derived)], {
          type: 'text/csv;charset=utf-8',
        });
        triggerDownload(blob, `${base}.csv`);
      } else {
        const { generateCharacterSheetPdf } = await import('@/lib/pdf/character-sheet');
        const bytes = await generateCharacterSheetPdf({ character, derived, content });
        const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
        triggerDownload(blob, `${base}.pdf`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const onToggleVisibility = async (): Promise<void> => {
    if (!row || !isOwner) return;
    const target = !row.is_public;
    if (target && !confirmedPublic) {
      const ok = confirm(
        `Make "${character?.name ?? 'this character'}" publicly visible? Anyone signed in will be able to see it on the Browse page, favorite it, or clone it for their own use. You can switch it back to private at any time.`,
      );
      if (!ok) return;
      setConfirmedPublic(true);
    }
    setToggling(true);
    setError(null);
    try {
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

  if (!character || !derived || !row) {
    return (
      <section className="sheet-page">
        <p className="breadcrumb">
          <Link to="/characters">&larr; All characters</Link>
        </p>
        {error ? (
          <p className="status error">{error}</p>
        ) : (
          <p className="status">Loading character...</p>
        )}
      </section>
    );
  }

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
    <section
      className="sheet-page"
      style={classColorVars(character.classes[0]?.classId)}
    >
      <div className="sheet-toolbar">
        <p className="breadcrumb">
          <Link to="/characters">&larr; All characters</Link>
        </p>
        {user && !isOwner && (
          <button
            type="button"
            className="sheet-icon"
            onClick={onClone}
            disabled={cloning}
            title="Clone to my characters"
            aria-label="Clone to my characters"
          >
            <CopyIcon />
          </button>
        )}
      </div>
      {currentCampaign && (
        <div className="sheet-meta">
          <Link to={`/campaigns/${currentCampaign.id}`} className="campaign-link">
            in {currentCampaign.name}
          </Link>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <dl className="sheet">
        {/* Icons pinned to the top-right of the body rectangle.
            Order L->R: star, trash, edit. Borderless to match the
            character-card icons. */}
        <div className="sheet-body-icons">
          {user && <FavoriteButton characterId={row.id} />}
          {isOwner && (
            <button
              type="button"
              className="sheet-icon danger"
              onClick={onDelete}
              disabled={deleting}
              title="Delete character (permanent)"
              aria-label="Delete character"
            >
              <TrashIcon />
            </button>
          )}
          {isOwner && (
            <Link
              to={`/characters/${row.id}/edit`}
              className="sheet-icon"
              title="Edit character"
              aria-label="Edit character"
            >
              <PencilIcon />
            </Link>
          )}
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="sheet-row">
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
        {isOwner && (
          <div className="sheet-row">
            <dt>Campaign</dt>
            <dd>
              <select
                className="sheet-select"
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
            </dd>
          </div>
        )}
        <div className="sheet-row">
          <dt>Visibility</dt>
          <dd className="visibility-cell">
            {row.is_public && (
              <span
                className="public-marker"
                title="Public character"
                aria-label="Public character"
              >
                <GlobeIcon size={14} />
              </span>
            )}
            {isOwner ? (
              <button
                type="button"
                className={`badge badge-toggle ${row.is_public ? 'badge-public' : 'badge-private'}`}
                onClick={onToggleVisibility}
                disabled={toggling}
                title={row.is_public ? 'Click to make private' : 'Click to share publicly'}
              >
                {row.is_public ? 'Public' : 'Private'}
              </button>
            ) : (
              <span className={`badge ${row.is_public ? 'badge-public' : 'badge-private'}`}>
                {row.is_public ? 'Public' : 'Private'}
              </span>
            )}
          </dd>
        </div>
        <div className="sheet-row">
          <dt>Export</dt>
          <dd>
            <div className="export-buttons">
              <button
                type="button"
                className="export-btn"
                onClick={() => onExport('json')}
                disabled={exporting}
                title="Download as ttrpg-engine-dnd JSON"
              >
                JSON
              </button>
              <button
                type="button"
                className="export-btn"
                onClick={() => onExport('csv')}
                disabled={exporting}
                title="Download as CSV"
              >
                CSV
              </button>
              <button
                type="button"
                className="export-btn"
                onClick={() => onExport('pdf')}
                disabled={exporting}
                title="Download as PDF character sheet"
              >
                PDF
              </button>
            </div>
          </dd>
        </div>
      </dl>
    </section>
  );
};

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'character';

// Flat single-row CSV of the most-useful character fields. The
// engine's full Character shape is too deeply nested for tabular form,
// so this is intentionally a summary -- use the JSON export for the
// round-trippable representation.
const characterToCsv = (character: Character, derived: DerivedCharacter): string => {
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headers = [
    'name', 'species', 'background', 'classes',
    'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA',
    'hp_current', 'hp_max', 'hp_temp',
    'ac', 'proficiency_bonus', 'total_level',
    'feats', 'languages', 'prepared_spells',
  ];
  const row: ReadonlyArray<unknown> = [
    character.name,
    character.speciesId,
    character.backgroundId,
    character.classes.map((c) => `${c.classId} ${c.level}`).join('|'),
    character.abilityScores.STR,
    character.abilityScores.DEX,
    character.abilityScores.CON,
    character.abilityScores.INT,
    character.abilityScores.WIS,
    character.abilityScores.CHA,
    character.hp.current,
    character.hp.max,
    character.hp.temp,
    derived.ac.total,
    derived.proficiencyBonus,
    derived.totalLevel,
    character.featsTaken.join('|'),
    derived.knownLanguages.join('|'),
    character.preparedSpells.join('|'),
  ];
  return `${headers.join(',')}\n${row.map(escape).join(',')}\n`;
};

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

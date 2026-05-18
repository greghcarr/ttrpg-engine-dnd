// Edit-character page.
//
// Single-page form (not a wizard) so any field can be changed in any
// order. Loads the existing Character from Supabase, lets the owner
// edit name + class + level + species + background + ability scores +
// HP + prepared spells, and saves a parsed-and-validated Character
// back to the row. RLS (`characters_owner_update`) ensures non-owners
// can't reach this in the first place.
//
// Trade-offs vs. reusing the creator wizard:
//   * No mode constraints on ability scores -- a character whose
//     stats don't fit standard array / point buy budgets is editable.
//   * Single class only -- multiclass editing is deferred.
//   * Feats / inventory / death saves / class resources are not yet
//     here; once the read-only sheet grows live-mutation surfaces,
//     those will live on the sheet itself rather than the editor.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackLink } from '@/components/BackLink';
import {
  ABILITY_SCORES,
  CharacterSchema,
  SCHEMA_VERSION,
  resolveContent,
  type AbilityScore,
  type Character,
  type Spell,
} from 'dnd-srd-engine';
import { loadStarterPack } from 'dnd-srd-engine/starter-pack';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/session';
import { errorMessage } from '@/lib/errors';
import { checkText } from '@/lib/moderation';
import { getSpellCounts, isCaster } from '@/lib/creator/spell-rules';
import { classColorVars } from '@/lib/class-colors';

const content = resolveContent([loadStarterPack()]);

const MIN_ABILITY = 1;
const MAX_ABILITY = 30;
const MIN_LEVEL = 1;
const MAX_LEVEL = 20;

interface FormState {
  readonly name: string;
  readonly classId: string;
  readonly level: number;
  readonly speciesId: string;
  readonly backgroundId: string;
  readonly abilities: Readonly<Record<AbilityScore, number>>;
  readonly hpCurrent: number;
  readonly hpMax: number;
  readonly hpTemp: number;
  readonly cantrips: ReadonlyArray<string>;
  readonly prepared: ReadonlyArray<string>;
}

const fromCharacter = (c: Character): FormState => {
  const firstClass = c.classes[0];
  return {
    name: c.name,
    classId: firstClass?.classId ?? '',
    level: firstClass?.level ?? 1,
    speciesId: c.speciesId,
    backgroundId: c.backgroundId,
    abilities: { ...c.abilityScores },
    hpCurrent: c.hp.current,
    hpMax: c.hp.max,
    hpTemp: c.hp.temp,
    cantrips: c.preparedSpells.filter((id) => content.spells.get(id)?.level === 0),
    prepared: c.preparedSpells.filter((id) => {
      const lvl = content.spells.get(id)?.level;
      return lvl !== undefined && lvl > 0;
    }),
  };
};

export const EditCharacter = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const navigate = useNavigate();
  const [original, setOriginal] = useState<Character | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from('characters')
      .select('id, owner_id, payload')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(errorMessage(err));
          return;
        }
        try {
          const parsed = CharacterSchema.parse(data.payload);
          setOriginal(parsed);
          setOwnerId(data.owner_id);
          setForm(fromCharacter(parsed));
        } catch (parseErr) {
          setError(errorMessage(parseErr));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isOwner = !!user && !!ownerId && user.id === ownerId;
  const showSpells = !!form && isCaster(form.classId);

  const update = <K extends keyof FormState,>(key: K, value: FormState[K]): void => {
    if (!form) return;
    setForm({ ...form, [key]: value });
  };

  const updateAbility = (ab: AbilityScore, value: number): void => {
    if (!form) return;
    setForm({ ...form, abilities: { ...form.abilities, [ab]: clamp(value, MIN_ABILITY, MAX_ABILITY) } });
  };

  // When the class changes, the previous spell selection might not be
  // valid for the new class. Drop spells the new class can't cast.
  const onClassChange = (newClassId: string): void => {
    if (!form) return;
    const validForClass = (id: string): boolean => {
      const spell = content.spells.get(id);
      return !!spell?.classes?.includes(newClassId);
    };
    setForm({
      ...form,
      classId: newClassId,
      cantrips: form.cantrips.filter(validForClass),
      prepared: form.prepared.filter(validForClass),
    });
  };

  const toggleSpell = (which: 'cantrips' | 'prepared', spellId: string): void => {
    if (!form) return;
    const list = form[which];
    const next = list.includes(spellId)
      ? list.filter((x) => x !== spellId)
      : [...list, spellId];
    setForm({ ...form, [which]: next });
  };

  const onSave = async (): Promise<void> => {
    if (!form || !original) return;
    const trimmedName = form.name.trim();
    if (trimmedName.length < 1) {
      setError('Name is required.');
      return;
    }
    const moderation = checkText(trimmedName);
    if (!moderation.clean) {
      setError(`Please choose a different name (flagged: ${moderation.matchedTerms.join(', ') || 'profanity'}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated: Character = CharacterSchema.parse({
        ...original,
        name: trimmedName,
        classes: [
          {
            classId: form.classId,
            level: form.level,
            hitDiceRemaining: Math.min(
              original.classes[0]?.hitDiceRemaining ?? form.level,
              form.level,
            ),
          },
        ],
        speciesId: form.speciesId,
        backgroundId: form.backgroundId,
        abilityScores: form.abilities,
        hp: { current: form.hpCurrent, max: form.hpMax, temp: form.hpTemp },
        preparedSpells: [...form.cantrips, ...form.prepared],
      });
      const { error: err } = await supabase
        .from('characters')
        .update({
          name: updated.name,
          payload: updated,
          schema_version: SCHEMA_VERSION,
        })
        .eq('id', id!);
      if (err) throw err;
      navigate(`/characters/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!form || !original) {
    return (
      <section className="edit-page">
        <p className="breadcrumb">
          <BackLink fallback={`/characters/${id ?? ''}`}>&larr; Back</BackLink>
        </p>
        {error ? (
          <p className="status error">{error}</p>
        ) : (
          <p className="status">Loading character...</p>
        )}
      </section>
    );
  }
  if (!isOwner) {
    return (
      <section className="edit-page">
        <p className="breadcrumb">
          <BackLink fallback={`/characters/${id}`}>&larr; Back</BackLink>
        </p>
        <p className="status error">You can only edit characters you own.</p>
      </section>
    );
  }

  const classes = [...content.classes.values()].sort((a, b) => a.name.localeCompare(b.name));
  const species = [...content.species.values()].sort((a, b) => a.name.localeCompare(b.name));
  const backgrounds = [...content.backgrounds.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="edit-page" style={classColorVars(form.classId)}>
      <p className="breadcrumb">
        <BackLink fallback={`/characters/${id}`}>&larr; Back</BackLink>
      </p>
      <h2>Edit {original.name}</h2>

      <FormSection title="Identity">
        <Field label="Name">
          <input
            type="text"
            maxLength={80}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
      </FormSection>

      <FormSection title="Class & origin">
        <Field label="Class">
          <select value={form.classId} onChange={(e) => onClassChange(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Level">
          <input
            type="number"
            min={MIN_LEVEL}
            max={MAX_LEVEL}
            value={form.level}
            onChange={(e) => update('level', clamp(Number(e.target.value), MIN_LEVEL, MAX_LEVEL))}
          />
        </Field>
        <Field label="Species">
          <select value={form.speciesId} onChange={(e) => update('speciesId', e.target.value)}>
            {species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Background">
          <select value={form.backgroundId} onChange={(e) => update('backgroundId', e.target.value)}>
            {backgrounds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title="Ability scores">
        <div className="ability-grid">
          {ABILITY_SCORES.map((ab) => (
            <Field key={ab} label={ab}>
              <input
                type="number"
                min={MIN_ABILITY}
                max={MAX_ABILITY}
                value={form.abilities[ab]}
                onChange={(e) => updateAbility(ab, Number(e.target.value))}
              />
            </Field>
          ))}
        </div>
      </FormSection>

      <FormSection title="Hit points">
        <Field label="Current">
          <input
            type="number"
            min={0}
            value={form.hpCurrent}
            onChange={(e) => update('hpCurrent', Math.max(0, Number(e.target.value)))}
          />
        </Field>
        <Field label="Max">
          <input
            type="number"
            min={1}
            value={form.hpMax}
            onChange={(e) => update('hpMax', Math.max(1, Number(e.target.value)))}
          />
        </Field>
        <Field label="Temp">
          <input
            type="number"
            min={0}
            value={form.hpTemp}
            onChange={(e) => update('hpTemp', Math.max(0, Number(e.target.value)))}
          />
        </Field>
      </FormSection>

      {showSpells && (
        <SpellsEditor
          classId={form.classId}
          cantrips={form.cantrips}
          prepared={form.prepared}
          onToggleCantrip={(id) => toggleSpell('cantrips', id)}
          onTogglePrepared={(id) => toggleSpell('prepared', id)}
        />
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="edit-actions">
        <Link to={`/characters/${id}`} className="ghost button-like">
          Cancel
        </Link>
        <button type="button" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </section>
  );
};

interface FormSectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

const FormSection = ({ title, children }: FormSectionProps): JSX.Element => (
  <section className="edit-section">
    <h3>{title}</h3>
    <div className="edit-fields">{children}</div>
  </section>
);

interface FieldProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

const Field = ({ label, children }: FieldProps): JSX.Element => (
  <label className="edit-field">
    <span>{label}</span>
    {children}
  </label>
);

interface SpellsEditorProps {
  readonly classId: string;
  readonly cantrips: ReadonlyArray<string>;
  readonly prepared: ReadonlyArray<string>;
  readonly onToggleCantrip: (id: string) => void;
  readonly onTogglePrepared: (id: string) => void;
}

const SpellsEditor = ({
  classId,
  cantrips,
  prepared,
  onToggleCantrip,
  onTogglePrepared,
}: SpellsEditorProps): JSX.Element => {
  const counts = getSpellCounts(classId);
  const { cantripPool, lvl1Pool } = useMemo(() => {
    const all = [...content.spells.values()];
    return {
      cantripPool: filterByClassAndLevel(all, classId, 0),
      lvl1Pool: filterByClassAndLevel(all, classId, 1),
    };
  }, [classId]);

  return (
    <FormSection title="Spells">
      {cantripPool.length > 0 && (
        <SpellList
          heading={`Cantrips (suggested ${counts.cantrips})`}
          pool={cantripPool}
          chosen={cantrips}
          onToggle={onToggleCantrip}
        />
      )}
      {lvl1Pool.length > 0 && (
        <SpellList
          heading={`Level 1 spells (suggested ${counts.prepared})`}
          pool={lvl1Pool}
          chosen={prepared}
          onToggle={onTogglePrepared}
        />
      )}
    </FormSection>
  );
};

const filterByClassAndLevel = (
  spells: ReadonlyArray<Spell>,
  classId: string,
  level: number,
): ReadonlyArray<Spell> =>
  spells
    .filter((s) => s.level === level && s.classes?.includes(classId))
    .sort((a, b) => a.name.localeCompare(b.name));

interface SpellListProps {
  readonly heading: string;
  readonly pool: ReadonlyArray<Spell>;
  readonly chosen: ReadonlyArray<string>;
  readonly onToggle: (id: string) => void;
}

const SpellList = ({ heading, pool, chosen, onToggle }: SpellListProps): JSX.Element => (
  <div className="spell-picker">
    <h4>{heading}</h4>
    <ul className="spell-list">
      {pool.map((spell) => {
        const selected = chosen.includes(spell.id);
        return (
          <li key={spell.id}>
            <button
              type="button"
              className={`spell-pill ${selected ? 'is-selected' : ''}`}
              onClick={() => onToggle(spell.id)}
            >
              {spell.name}
            </button>
          </li>
        );
      })}
    </ul>
  </div>
);

const clamp = (n: number, min: number, max: number): number =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;

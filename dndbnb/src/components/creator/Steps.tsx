// Individual step bodies for the character creator wizard.
//
// Each step is a presentational component that reads the creator
// state and dispatches actions. The orchestrator (routes/Creator.tsx)
// decides which step is mounted and handles transitions / saving.

import { useMemo } from 'react';
import {
  ABILITY_SCORES,
  type AbilityScore,
  type ResolvedContent,
  type Spell,
} from 'ttrpg-engine-dnd';
import {
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STANDARD_ARRAY,
  abilityMod,
  computeFinalAbilities,
  pointBuyRemaining,
  pointBuySpent,
  randomName,
  type AbilityMode,
  type CreatorAction,
  type CreatorState,
} from '@/lib/creator/state';
import { DiceIcon } from '@/components/Icons';
import { getSpellCounts, isCaster, SPELLCASTING_ABILITY } from '@/lib/creator/spell-rules';
import { checkText } from '@/lib/moderation';

export interface StepProps {
  readonly state: CreatorState;
  readonly dispatch: (action: CreatorAction) => void;
  readonly content: ResolvedContent;
}

const ABILITY_LABEL: Readonly<Record<AbilityScore, string>> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
};

const formatMod = (mod: number): string => (mod >= 0 ? `+${mod}` : `${mod}`);

const sorted = <T,>(map: ReadonlyMap<string, T>): ReadonlyArray<T> =>
  [...map.values()].sort((a, b) => {
    const an = (a as { name?: string }).name ?? '';
    const bn = (b as { name?: string }).name ?? '';
    return an.localeCompare(bn);
  });

// ---- Step: Class ----------------------------------------------------------

export const StepClass = ({ state, dispatch, content }: StepProps): JSX.Element => {
  const classes = sorted(content.classes);
  return (
    <section className="step">
      <h3>Pick a class</h3>
      <p className="step-help">
        Your class is the strongest single influence on what your character can do. You can
        change it freely until you save.
      </p>
      <ul className="card-grid">
        {classes.map((klass) => {
          const selected = state.classId === klass.id;
          const caster = isCaster(klass.id);
          return (
            <li key={klass.id}>
              <button
                type="button"
                className={`pick-card ${selected ? 'is-selected' : ''}`}
                onClick={() => dispatch({ type: 'set-class', classId: klass.id })}
              >
                <span className="card-title">{klass.name}</span>
                <span className="card-meta">
                  Hit die d{klass.hitDie}, primary{' '}
                  {klass.primaryAbility.join(' / ')}
                </span>
                <span className="card-meta">
                  {caster ? `Spellcaster (${SPELLCASTING_ABILITY[klass.id] ?? '?'})` : 'Non-caster'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// ---- Step: Origin (species + background) ----------------------------------

export const StepOrigin = ({ state, dispatch, content }: StepProps): JSX.Element => {
  const species = sorted(content.species);
  const backgrounds = sorted(content.backgrounds);
  const selectedBg = state.backgroundId ? content.backgrounds.get(state.backgroundId) : null;
  const bgOptions = selectedBg?.abilityScoreIncreases.options ?? [];

  return (
    <section className="step">
      <h3>Species</h3>
      <ul className="card-grid">
        {species.map((sp) => {
          const selected = state.speciesId === sp.id;
          return (
            <li key={sp.id}>
              <button
                type="button"
                className={`pick-card ${selected ? 'is-selected' : ''}`}
                onClick={() => dispatch({ type: 'set-species', speciesId: sp.id })}
              >
                <span className="card-title">{sp.name}</span>
                <span className="card-meta">
                  {sp.size}, speed {sp.speed.walk}ft
                </span>
                <span className="card-meta">Languages: {sp.languages.join(', ')}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 style={{ marginTop: '2rem' }}>Background</h3>
      <ul className="card-grid">
        {backgrounds.map((bg) => {
          const selected = state.backgroundId === bg.id;
          return (
            <li key={bg.id}>
              <button
                type="button"
                className={`pick-card ${selected ? 'is-selected' : ''}`}
                onClick={() => dispatch({ type: 'set-background', backgroundId: bg.id })}
              >
                <span className="card-title">{bg.name}</span>
                <span className="card-meta">
                  Skills: {bg.skillProficiencies.join(', ')}
                </span>
                <span className="card-meta">Origin feat: {bg.originFeatId}</span>
                <span className="card-meta">
                  Ability bonuses: +2/+1 from{' '}
                  {bg.abilityScoreIncreases.options.join(' / ')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedBg && (
        <div className="bg-ability-picker">
          <h4>Background ability bonuses</h4>
          <p className="step-help">
            Assign +2 to one ability and +1 to a different one, chosen from the three options
            your background allows.
          </p>
          <div className="bg-ability-rows">
            <BgAbilityRow
              label="+2 to"
              value={state.bgPrimaryAbility}
              options={bgOptions}
              other={state.bgSecondaryAbility}
              onChange={(ab) => dispatch({ type: 'set-bg-ability', slot: 'primary', ability: ab })}
            />
            <BgAbilityRow
              label="+1 to"
              value={state.bgSecondaryAbility}
              options={bgOptions}
              other={state.bgPrimaryAbility}
              onChange={(ab) => dispatch({ type: 'set-bg-ability', slot: 'secondary', ability: ab })}
            />
          </div>
        </div>
      )}
    </section>
  );
};

interface BgAbilityRowProps {
  readonly label: string;
  readonly value: AbilityScore | null;
  readonly options: ReadonlyArray<AbilityScore>;
  readonly other: AbilityScore | null;
  readonly onChange: (ab: AbilityScore | null) => void;
}

const BgAbilityRow = ({ label, value, options, other, onChange }: BgAbilityRowProps): JSX.Element => (
  <div className="bg-ability-row">
    <span className="bg-ability-label">{label}</span>
    <div className="bg-ability-options">
      {options.map((ab) => {
        const selected = value === ab;
        const disabled = other === ab;
        return (
          <button
            key={ab}
            type="button"
            className={`pill ${selected ? 'is-selected' : ''}`}
            disabled={disabled && !selected}
            onClick={() => onChange(selected ? null : ab)}
          >
            {ab}
          </button>
        );
      })}
    </div>
  </div>
);

// ---- Step: Abilities ------------------------------------------------------

const MODE_LABEL: Readonly<Record<AbilityMode, string>> = {
  'standard-array': 'Standard array',
  'point-buy': 'Point buy',
  'manual-roll': 'Roll',
};

const MODE_HELP: Readonly<Record<AbilityMode, string>> = {
  'standard-array': 'Assign each value of [15, 14, 13, 12, 10, 8] to one ability.',
  'point-buy': `Spend ${POINT_BUY_BUDGET} points. Each score costs more as it rises (15 costs 9, 14 costs 7, etc.). Range 8 to 15.`,
  'manual-roll': 'Roll 4d6 drop lowest, six times, then assign the rolls. Re-roll the whole set if you don\'t like what you got.',
};

export const StepAbilities = ({ state, dispatch }: StepProps): JSX.Element => {
  const finalAbilities = useMemo(() => computeFinalAbilities(state), [state]);
  return (
    <section className="step">
      <h3>Ability scores</h3>
      <div className="mode-toggle" role="tablist">
        {(['standard-array', 'point-buy', 'manual-roll'] as const).map((mode) => {
          const selected = state.abilityMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`mode-btn ${selected ? 'is-selected' : ''}`}
              onClick={() => dispatch({ type: 'set-ability-mode', mode })}
            >
              {MODE_LABEL[mode]}
            </button>
          );
        })}
      </div>
      <p className="step-help">{MODE_HELP[state.abilityMode]}</p>
      {state.abilityMode === 'standard-array' && (
        <PoolAssignTable
          state={state}
          dispatch={dispatch}
          finalAbilities={finalAbilities}
          pool={STANDARD_ARRAY}
        />
      )}
      {state.abilityMode === 'manual-roll' && (
        <ManualRollPanel state={state} dispatch={dispatch} finalAbilities={finalAbilities} />
      )}
      {state.abilityMode === 'point-buy' && (
        <PointBuyPanel state={state} dispatch={dispatch} finalAbilities={finalAbilities} />
      )}
    </section>
  );
};

interface PoolAssignProps {
  readonly state: CreatorState;
  readonly dispatch: (a: CreatorAction) => void;
  readonly finalAbilities: Record<AbilityScore, number>;
  readonly pool: ReadonlyArray<number>;
}

// Shared "assign one value from a pool to each ability" table, used
// by both standard-array and manual-roll modes.
const PoolAssignTable = ({
  state,
  dispatch,
  finalAbilities,
  pool,
}: PoolAssignProps): JSX.Element => {
  const usedValues = new Set(
    ABILITY_SCORES.map((a) => state.arrayAssignment[a]).filter((v): v is number => v !== null),
  );
  // Manual-roll can have duplicate values in the pool. Track how
  // many of each value remain available so a 14 and a different 14
  // can each be assigned independently.
  const poolCounts = new Map<number, number>();
  for (const v of pool) poolCounts.set(v, (poolCounts.get(v) ?? 0) + 1);
  const usedCounts = new Map<number, number>();
  for (const v of usedValues) usedCounts.set(v, (usedCounts.get(v) ?? 0) + 1);

  return (
    <table className="ability-table">
      <thead>
        <tr>
          <th>Ability</th>
          <th>Assign value</th>
          <th>Background</th>
          <th>Final</th>
          <th>Mod</th>
        </tr>
      </thead>
      <tbody>
        {ABILITY_SCORES.map((ab) => {
          const current = state.arrayAssignment[ab];
          const bgBonus =
            (state.bgPrimaryAbility === ab ? 2 : 0) +
            (state.bgSecondaryAbility === ab ? 1 : 0);
          const final = finalAbilities[ab];
          return (
            <tr key={ab}>
              <th scope="row">{ABILITY_LABEL[ab]}</th>
              <td>
                <div className="array-pills">
                  {pool.map((value, idx) => {
                    const isCurrent = current === value;
                    const available =
                      (poolCounts.get(value) ?? 0) - (usedCounts.get(value) ?? 0);
                    const taken = available <= 0 && !isCurrent;
                    return (
                      <button
                        key={`${value}-${idx}`}
                        type="button"
                        className={`pill ${isCurrent ? 'is-selected' : ''}`}
                        disabled={taken}
                        onClick={() =>
                          dispatch({
                            type: 'assign-array',
                            ability: ab,
                            value: isCurrent ? null : value,
                          })
                        }
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </td>
              <td className="num cell-bg">{bgBonus > 0 ? `+${bgBonus}` : ''}</td>
              <td className="num cell-final">{current === null ? '' : final}</td>
              <td className="num cell-mod">{current === null ? '' : formatMod(abilityMod(final))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

interface ModePanelProps {
  readonly state: CreatorState;
  readonly dispatch: (a: CreatorAction) => void;
  readonly finalAbilities: Record<AbilityScore, number>;
}

const ManualRollPanel = ({
  state,
  dispatch,
  finalAbilities,
}: ModePanelProps): JSX.Element => (
  <>
    <div className="roll-bar">
      <button type="button" onClick={() => dispatch({ type: 'roll-abilities' })}>
        {state.rolledValues ? 'Re-roll all six' : 'Roll 4d6 drop lowest x6'}
      </button>
      {state.rolledValues && (
        <div className="roll-summary">
          <span className="roll-summary-label">Rolled:</span>
          {[...state.rolledValues]
            .sort((a, b) => b - a)
            .map((v, i) => (
              <span key={`${v}-${i}`} className="roll-token">
                {v}
              </span>
            ))}
        </div>
      )}
    </div>
    {state.rolledValues && (
      <PoolAssignTable
        state={state}
        dispatch={dispatch}
        finalAbilities={finalAbilities}
        pool={state.rolledValues}
      />
    )}
  </>
);

const PointBuyPanel = ({
  state,
  dispatch,
  finalAbilities,
}: ModePanelProps): JSX.Element => {
  const remaining = pointBuyRemaining(state.pointBuyScores);
  const spent = pointBuySpent(state.pointBuyScores);
  return (
    <>
      <div className="pb-budget">
        <span>
          Spent <strong>{spent}</strong> / {POINT_BUY_BUDGET}
        </span>
        <span className={remaining === 0 ? 'pb-budget-done' : ''}>
          {remaining} remaining
        </span>
      </div>
      <table className="ability-table">
        <thead>
          <tr>
            <th>Ability</th>
            <th>Score</th>
            <th>Cost</th>
            <th>Background</th>
            <th>Final</th>
            <th>Mod</th>
          </tr>
        </thead>
        <tbody>
          {ABILITY_SCORES.map((ab) => {
            const score = state.pointBuyScores[ab];
            const cost = POINT_BUY_COST[score] ?? 0;
            const canDec = score > POINT_BUY_MIN;
            const projectedCostUp = POINT_BUY_COST[score + 1];
            const canInc =
              score < POINT_BUY_MAX &&
              projectedCostUp !== undefined &&
              spent - cost + projectedCostUp <= POINT_BUY_BUDGET;
            const bgBonus =
              (state.bgPrimaryAbility === ab ? 2 : 0) +
              (state.bgSecondaryAbility === ab ? 1 : 0);
            const final = finalAbilities[ab];
            return (
              <tr key={ab}>
                <th scope="row">{ABILITY_LABEL[ab]}</th>
                <td>
                  <div className="pb-stepper">
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={!canDec}
                      onClick={() => dispatch({ type: 'adjust-point-buy', ability: ab, delta: -1 })}
                      aria-label={`Decrease ${ABILITY_LABEL[ab]}`}
                      title={`Decrease ${ABILITY_LABEL[ab]}`}
                    >
                      &minus;
                    </button>
                    <span className="pb-score">{score}</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      disabled={!canInc}
                      onClick={() => dispatch({ type: 'adjust-point-buy', ability: ab, delta: 1 })}
                      aria-label={`Increase ${ABILITY_LABEL[ab]}`}
                      title={`Increase ${ABILITY_LABEL[ab]}`}
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="num cell-cost">{cost}</td>
                <td className="num cell-bg">{bgBonus > 0 ? `+${bgBonus}` : ''}</td>
                <td className="num cell-final">{final}</td>
                <td className="num cell-mod">{formatMod(abilityMod(final))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

// ---- Step: Spells ---------------------------------------------------------

export const StepSpells = ({ state, dispatch, content }: StepProps): JSX.Element => {
  if (!state.classId) return <p className="step-empty-state">Pick a class first.</p>;
  if (!isCaster(state.classId)) {
    return (
      <section className="step">
        <h3>Spells</h3>
        <p className="step-help">{labelClass(content, state.classId)} doesn't cast spells at level 1.</p>
      </section>
    );
  }
  const counts = getSpellCounts(state.classId);
  const allSpells = [...content.spells.values()];
  const cantripsAvailable = filterSpells(allSpells, state.classId, 0);
  const lvl1Available = filterSpells(allSpells, state.classId, 1);

  return (
    <section className="step">
      <h3>Spells</h3>
      {counts.cantrips > 0 && (
        <SpellPicker
          title={`Cantrips (pick ${counts.cantrips})`}
          spells={cantripsAvailable}
          chosen={state.cantrips}
          remaining={counts.cantrips - state.cantrips.length}
          onToggle={(id) => dispatch({ type: 'toggle-cantrip', spellId: id, max: counts.cantrips })}
        />
      )}
      {counts.prepared > 0 && (
        <SpellPicker
          title={`Level 1 spells (pick ${counts.prepared})`}
          spells={lvl1Available}
          chosen={state.preparedSpells}
          remaining={counts.prepared - state.preparedSpells.length}
          onToggle={(id) =>
            dispatch({ type: 'toggle-prepared', spellId: id, max: counts.prepared })
          }
        />
      )}
    </section>
  );
};

const labelClass = (content: ResolvedContent, classId: string): string =>
  content.classes.get(classId)?.name ?? classId;

const filterSpells = (
  spells: ReadonlyArray<Spell>,
  classId: string,
  level: number,
): ReadonlyArray<Spell> =>
  spells
    .filter((s) => s.level === level && s.classes?.includes(classId))
    .sort((a, b) => a.name.localeCompare(b.name));

interface SpellPickerProps {
  readonly title: string;
  readonly spells: ReadonlyArray<Spell>;
  readonly chosen: ReadonlyArray<string>;
  readonly remaining: number;
  readonly onToggle: (id: string) => void;
}

const SpellPicker = ({
  title,
  spells,
  chosen,
  remaining,
  onToggle,
}: SpellPickerProps): JSX.Element => (
  <div className="spell-picker">
    <div className="spell-picker-header">
      <h4>{title}</h4>
      <span className="remaining">
        {remaining > 0 ? `${remaining} left to pick` : 'Done'}
      </span>
    </div>
    {spells.length === 0 ? (
      <p className="empty">No spells of this level for this class in the starter pack.</p>
    ) : (
      <ul className="spell-list">
        {spells.map((spell) => {
          const selected = chosen.includes(spell.id);
          const atCap = remaining <= 0 && !selected;
          return (
            <li key={spell.id}>
              <button
                type="button"
                className={`spell-pill ${selected ? 'is-selected' : ''}`}
                disabled={atCap}
                onClick={() => onToggle(spell.id)}
              >
                {spell.name}
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

// ---- Step: Identity -------------------------------------------------------

export const StepIdentity = ({ state, dispatch }: StepProps): JSX.Element => {
  const moderation = useMemo(() => checkText(state.name), [state.name]);
  return (
    <section className="step">
      <h3>Name your character</h3>
      <p className="step-help">Choose a name. You can change it later.</p>
      <div className="name-input-row">
        <input
          type="text"
          className="name-input"
          autoComplete="off"
          maxLength={80}
          aria-label="Character name"
          value={state.name}
          onChange={(e) => dispatch({ type: 'set-name', name: e.target.value })}
        />
        <button
          type="button"
          className="name-dice"
          onClick={() => dispatch({ type: 'set-name', name: randomName() })}
          title="Random name"
          aria-label="Random name"
        >
          <DiceIcon size={16} />
        </button>
      </div>
      {state.name.length > 0 && !moderation.clean && (
        <p className="form-hint warning">
          That name will be rejected when public sharing lands (flagged: {moderation.matchedTerms.join(', ') || 'profanity'}).
        </p>
      )}
    </section>
  );
};

// ---- Step: Review ---------------------------------------------------------

export const StepReview = ({ state, content }: StepProps): JSX.Element => {
  const final = useMemo(() => computeFinalAbilities(state), [state]);
  const klass = state.classId ? content.classes.get(state.classId) : null;
  const sp = state.speciesId ? content.species.get(state.speciesId) : null;
  const bg = state.backgroundId ? content.backgrounds.get(state.backgroundId) : null;
  const conMod = abilityMod(final.CON);
  const hp = klass ? Math.max(1, klass.hitDie + conMod) : 0;
  const totalSpells = state.cantrips.length + state.preparedSpells.length;

  const rows: ReadonlyArray<readonly [string, string]> = [
    ['Name', state.name.trim()],
    ['Class', klass ? `${klass.name} 1` : '?'],
    ['Species', sp?.name ?? '?'],
    ['Background', bg?.name ?? '?'],
    ['Ability scores', ABILITY_SCORES.map((a) => `${a} ${final[a]}`).join(', ')],
    ['Starting HP', `${hp} (d${klass?.hitDie ?? '?'} + ${formatMod(conMod)} CON)`],
    ['Origin feat', bg?.originFeatId ?? '?'],
    ['Spells', totalSpells > 0 ? `${totalSpells} chosen` : 'none'],
  ];

  return (
    <section className="step">
      <h3>Review</h3>
      <dl className="sheet">
        {rows.map(([k, v]) => (
          <div key={k} className="sheet-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

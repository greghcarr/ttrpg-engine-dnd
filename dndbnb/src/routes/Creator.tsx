// Character creator wizard.
//
// Orchestrates the step components: shows the step indicator, the
// active step body, and Prev/Next/Save controls. The Save button
// builds an engine `Character`, inserts it into Supabase, and routes
// to the read-only sheet for the new character.

import { useMemo, useReducer, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SCHEMA_VERSION, resolveContent } from 'ttrpg-engine-dnd';
import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import {
  STEP_LABELS,
  STEP_ORDER,
  initialState,
  isStepComplete,
  nextStep,
  prevStep,
  randomizeState,
  reduce,
  type Step,
} from '@/lib/creator/state';
import { buildCharacter } from '@/lib/creator/build';
import { checkText } from '@/lib/moderation';
import { errorMessage } from '@/lib/errors';
import { classColorVars } from '@/lib/class-colors';
import { DiceIcon } from '@/components/Icons';
import {
  StepAbilities,
  StepClass,
  StepIdentity,
  StepOrigin,
  StepReview,
  StepSpells,
} from '@/components/creator/Steps';
import { supabase } from '@/lib/supabase';

const content = resolveContent([loadStarterPack()]);

export const Creator = (): JSX.Element => {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // True once the user has confirmed a randomize this page visit;
  // subsequent clicks skip the dialog so re-rolling is fast.
  const [confirmedRandomize, setConfirmedRandomize] = useState(false);
  const navigate = useNavigate();

  const onRandomize = (): void => {
    if (!confirmedRandomize) {
      const ok = confirm(
        'Replace all your selections with random choices? This overwrites everything you have picked so far on this character.',
      );
      if (!ok) return;
      setConfirmedRandomize(true);
    }
    const next = randomizeState(state, content);
    // Drop the user on Review so they can save immediately, or step
    // back through to inspect / tweak the random pick.
    dispatch({ type: 'replace', next: { ...next, step: 'review' } });
    setError(null);
  };

  const canAdvance = isStepComplete(state, state.step);
  const next = nextStep(state.step);
  const prev = prevStep(state.step);
  const allComplete = useMemo(
    () => STEP_ORDER.every((s) => isStepComplete(state, s)),
    [state],
  );

  const onSave = async (): Promise<void> => {
    const moderation = checkText(state.name);
    if (!moderation.clean) {
      setError(
        `Please choose a different name (flagged: ${moderation.matchedTerms.join(', ') || 'profanity'}).`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const character = buildCharacter(state, content);
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
      setSaving(false);
    }
  };

  return (
    <section className="creator" style={classColorVars(state.classId)}>
      <p className="breadcrumb">
        <Link to="/characters">&larr; All characters</Link>
      </p>
      <div className="page-header">
        <h2>Create a character</h2>
      </div>
      <StepBody step={state.step} state={state} dispatch={dispatch} />

      <ol className="step-indicator">
        {STEP_ORDER.map((s) => {
          const active = state.step === s;
          const complete = isStepComplete(state, s);
          return (
            <li
              key={s}
              className={`step-pip ${active ? 'is-active' : ''} ${complete ? 'is-done' : ''}`}
            >
              <button
                type="button"
                onClick={() => dispatch({ type: 'set-step', step: s })}
                disabled={active}
              >
                <span className="pip-index">{STEP_ORDER.indexOf(s) + 1}</span>
                <span className="pip-label">{STEP_LABELS[s]}</span>
              </button>
            </li>
          );
        })}
        <li className="step-pip step-pip-randomize">
          <button
            type="button"
            onClick={onRandomize}
            disabled={saving}
            title="Randomize this character"
            aria-label="Randomize this character"
          >
            <DiceIcon size={16} />
          </button>
        </li>
      </ol>

      {error && <p className="form-error">{error}</p>}

      <div className="step-controls">
        <button
          type="button"
          className="ghost"
          onClick={() => prev && dispatch({ type: 'set-step', step: prev })}
          disabled={!prev}
        >
          Previous
        </button>
        {state.step === 'review' ? (
          <button type="button" onClick={onSave} disabled={!allComplete || saving}>
            {saving ? 'Saving...' : 'Save character'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => next && dispatch({ type: 'set-step', step: next })}
            disabled={!canAdvance || !next}
          >
            Next
          </button>
        )}
      </div>

    </section>
  );
};

interface StepBodyProps {
  readonly step: Step;
  readonly state: Parameters<typeof reduce>[0];
  readonly dispatch: React.Dispatch<Parameters<typeof reduce>[1]>;
}

const StepBody = ({ step, state, dispatch }: StepBodyProps): JSX.Element => {
  const props = { state, dispatch, content };
  switch (step) {
    case 'class':
      return <StepClass {...props} />;
    case 'origin':
      return <StepOrigin {...props} />;
    case 'abilities':
      return <StepAbilities {...props} />;
    case 'spells':
      return <StepSpells {...props} />;
    case 'identity':
      return <StepIdentity {...props} />;
    case 'review':
      return <StepReview {...props} />;
  }
};

// Human-readable transcript formatter for golden test scenarios.
// Each event becomes a markdown line; encounter and turn events insert
// grouping headers. Used via vitest `toMatchFileSnapshot` so every golden
// scenario writes a checked-in .transcript.md alongside it.

import type { Event } from '../src/schemas/events/index.js';
import type { CampaignState } from '../src/schemas/runtime/campaign.js';
import type { ResolvedContent } from '../src/content/pack.js';
import { emptyCampaignState } from '../src/schemas/runtime/campaign.js';
import { apply } from '../src/engine/apply.js';

interface FormatterContext {
  readonly stateBefore: CampaignState;
  readonly stateAfter: CampaignState;
  readonly content: ResolvedContent;
}

const characterName = (state: CampaignState, id: string): string =>
  state.characters[id]?.name ?? `<${id.slice(0, 8)}>`;

const itemName = (state: CampaignState, content: ResolvedContent, id: string): string => {
  const inst = state.itemInstances[id];
  if (!inst) return id;
  const def = content.items.get(inst.definitionId);
  return inst.customName ?? def?.name ?? inst.definitionId;
};

const spellName = (content: ResolvedContent, id: string): string =>
  content.spells.get(id)?.name ?? id;

const conditionName = (content: ResolvedContent, id: string): string =>
  content.conditions.get(id)?.name ?? id;

const encounterLabel = (state: CampaignState, id: string): string => {
  const name = state.encounters[id]?.name;
  return name !== undefined ? `"${name}"` : 'the encounter';
};

const hpChange = (before: number | undefined, after: number | undefined): string => {
  if (before === undefined || after === undefined) return '';
  if (before === after) return '';
  return ` (HP ${before} -> ${after})`;
};

const sumDamage = (event: Extract<Event, { type: 'DamageApplied' }>): { total: number; summary: string } => {
  let total = 0;
  const parts: string[] = [];
  for (const c of event.components) {
    total += c.amount;
    parts.push(`${c.amount} ${c.type}`);
  }
  return { total, summary: parts.join(' + ') };
};

const formatEvent = (event: Event, ctx: FormatterContext): string => {
  const { stateBefore, stateAfter, content } = ctx;
  switch (event.type) {
    case 'CharacterCreated': {
      const c = event.snapshot;
      const cls = c.classes.map((e) => `${e.classId} ${e.level}`).join(' / ');
      return `**${c.name}** joined (${cls}, ${c.hp.current}/${c.hp.max} HP).`;
    }
    case 'ItemAcquired':
      return `Item acquired: ${content.items.get(event.instance.definitionId)?.name ?? event.instance.definitionId}.`;
    case 'DamageApplied': {
      const target = characterName(stateBefore, event.targetId);
      const before = stateBefore.characters[event.targetId]?.hp.current;
      const after = stateAfter.characters[event.targetId]?.hp.current;
      const { total, summary } = sumDamage(event);
      return `**${target}** takes ${total} damage (${summary}).${hpChange(before, after)}`;
    }
    case 'Healed': {
      const target = characterName(stateBefore, event.targetId);
      const before = stateBefore.characters[event.targetId]?.hp.current;
      const after = stateAfter.characters[event.targetId]?.hp.current;
      const source = event.source !== undefined ? ` from ${event.source}` : '';
      return `**${target}** healed ${event.amount}${source}.${hpChange(before, after)}`;
    }
    case 'TempHPGranted':
      return `**${characterName(stateBefore, event.targetId)}** gains ${event.amount} temp HP.`;
    case 'ConditionApplied':
      return `**${characterName(stateBefore, event.targetId)}** is now ${conditionName(content, event.conditionId)}${event.level !== undefined ? ` (level ${event.level})` : ''}.`;
    case 'ConditionRemoved':
      return `**${characterName(stateBefore, event.targetId)}** is no longer ${conditionName(content, event.conditionId)}.`;
    case 'ExhaustionChanged':
      return `**${characterName(stateBefore, event.targetId)}** exhaustion ${event.fromLevel} -> ${event.toLevel}.`;
    case 'DeathSaveRolled': {
      const verdict = event.critical ? 'critical success!' : event.success ? 'success' : 'failure';
      return `**${characterName(stateBefore, event.targetId)}** death save: d20(${event.d20}) -> ${verdict}.`;
    }
    case 'Stabilized':
      return `**${characterName(stateBefore, event.targetId)}** stabilized.`;
    case 'ResourceSpent':
      return `**${characterName(stateBefore, event.characterId)}** spends ${event.amount} ${event.resourceId}.`;
    case 'ResourceRestored':
      return `**${characterName(stateBefore, event.characterId)}** restores ${event.amount === 'all' ? 'all' : event.amount} ${event.resourceId}.`;
    case 'HitDieSpent':
      return `**${characterName(stateBefore, event.characterId)}** spends a hit die (d${event.die}=${event.rolled}+${event.conMod}=${event.healed} HP).`;
    case 'ShortRestStarted':
      return `\n## Short rest begins (${event.participantIds.map((id) => characterName(stateBefore, id)).join(', ')})\n`;
    case 'ShortRestEnded':
      return `Short rest ends.\n`;
    case 'LongRestStarted':
      return `\n## Long rest begins (${event.participantIds.map((id) => characterName(stateBefore, id)).join(', ')})\n`;
    case 'LongRestEnded':
      return `Long rest ends.\n`;
    case 'EncounterCreated':
      return `\n## Encounter created: ${event.name ?? 'unnamed'} (${event.combatantIds.length} combatants)\n`;
    case 'InitiativeRolled': {
      const sorted = [...event.rolls].sort((a, b) => b.total - a.total);
      const order = sorted.map(
        (r) => `${characterName(stateBefore, r.combatantId)} (d20=${r.d20}${r.modifier >= 0 ? '+' : ''}${r.modifier}=${r.total})`,
      );
      return `Initiative: ${order.join(', ')}.`;
    }
    case 'EncounterStarted':
      return `Encounter ${encounterLabel(stateBefore, event.encounterId)} begins.`;
    case 'TurnStarted':
      return `\n### Round ${event.round}: ${characterName(stateBefore, event.combatantId)}'s turn\n`;
    case 'TurnEnded':
      return `End of ${characterName(stateBefore, event.combatantId)}'s turn.`;
    case 'RoundEnded':
      return `\nEnd of round ${event.round}.\n`;
    case 'EncounterEnded':
      return `\n## Encounter ends: ${event.outcome}.\n`;
    case 'AttackRolled': {
      const attacker = characterName(stateBefore, event.attackerId);
      const target = characterName(stateBefore, event.targetId);
      const advLabel = event.used === 'none' ? '' : ` [${event.used}]`;
      const rollLabel = event.d20.length === 2 ? `${event.d20[0]}/${event.d20[1]}` : `${event.d20[0]}`;
      const verdict = event.critical
        ? 'CRITICAL HIT!'
        : event.hit
          ? 'hit'
          : 'miss';
      return `**${attacker}** attacks **${target}**${advLabel}: d20(${rollLabel}) + ${event.attackBonus} = ${event.total} vs AC ${event.targetAC} -> ${verdict}.`;
    }
    case 'DamageRolled': {
      const lines = event.rolls.map(
        (r) => `  ${r.expression}=[${r.rolls.join(',')}]${r.modifier >= 0 ? '+' : ''}${r.modifier} ${r.type}`,
      );
      return `Damage rolled${event.critical ? ' (critical, doubled dice)' : ''}:\n${lines.join('\n')}`;
    }
    case 'SaveRolled':
      return `**${characterName(stateBefore, event.targetId)}** ${event.ability} save: d20(${event.d20[0]}) + ${event.bonus} = ${event.total} vs DC ${event.dc} -> ${event.success ? 'success' : 'failure'}.`;
    case 'AbilityCheckRolled': {
      const label = event.skill !== undefined ? event.skill : `${event.ability} check`;
      const dcLine = event.dc !== undefined ? ` vs DC ${event.dc} -> ${event.success === true ? 'success' : 'failure'}` : '';
      return `**${characterName(stateBefore, event.characterId)}** ${label}: d20(${event.d20[0]}) + ${event.bonus} = ${event.total}${dcLine}.`;
    }
    case 'LevelUpResolved': {
      const hpLabel = event.hpRoll !== undefined ? `rolled d? = ${event.hpRoll}, total +${event.hpGained}` : `average, +${event.hpGained}`;
      return `**${characterName(stateBefore, event.characterId)}** levels up: ${event.classId} -> ${event.newClassLevel} (${hpLabel} HP).`;
    }
    case 'ChoiceRequired':
      return `Choice required for **${characterName(stateBefore, event.characterId)}**: ${event.prompt} (${event.options.map((o) => o.label).join(' / ')}).`;
    case 'ChoiceResolved':
      return `**${characterName(stateBefore, event.characterId)}** chose: ${event.selectedOptionIds.join(', ')}.`;
    case 'SpellCastDeclared': {
      const targets = event.targetIds.length === 0
        ? 'no targets'
        : event.targetIds.map((id) => characterName(stateBefore, id)).join(', ');
      const slotLabel = event.slotLevel === 0 ? 'cantrip' : `slot ${event.slotLevel}${event.slotSource === 'pact' ? ' (pact)' : ''}`;
      return `**${characterName(stateBefore, event.characterId)}** casts ${spellName(content, event.spellId)} (${slotLabel}) at ${targets}.`;
    }
    case 'SpellSlotConsumed':
      return `Slot consumed: level ${event.slotLevel}.`;
    case 'PactSlotConsumed':
      return `Pact slot consumed.`;
  }
};

export const formatTranscript = (
  events: ReadonlyArray<Event>,
  content: ResolvedContent,
  options: { readonly title?: string } = {},
): string => {
  const lines: string[] = [];
  if (options.title !== undefined) {
    lines.push(`# ${options.title}`, '');
  }
  let state = emptyCampaignState();
  for (const event of events) {
    const next = apply(state, event);
    lines.push(formatEvent(event, { stateBefore: state, stateAfter: next, content }));
    state = next;
  }
  return lines.join('\n') + '\n';
};

export const writeTranscript = formatTranscript;

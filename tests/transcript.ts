// Human-readable transcript formatter for golden test scenarios.
// Each event becomes a markdown line; encounter and turn events insert
// grouping headers. Used via vitest `toMatchFileSnapshot` so every golden
// scenario writes a checked-in .transcript.md alongside it.

import type { Event } from '../src/schemas/events/index.js';
import type { CampaignState } from '../src/schemas/runtime/campaign.js';
import type { ResolvedContent } from '../src/content/pack.js';
import { emptyCampaignState } from '../src/schemas/runtime/campaign.js';
import { apply } from '../src/engine/apply.js';
import { formatInGameTime } from '../src/schemas/runtime/in-game-time.js';

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
    const baseLabel = `${c.amount} ${c.type}`;
    if (c.mitigation !== undefined && c.rawAmount !== undefined) {
      parts.push(`${baseLabel} [${c.mitigation} from ${c.rawAmount}]`);
    } else {
      parts.push(baseLabel);
    }
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
    case 'ConcentrationStarted': {
      const caster = characterName(stateBefore, event.casterId);
      const spell = spellName(content, event.spellId);
      return `**${caster}** is now concentrating on ${spell}.`;
    }
    case 'ConcentrationBroken': {
      const caster = characterName(stateBefore, event.casterId);
      const spell = stateBefore.effectInstances[event.effectInstanceId]?.spellId;
      const spellLabel = spell !== undefined ? spellName(content, spell) : 'their spell';
      return `**${caster}**'s concentration on ${spellLabel} broke (${event.reason}).`;
    }
    case 'TriggerFired':
      return `_(${event.triggerId.split(':').slice(1).join(':')} triggers for ${characterName(stateBefore, event.characterId)})_`;
    case 'ActionEconomyConsumed':
      return `_(${characterName(stateBefore, event.combatantId)} consumes ${event.kind})_`;
    case 'CombatantMoved': {
      const who = characterName(stateBefore, event.combatantId);
      const from = event.fromPosition;
      const to = event.toPosition;
      const fromLabel = from !== undefined ? `(${from.x}, ${from.y})` : '?';
      return `**${who}** moves ${event.feetTraveled}ft: ${fromLabel} -> (${to.x}, ${to.y}).`;
    }
    case 'Dashed':
      return `**${characterName(stateBefore, event.combatantId)}** Dashes.`;
    case 'Disengaged':
      return `**${characterName(stateBefore, event.combatantId)}** Disengages.`;
    case 'ItemEquipped':
      return `**${characterName(stateBefore, event.characterId)}** equips ${itemName(stateBefore, content, event.instanceId)} (${event.slot}).`;
    case 'ItemUnequipped':
      return `**${characterName(stateBefore, event.characterId)}** unequips ${event.slot}.`;
    case 'ItemAttuned':
      return `**${characterName(stateBefore, event.characterId)}** attunes to ${itemName(stateBefore, content, event.instanceId)}.`;
    case 'ItemUnattuned':
      return `**${characterName(stateBefore, event.characterId)}** ends attunement to ${itemName(stateBefore, content, event.instanceId)}.`;
    case 'PartyCreated': {
      const members = event.memberIds.length === 0
        ? 'no members'
        : event.memberIds.map((id) => characterName(stateBefore, id)).join(', ');
      return `\n## Party "${event.name}" formed (${members})\n`;
    }
    case 'PartyMembersChanged': {
      const party = stateBefore.parties[event.partyId];
      const partyName = party?.name ?? event.partyId.slice(0, 8);
      const added = event.added.map((id) => characterName(stateBefore, id));
      const removed = event.removed.map((id) => characterName(stateBefore, id));
      const segments: string[] = [];
      if (added.length > 0) segments.push(`+${added.join(', ')}`);
      if (removed.length > 0) segments.push(`-${removed.join(', ')}`);
      return `Party "${partyName}" membership: ${segments.join(', ')}.`;
    }
    case 'CurrencyAcquired': {
      const partyName = stateBefore.parties[event.partyId]?.name ?? event.partyId.slice(0, 8);
      const parts = Object.entries(event.amounts)
        .filter(([, count]) => (count ?? 0) > 0)
        .map(([denomination, count]) => `${count} ${denomination}`);
      const sourceLabel = event.source !== undefined ? ` (${event.source})` : '';
      return `Party "${partyName}" receives ${parts.join(', ')}${sourceLabel}.`;
    }
    case 'CurrencySpent': {
      const partyName = stateBefore.parties[event.partyId]?.name ?? event.partyId.slice(0, 8);
      const parts = Object.entries(event.amounts)
        .filter(([, count]) => (count ?? 0) > 0)
        .map(([denomination, count]) => `${count} ${denomination}`);
      const purposeLabel = event.purpose !== undefined ? ` for ${event.purpose}` : '';
      return `Party "${partyName}" spends ${parts.join(', ')}${purposeLabel}.`;
    }
    case 'ItemDepositedToParty': {
      const partyName = stateBefore.parties[event.partyId]?.name ?? event.partyId.slice(0, 8);
      const item = itemName(stateBefore, content, event.itemInstanceId);
      const sourceLabel = event.sourceCharacterId !== undefined
        ? ` from ${characterName(stateBefore, event.sourceCharacterId)}`
        : '';
      return `${item} deposited to party "${partyName}"${sourceLabel}.`;
    }
    case 'ItemWithdrawnFromParty': {
      const partyName = stateBefore.parties[event.partyId]?.name ?? event.partyId.slice(0, 8);
      const item = itemName(stateBefore, content, event.itemInstanceId);
      const recipientLabel = event.recipientCharacterId !== undefined
        ? ` to ${characterName(stateBefore, event.recipientCharacterId)}`
        : '';
      return `${item} withdrawn from party "${partyName}"${recipientLabel}.`;
    }
    case 'SessionStarted':
      return `\n## Session "${event.name}" begins (${formatInGameTime(stateAfter.sessions[event.sessionId]!.inGameStart)})\n`;
    case 'SessionEnded': {
      const session = stateAfter.sessions[event.sessionId]!;
      const summary = event.summary !== undefined ? `: ${event.summary}` : '';
      return `Session "${session.name}" ends${summary}.`;
    }
    case 'JournalEntryAdded': {
      const author = event.authorKind === 'dm'
        ? 'DM'
        : event.authorCharacterId !== undefined
          ? characterName(stateBefore, event.authorCharacterId)
          : 'Player';
      const visibilityLabel = event.visibility === 'party' ? '' : ` [${event.visibility}]`;
      const stamp = formatInGameTime(stateBefore.inGameTime);
      return `_Journal (${author}, ${stamp})${visibilityLabel}_: **${event.title}**: ${event.body}`;
    }
    case 'InGameTimeAdvanced': {
      const before = formatInGameTime(stateBefore.inGameTime);
      const after = formatInGameTime(stateAfter.inGameTime);
      const reasonLabel = event.reason !== undefined ? ` (${event.reason})` : '';
      return `Time passes: ${before} -> ${after} (+${event.minutes} min)${reasonLabel}.`;
    }
    case 'LocationCreated': {
      const mapLabel = event.map !== undefined
        ? ` (map ${event.map.widthCells}x${event.map.heightCells} cells)`
        : '';
      return `Location "${event.name}" created${mapLabel}.`;
    }
    case 'DoorAdded': {
      const label = event.name ?? `door ${event.doorId.slice(0, 6)}`;
      const location = stateAfter.locations[event.locationId]?.name ?? event.locationId.slice(0, 6);
      return `Door "${label}" added at ${location} (${event.position.x},${event.position.y}), ${event.state}.`;
    }
    case 'DoorStateChanged': {
      const door = stateAfter.doors[event.doorId];
      const label = door?.name ?? `door ${event.doorId.slice(0, 6)}`;
      const by = event.byCharacterId !== undefined
        ? ` by **${characterName(stateBefore, event.byCharacterId)}**`
        : '';
      return `Door "${label}" is now ${event.toState}${by}.`;
    }
    case 'CharacterLocationChanged': {
      const who = characterName(stateBefore, event.characterId);
      if (event.toLocationId === undefined) return `**${who}** leaves their location.`;
      const loc = stateAfter.locations[event.toLocationId]?.name ?? event.toLocationId.slice(0, 6);
      return `**${who}** enters ${loc}.`;
    }
    case 'QuestStarted':
      return `\n## Quest started: "${event.title}"\n`;
    case 'ObjectiveProgressed': {
      const objective = stateAfter.quests[event.questId]?.objectives.find((o) => o.id === event.objectiveId);
      const required = objective?.required;
      const progress = objective?.progress ?? 0;
      const progressLabel = required !== undefined ? ` (${progress}/${required})` : ` (+${event.delta})`;
      return `Objective progressed: ${objective?.description ?? event.objectiveId}${progressLabel}.`;
    }
    case 'ObjectiveCompleted': {
      const objective = stateAfter.quests[event.questId]?.objectives.find((o) => o.id === event.objectiveId);
      return `Objective completed: ${objective?.description ?? event.objectiveId}.`;
    }
    case 'ObjectiveFailed': {
      const objective = stateAfter.quests[event.questId]?.objectives.find((o) => o.id === event.objectiveId);
      return `Objective failed: ${objective?.description ?? event.objectiveId}.`;
    }
    case 'QuestCompleted': {
      const quest = stateAfter.quests[event.questId];
      return `**Quest completed:** "${quest?.title ?? event.questId}".`;
    }
    case 'QuestFailed': {
      const quest = stateAfter.quests[event.questId];
      const reason = event.reason !== undefined ? ` (${event.reason})` : '';
      return `**Quest failed:** "${quest?.title ?? event.questId}"${reason}.`;
    }
    case 'QuestAbandoned': {
      const quest = stateAfter.quests[event.questId];
      const reason = event.reason !== undefined ? ` (${event.reason})` : '';
      return `Quest abandoned: "${quest?.title ?? event.questId}"${reason}.`;
    }
    case 'QuestRewardClaimed': {
      const quest = stateAfter.quests[event.questId];
      const xp = quest?.reward.xpPerCharacter ?? 0;
      const recipients = event.beneficiaryCharacterIds
        .map((id) => characterName(stateAfter, id))
        .join(', ');
      const xpLabel = xp > 0 ? `${xp} XP each` : 'no XP';
      return `Quest reward claimed: "${quest?.title ?? event.questId}" (${xpLabel}${recipients !== '' ? ` to ${recipients}` : ''}).`;
    }
    case 'XPAwarded': {
      const who = characterName(stateAfter, event.characterId);
      const source = event.source !== undefined ? ` from ${event.source}` : '';
      return `**${who}** gains ${event.amount} XP${source}.`;
    }
    case 'MilestoneAwarded':
      return `Milestone (${event.kind}): "${event.title}".`;
    case 'SpellCountered': {
      const counter = characterName(stateBefore, event.counterCasterId);
      const target = characterName(stateBefore, event.targetCasterId);
      const spell = spellName(content, event.spellId);
      return `**${counter}** counterspells **${target}**'s ${spell}: the spell fails.`;
    }
    case 'SpellDispelled': {
      const who = characterName(stateBefore, event.dispelledByCharacterId);
      const effect = stateBefore.effectInstances[event.effectInstanceId];
      const spell = effect !== undefined ? spellName(content, effect.spellId) : 'an effect';
      return `**${who}** dispels ${spell}.`;
    }
    case 'ItemIdentified': {
      const who = characterName(stateBefore, event.identifiedByCharacterId);
      const item = itemName(stateBefore, content, event.itemInstanceId);
      return `**${who}** identifies ${item}.`;
    }
    case 'WeaponMasteryActivated': {
      const who = characterName(stateBefore, event.attackerId);
      const targetLabel = event.targetId !== undefined
        ? ` against **${characterName(stateBefore, event.targetId)}**`
        : '';
      return `Mastery: ${event.mastery}${targetLabel} (${who}).`;
    }
    case 'Mounted': {
      const rider = characterName(stateBefore, event.riderId);
      const mount = characterName(stateBefore, event.mountId);
      return `**${rider}** mounts **${mount}**.`;
    }
    case 'Dismounted': {
      const rider = characterName(stateBefore, event.riderId);
      const mount = characterName(stateBefore, event.mountId);
      const how = event.voluntary ? '' : ' (knocked off)';
      return `**${rider}** dismounts ${mount}${how}.`;
    }
    case 'VehicleAcquired':
      return `Vehicle acquired: "${event.name}" (${event.kind}, AC ${event.ac}, ${event.maxHp} HP, ${event.capacity} seats).`;
    case 'VehicleBoarded': {
      const vehicle = stateAfter.vehicles[event.vehicleId];
      return `**${characterName(stateBefore, event.characterId)}** boards ${vehicle?.name ?? event.vehicleId}.`;
    }
    case 'VehicleDeparted': {
      const vehicle = stateAfter.vehicles[event.vehicleId];
      return `**${characterName(stateBefore, event.characterId)}** disembarks ${vehicle?.name ?? event.vehicleId}.`;
    }
    case 'VehicleDamaged': {
      const vehicle = stateAfter.vehicles[event.vehicleId];
      const source = event.source !== undefined ? ` from ${event.source}` : '';
      return `${vehicle?.name ?? event.vehicleId} takes ${event.amount} damage${source}.`;
    }
    case 'VehicleRepaired': {
      const vehicle = stateAfter.vehicles[event.vehicleId];
      return `${vehicle?.name ?? event.vehicleId} repaired for ${event.amount} HP.`;
    }
    case 'TravelLegCompleted': {
      const fromName = event.fromLocationId !== undefined
        ? (stateBefore.locations[event.fromLocationId]?.name ?? event.fromLocationId.slice(0, 6))
        : 'origin';
      const toName = event.toLocationId !== undefined
        ? (stateAfter.locations[event.toLocationId]?.name ?? event.toLocationId.slice(0, 6))
        : 'destination';
      const note = event.notes !== undefined ? ` — ${event.notes}` : '';
      return `Travel: ${fromName} -> ${toName}, ${event.miles} mi over ${event.hours}h at ${event.pace} pace${note}.`;
    }
    case 'NavigationCheckRolled': {
      const navigator = characterName(stateBefore, event.navigatorId);
      const verdict = event.success ? 'on course' : 'lost';
      return `Navigation check (${navigator}): d20(${event.d20})+${event.bonus}=${event.total} vs DC ${event.dc} -> ${verdict}.`;
    }
    case 'ForagedFor': {
      const forager = characterName(stateBefore, event.foragerId);
      if (!event.success) {
        return `${forager} forages: d20(${event.d20})+${event.bonus}=${event.total} vs DC ${event.dc} -> nothing found.`;
      }
      return `${forager} forages: d20(${event.d20})+${event.bonus}=${event.total} vs DC ${event.dc} -> ${event.foodPounds} lb food, ${event.waterPounds} lb water.`;
    }
    case 'AttitudeChanged': {
      const who = characterName(stateBefore, event.characterId);
      const cause = event.cause !== undefined ? ` (${event.cause})` : '';
      return `${who} attitude -> ${event.toAttitude}${cause}.`;
    }
    case 'MoraleCheckRolled': {
      const who = characterName(stateBefore, event.characterId);
      return `${who} morale check: d20(${event.d20})+${event.bonus}=${event.total} vs DC ${event.dc} -> ${event.success ? 'holds' : 'shaken'}.`;
    }
    case 'MoraleBroken': {
      const who = characterName(stateBefore, event.characterId);
      return `${who}'s morale breaks: ${event.action}!`;
    }
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

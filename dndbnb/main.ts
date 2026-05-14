// dndbnb entry point.
//
// Day-1 scaffold: builds a hard-coded L5 wizard via the engine, then
// renders the engine's `DerivedCharacter` view as a minimal sheet.
// Proves end-to-end that the engine import boundary, build pipeline,
// and deploy target all work before any real character-sheet UI lands.

import { loadStarterPack } from 'ttrpg-engine-dnd/starter-pack';
import {
  resolveContent,
  computeDerivedCharacter,
  CharacterSchema,
  newCharacterId,
  type Character,
} from 'ttrpg-engine-dnd';

const statusEl = document.getElementById('status');
const setStatus = (msg: string): void => {
  if (statusEl) statusEl.textContent = msg;
};

const sheetRoot = document.getElementById('sheet-root');

const buildSampleCharacter = (): Character =>
  CharacterSchema.parse({
    id: newCharacterId(),
    name: 'Velka the Studious',
    speciesId: 'human',
    backgroundId: 'sage',
    classes: [{ classId: 'wizard', level: 5, hitDiceRemaining: 5 }],
    abilityScores: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
    hp: { current: 33, max: 33, temp: 0 },
    featsTaken: ['savage-attacker'],
    preparedSpells: ['magic-missile', 'mage-armor', 'fireball', 'fire-bolt'],
  });

const renderSheet = (character: Character, derived: ReturnType<typeof computeDerivedCharacter>): void => {
  if (!sheetRoot) return;
  const rows: Array<[string, string | number]> = [
    ['Name', character.name],
    ['Species', character.speciesId],
    ['Background', character.backgroundId],
    ['Class', character.classes.map((c) => `${c.classId} ${c.level}`).join(' / ')],
    ['HP', `${character.hp.current} / ${character.hp.max}`],
    ['Proficiency bonus', `+${derived.proficiencyBonus}`],
    ['Languages known', derived.knownLanguages.join(', ') || '(none)'],
  ];
  const list = rows.map(([k, v]) => `<dt>${k}</dt><dd>${String(v)}</dd>`).join('');
  sheetRoot.innerHTML = `<dl class="sheet">${list}</dl>`;
};

const boot = (): void => {
  try {
    setStatus('Loading starter pack...');
    const pack = loadStarterPack();
    const content = resolveContent([pack]);

    setStatus('Building sample character...');
    const character = buildSampleCharacter();
    const derived = computeDerivedCharacter({
      character,
      itemInstances: {},
      content,
    });

    renderSheet(character, derived);
    setStatus(`Engine v${pack.version} loaded. Showing a sample sheet.`);
  } catch (err) {
    setStatus(`Boot failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error(err);
  }
};

boot();

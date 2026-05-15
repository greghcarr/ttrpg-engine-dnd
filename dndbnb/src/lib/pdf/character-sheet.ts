// Character-sheet PDF generator.
//
// Renders a single-page US-Letter PDF that mirrors what the read-only
// sheet shows: identity, the six ability scores with mods and saves,
// combat stats, spells, feats. The layout is hand-positioned (no
// external template) so we don't import any copyrighted PHB artwork
// or sheet design; this is just dndbnb's own printout of the engine's
// derived character view.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { ABILITY_SCORES, type AbilityScore, type Character, type DerivedCharacter, type ResolvedContent } from 'ttrpg-engine-dnd';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
// Lime-green accent matching dndbnb's UI. Used sparingly so the sheet
// still prints readable on black-and-white.
const ACCENT = rgb(0.31, 0.63, 0.13);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.75, 0.75, 0.75);

const ABILITY_LABEL: Readonly<Record<AbilityScore, string>> = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
};

const formatMod = (mod: number): string => (mod >= 0 ? `+${mod}` : `${mod}`);

const titleCase = (s: string): string =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export interface SheetPdfInput {
  readonly character: Character;
  readonly derived: DerivedCharacter;
  readonly content: ResolvedContent;
}

export const generateCharacterSheetPdf = async (
  input: SheetPdfInput,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.character.name} - dndbnb character sheet`);
  doc.setCreator('dndbnb');
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts = {
    body: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  let cursorY = PAGE_HEIGHT - MARGIN;
  cursorY = drawHeader(page, fonts, input, cursorY);
  cursorY -= 12;
  cursorY = drawMetaRow(page, fonts, input, cursorY);
  cursorY -= 16;

  const colTop = cursorY;
  const colGap = 12;
  const colWidth = (PAGE_WIDTH - 2 * MARGIN - 2 * colGap) / 3;
  const leftX = MARGIN;
  const midX = leftX + colWidth + colGap;
  const rightX = midX + colWidth + colGap;

  const afterAbilities = drawAbilities(page, fonts, input, leftX, colTop, colWidth);
  const afterCombat = drawCombatStats(page, fonts, input, midX, colTop, colWidth);
  const afterSpells = drawSpellsBlock(page, fonts, input, rightX, colTop, colWidth);

  const lowestY = Math.min(afterAbilities, afterCombat, afterSpells);
  let footerY = lowestY - 16;
  footerY = drawFeatsAndLanguages(page, fonts, input, MARGIN, footerY, PAGE_WIDTH - 2 * MARGIN);

  drawFooter(page, fonts, footerY);
  return doc.save();
};

// ---- Layout primitives ----------------------------------------------------

interface Fonts {
  readonly body: PDFFont;
  readonly bold: PDFFont;
}

const drawHeader = (
  page: PDFPage,
  fonts: Fonts,
  input: SheetPdfInput,
  y: number,
): number => {
  const size = 22;
  page.drawText(input.character.name, {
    x: MARGIN,
    y: y - size,
    size,
    font: fonts.bold,
    color: INK,
  });
  return y - size - 4;
};

const drawMetaRow = (
  page: PDFPage,
  fonts: Fonts,
  input: SheetPdfInput,
  y: number,
): number => {
  const klass = input.character.classes
    .map((c) => `${titleCase(c.classId)} ${c.level}`)
    .join(' / ');
  const species = titleCase(input.character.speciesId);
  const background = titleCase(input.character.backgroundId);
  const line = `${klass}  |  ${species}  |  ${background}  |  Level ${input.derived.totalLevel}`;
  page.drawText(line, {
    x: MARGIN,
    y: y - 10,
    size: 10,
    font: fonts.body,
    color: MUTED,
  });
  return y - 14;
};

const drawSectionTitle = (
  page: PDFPage,
  fonts: Fonts,
  text: string,
  x: number,
  y: number,
  width: number,
): number => {
  page.drawText(text.toUpperCase(), {
    x,
    y: y - 10,
    size: 9,
    font: fonts.bold,
    color: ACCENT,
  });
  page.drawLine({
    start: { x, y: y - 14 },
    end: { x: x + width, y: y - 14 },
    thickness: 0.75,
    color: ACCENT,
  });
  return y - 20;
};

const drawAbilities = (
  page: PDFPage,
  fonts: Fonts,
  input: SheetPdfInput,
  x: number,
  yTop: number,
  width: number,
): number => {
  let y = drawSectionTitle(page, fonts, 'Ability scores', x, yTop, width);
  const rowH = 32;
  for (const ab of ABILITY_SCORES) {
    const score = input.character.abilityScores[ab];
    const mod = input.derived.abilityModifiers[ab];
    const save = input.derived.savingThrows[ab];
    drawAbilityRow(page, fonts, ab, score, mod, save.total, x, y, width, rowH);
    y -= rowH + 4;
  }
  return y;
};

const drawAbilityRow = (
  page: PDFPage,
  fonts: Fonts,
  ab: AbilityScore,
  score: number,
  mod: number,
  saveTotal: number,
  x: number,
  yTop: number,
  width: number,
  rowH: number,
): void => {
  // Score box on the left
  const boxSize = rowH;
  page.drawRectangle({
    x,
    y: yTop - boxSize,
    width: boxSize,
    height: boxSize,
    borderColor: LINE,
    borderWidth: 0.5,
  });
  const scoreText = String(score);
  const scoreWidth = fonts.bold.widthOfTextAtSize(scoreText, 16);
  page.drawText(scoreText, {
    x: x + (boxSize - scoreWidth) / 2,
    y: yTop - boxSize / 2 - 1,
    size: 16,
    font: fonts.bold,
    color: INK,
  });
  const modText = formatMod(mod);
  const modWidth = fonts.body.widthOfTextAtSize(modText, 9);
  page.drawText(modText, {
    x: x + (boxSize - modWidth) / 2,
    y: yTop - boxSize + 4,
    size: 9,
    font: fonts.body,
    color: MUTED,
  });

  // Label + save to the right of the box
  const textX = x + boxSize + 8;
  page.drawText(ABILITY_LABEL[ab], {
    x: textX,
    y: yTop - 14,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  page.drawText(`Save ${formatMod(saveTotal)}`, {
    x: textX,
    y: yTop - 26,
    size: 9,
    font: fonts.body,
    color: MUTED,
  });
};

const drawCombatStats = (
  page: PDFPage,
  fonts: Fonts,
  input: SheetPdfInput,
  x: number,
  yTop: number,
  width: number,
): number => {
  let y = drawSectionTitle(page, fonts, 'Combat', x, yTop, width);
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['Armor Class', String(input.derived.ac.total)],
    [
      'Hit Points',
      `${input.character.hp.current} / ${input.derived.effectiveHpMax}` +
        (input.character.hp.temp > 0 ? ` (+${input.character.hp.temp} temp)` : ''),
    ],
    ['Speed', `${input.character.speedFeet} ft`],
    ['Proficiency Bonus', formatMod(input.derived.proficiencyBonus)],
    ['Initiative', formatMod(input.derived.abilityModifiers.DEX)],
    ['Hit Dice', formatHitDice(input.character, input.content)],
  ];
  y = drawKeyValueList(page, fonts, rows, x, y, width);

  // Spell slots, if any
  const slots = input.derived.spellSlots.slotsByLevel;
  const hasSlots = slots.some((n, i) => i > 0 && n > 0);
  const hasPact = !!input.derived.spellSlots.pactSlots;
  if (hasSlots || hasPact) {
    y -= 8;
    y = drawSectionTitle(page, fonts, 'Spell slots', x, y, width);
    const slotRows: Array<readonly [string, string]> = [];
    slots.forEach((count, level) => {
      if (level > 0 && count > 0) slotRows.push([`Level ${level}`, String(count)]);
    });
    if (input.derived.spellSlots.pactSlots) {
      const ps = input.derived.spellSlots.pactSlots;
      slotRows.push([`Pact (Lv ${ps.level})`, String(ps.count)]);
    }
    y = drawKeyValueList(page, fonts, slotRows, x, y, width);
  }
  return y;
};

const formatHitDice = (character: Character, content: ResolvedContent): string => {
  return character.classes
    .map((enr) => {
      const cls = content.classes.get(enr.classId);
      return `${enr.hitDiceRemaining}d${cls?.hitDie ?? '?'}`;
    })
    .join(' + ');
};

const drawKeyValueList = (
  page: PDFPage,
  fonts: Fonts,
  rows: ReadonlyArray<readonly [string, string]>,
  x: number,
  yTop: number,
  width: number,
): number => {
  let y = yTop;
  const rowH = 13;
  for (const [k, v] of rows) {
    page.drawText(k, { x, y: y - 9, size: 9, font: fonts.body, color: MUTED });
    const vSize = 10;
    const vWidth = fonts.bold.widthOfTextAtSize(v, vSize);
    page.drawText(v, {
      x: x + width - vWidth,
      y: y - 9,
      size: vSize,
      font: fonts.bold,
      color: INK,
    });
    y -= rowH;
  }
  return y;
};

const drawSpellsBlock = (
  page: PDFPage,
  fonts: Fonts,
  input: SheetPdfInput,
  x: number,
  yTop: number,
  width: number,
): number => {
  if (input.character.preparedSpells.length === 0 && input.character.knownSpells.length === 0) {
    let y = drawSectionTitle(page, fonts, 'Spells', x, yTop, width);
    page.drawText('No spells.', { x, y: y - 9, size: 9, font: fonts.body, color: MUTED });
    return y - 18;
  }
  let y = drawSectionTitle(page, fonts, 'Spells', x, yTop, width);
  // Group by level using the content map.
  const byLevel = new Map<number, string[]>();
  for (const id of input.character.preparedSpells) {
    const spell = input.content.spells.get(id);
    const level = spell?.level ?? -1;
    const name = spell?.name ?? id;
    const list = byLevel.get(level) ?? [];
    list.push(name);
    byLevel.set(level, list);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  for (const level of levels) {
    const heading = level === 0 ? 'Cantrips' : `Level ${level}`;
    page.drawText(heading, { x, y: y - 9, size: 9, font: fonts.bold, color: INK });
    y -= 12;
    const names = byLevel.get(level)!.sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      y = drawWrappedLine(page, fonts.body, `• ${name}`, x + 8, y, width - 8, 9, INK);
    }
    y -= 4;
  }
  return y;
};

const drawFeatsAndLanguages = (
  page: PDFPage,
  fonts: Fonts,
  input: SheetPdfInput,
  x: number,
  yTop: number,
  width: number,
): number => {
  let y = drawSectionTitle(page, fonts, 'Feats & languages', x, yTop, width);
  const feats =
    input.character.featsTaken.length === 0
      ? 'None'
      : input.character.featsTaken.map(titleCase).join(', ');
  const langs =
    input.derived.knownLanguages.length === 0
      ? 'None'
      : input.derived.knownLanguages.map(titleCase).join(', ');
  page.drawText('Feats', { x, y: y - 9, size: 9, font: fonts.bold, color: MUTED });
  y = drawWrappedLine(page, fonts.body, feats, x + 38, y, width - 38, 10, INK);
  y -= 4;
  page.drawText('Languages', { x, y: y - 9, size: 9, font: fonts.bold, color: MUTED });
  y = drawWrappedLine(page, fonts.body, langs, x + 60, y, width - 60, 10, INK);
  return y;
};

const drawFooter = (page: PDFPage, fonts: Fonts, y: number): void => {
  const text = 'generated by dndbnb';
  page.drawText(text, {
    x: MARGIN,
    y: MARGIN / 2,
    size: 8,
    font: fonts.body,
    color: MUTED,
  });
  // Suppress unused param warning while keeping a stable footer signature.
  void y;
};

// Wraps `text` to fit `width` at the given size and draws each line.
// Returns the y position after the last line.
const drawWrappedLine = (
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yTop: number,
  width: number,
  size: number,
  color: ReturnType<typeof rgb>,
): number => {
  const lineH = size + 3;
  const words = text.split(' ');
  let line = '';
  let y = yTop;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    page.drawText(line, { x, y: y - size, size, font, color });
    y -= lineH;
    line = word;
  }
  if (line) {
    page.drawText(line, { x, y: y - size, size, font, color });
    y -= lineH;
  }
  return y;
};

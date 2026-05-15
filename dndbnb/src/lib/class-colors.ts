// Per-class accent palette inspired by World of Warcraft's class
// colors. Used as inline-style `--accent` overrides on the routes that
// view or edit a single character (Sheet, Edit, Creator). The rest of
// the site stays monochrome via the defaults in styles.css.
//
// Each entry is a (bg, fg) pair so buttons and pills that use the
// accent as a background still have readable text. The fg is chosen
// near-black for light-saturated accents and near-white for darker /
// more saturated ones.
//
// Classes that don't exist in WoW (Barbarian, Bard, Sorcerer) get
// stand-ins picked to fit the class theme: rage red for Barbarian,
// magnetic pink for Bard, electric royal blue for Sorcerer's innate
// arcane lineage (distinct from Wizard's pale-sky mage blue).
// Cleric inherits Priest white; Paladin gets a gold tone instead of
// WoW's pink (which we use for Bard). Anything not in the map
// (homebrew classes, future content packs) falls back to deep purple.

export interface ClassColor {
  readonly bg: string;
  readonly fg: string;
}

const CLASS_COLORS: Readonly<Record<string, ClassColor>> = {
  barbarian: { bg: '#C41E3A', fg: '#fdf5f7' },
  bard: { bg: '#F48CBA', fg: '#1a0a13' },
  cleric: { bg: '#DCDCE0', fg: '#16161a' },
  druid: { bg: '#FF7C0A', fg: '#1a0d00' },
  fighter: { bg: '#C69B6D', fg: '#1a1108' },
  monk: { bg: '#00C97A', fg: '#001a0e' },
  paladin: { bg: '#E5C16C', fg: '#1a1305' },
  ranger: { bg: '#AAD372', fg: '#0e1a05' },
  rogue: { bg: '#E8D14B', fg: '#1a1500' },
  sorcerer: { bg: '#2E5CDB', fg: '#f0f5ff' },
  warlock: { bg: '#9482C9', fg: '#f5f3ff' },
  wizard: { bg: '#3FC7EB', fg: '#001a20' },
};

export const CUSTOM_CLASS_COLOR: ClassColor = { bg: '#A330C9', fg: '#fbf5ff' };

export const getClassColor = (classId: string | undefined | null): ClassColor => {
  if (!classId) return CUSTOM_CLASS_COLOR;
  return CLASS_COLORS[classId] ?? CUSTOM_CLASS_COLOR;
};

// React inline-style helper. Use as:
//   <div style={classColorVars(classId)}>...</div>
// CSS custom properties cascade, so every child element that uses
// var(--accent) / var(--accent-fg) picks up the class color
// automatically without per-element wiring.
export const classColorVars = (
  classId: string | undefined | null,
): React.CSSProperties => {
  const c = getClassColor(classId);
  return {
    ['--accent' as string]: c.bg,
    ['--accent-fg' as string]: c.fg,
  } as React.CSSProperties;
};

# SRD 5.2.1 magic item audit

Audit of the 138 magic items in [src/content/packs/starter-pack.json](../src/content/packs/starter-pack.json) against the SRD 5.2.1 magic-item catalog. Companion to the monster audit at [docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md).

Source of truth for the SRD text is `references/SRD_CC_v5.2.1.pdf` (gitignored); the markdown fork at `references/srd-markdown/magic-items.md` was spot-checked against the PDF at the start of the monster audit and is faithful.

## Status counts

| Status | Count | Action |
|---|---|---|
| `exact-match` (case-insensitive name match) | 98 | none |
| `srd-variant` (pack ships a granular variant of a grouped SRD entry) | 21 | none; pack format is finer than SRD presentation |
| `srd-name-variant` (pack ships a slightly different SRD-canonical name) | 3 | none; pack names are acceptable variants |
| `non-srd-5.2.1` | 16 | drop |
| **Total** | **138** | |

Post-slice-150 pack count: 138 − 16 = **122 magic items**, all SRD 5.2.1-derived.

## Drop list (16 items)

Per the SRD 5.2.1 standardization directive (drop, don't relocate), these are removed from starter-pack.json:

| Pack id | Pack name | Source |
|---|---|---|
| `cap-of-water-breathing` | Cap of Water Breathing | 2014 MM (not in SRD 5.2.1) |
| `cloak-of-billowing` | Cloak of Billowing | XGE cosmetic |
| `cloak-of-many-fashions` | Cloak of Many Fashions | XGE cosmetic |
| `clothes-of-mending` | Clothes of Mending | XGE cosmetic |
| `deck-of-many-things` | Deck of Many Things | DMG (name-only ship; card text never bundled) |
| `driftglobe` | Driftglobe | XGE / DMG (not in SRD 5.2.1) |
| `ear-horn-of-hearing` | Ear Horn of Hearing | XGE cosmetic |
| `hat-of-vermin` | Hat of Vermin | XGE cosmetic |
| `mystery-key` | Mystery Key | XGE cosmetic |
| `pole-of-angling` | Pole of Angling | XGE cosmetic |
| `rod-of-the-pact-keeper-plus-1` | Rod of the Pact Keeper, +1 | XGE / TCE (not in SRD 5.2.1) |
| `shield-of-expression` | Shield of Expression | XGE cosmetic |
| `smoldering-armor` | Smoldering Armor | DMG cursed armor |
| `staff-of-the-adder` | Staff of the Adder | DMG |
| `tankard-of-sobriety` | Tankard of Sobriety | XGE cosmetic |
| `wand-of-pyrotechnics` | Wand of Pyrotechnics | XGE / DMG |

The four items currently in the `withChargesIds` snapshot (Driftglobe, Rod of the Pact Keeper +1, Staff of the Adder, Wand of Pyrotechnics) are removed from the snapshot in the same slice; no other test references any of the 16 ids.

## Variant unrolls (no action)

Pack ships granular variants of SRD entries that the SRD presents as combined. These are SRD-derived; the pack's finer breakdown is a content-modeling choice, not a divergence.

| Pack entries | SRD canonical |
|---|---|
| Armor, +1 / +2 / +3 | "Armor, +1, +2, or +3" |
| Weapon, +1 / +2 / +3 | "Weapon, +1, +2, or +3" |
| Belt of Cloud / Fire / Frost / Hill / Stone / Storm Giant Strength | "Belt of Giant Strength" (lists all 6 variants in body) |
| Ioun Stone, Agility / Awareness / Fortitude / Insight / Intellect / Leadership / Protection / Strength | "Ioun Stone" (lists 15+ variants in body) |
| Quaal's Feather Token, Anchor | "Feather Token" (lists 6 variants in body) |

## Audit fields and caveats

The script compares pack item names against SRD 5.2.1's H4 magic-item entries (`#### Name`), case-insensitive, with the variant-grouping rules above applied manually. It does **not** verify:

- Rarity drift (pack `rarity` vs SRD listed rarity in the item body)
- Attunement drift (pack `requiresAttunement` vs SRD "Requires Attunement" tag)
- Effect / charges / mechanical encodings (pack `effects` array vs SRD body text)

These secondary-field checks can run as a follow-up audit using the same scripted pattern.

## Re-running the audit

```bash
# pack names
jq -r '.items[] | select(.itemKind == "magic") | .name' src/content/packs/starter-pack.json | sort > /tmp/pack-items.txt

# SRD names (skip structural subsections within item entries)
grep -E "^#### " references/srd-markdown/magic-items.md \
  | grep -vE "^#### (Spells Cast from Items|Charges|Spells|Conflict|Magic Item Values by Rarity|Command Word|Consumable Items|Arcana Proficiency|Tools|Abilities|Alignment|Communication|Senses|Traits|Actions)$" \
  | sed 's/^#### //' | sort > /tmp/srd-items.txt

# diff
comm -23 <(tr '[:upper:]' '[:lower:]' < /tmp/pack-items.txt) \
         <(tr '[:upper:]' '[:lower:]' < /tmp/srd-items.txt)
```

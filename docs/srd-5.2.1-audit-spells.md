# SRD 5.2.1 spell audit

Audit of the spells shipped in [src/content/packs/starter-pack.json](../src/content/packs/starter-pack.json) against the SRD 5.2.1 spell catalog. Companion to the monster audit at [docs/srd-5.2.1-audit.md](srd-5.2.1-audit.md) and the magic-item audit at [docs/srd-5.2.1-audit-items.md](srd-5.2.1-audit-items.md).

Source of truth for the SRD text is `references/SRD_CC_v5.2.1.pdf` (gitignored); the markdown fork at `references/srd-markdown/spells.md` was spot-checked against the PDF at the start of the monster audit and is faithful.

## Status counts (pre-slice-151, 400 spells)

| Status | Count | Action |
|---|---|---|
| `exact-match` (case-insensitive name match) | 309 | none |
| `named-mage rename` (Bigby's Hand to Arcane Hand etc.) | 15 | rename id and/or name to SRD 5.2.1 canonical |
| `wired non-SRD` (has dedicated planner or test file beyond spell-coverage) | 12 | **keep** as documented non-SRD-with-engine-investment |
| `schema-only non-SRD` (only consumed by generic cast-spell + spell-coverage iteration) | 64 | **drop** |
| **Total** | **400** | |

Post-slice-151 spell count: 400 − 64 = **336**, of which 324 are SRD 5.2.1-derived (309 exact + 15 renamed) and 12 are documented post-PHB content with engine wiring.

## Policy: keep wired, drop schema-only

The user chose the "wired criterion" policy for this audit (option 3 in the slice 151 plan). The rationale: engine work represents substantial investment in mechanical primitives that frequently get exercised by other features. Schema-only spells are JSON data consumed by the generic `planCastSpell` pipeline; deleting them costs nothing beyond the data itself.

Specifically:
- **Wired** = has a dedicated planner file under `src/engine/plan/` OR has at least one test file (other than `spell-coverage.test.ts`) that references the spell id.
- **Schema-only** = only mentioned in `spell-coverage.test.ts` (the coverage matrix that iterates every pack spell) and consumed by the generic cast-spell planner. Nothing engine-specific.

## Bucket 1: rename (15 entries)

10 id+name renames + 5 name-only renames (where the pack id was already the SRD canonical but the display name kept the 2014 wizard-prefix).

| Old (pack) | New (SRD 5.2.1) | Change |
|---|---|---|
| `bigbys-hand` (Bigby's Hand) | `arcane-hand` (Arcane Hand) | id + name |
| `drawmijs-instant-summons` (Drawmij's Instant Summons) | `instant-summons` (Instant Summons) | id + name |
| `leomunds-tiny-hut` (Leomund's Tiny Hut) | `tiny-hut` (Tiny Hut) | id + name |
| `melfs-acid-arrow` (Melf's Acid Arrow) | `acid-arrow` (Acid Arrow) | id + name |
| `mordenkainens-magnificent-mansion` (Mordenkainen's Magnificent Mansion) | `magnificent-mansion` (Magnificent Mansion) | id + name |
| `mordenkainens-sword` (Mordenkainen's Sword) | `arcane-sword` (Arcane Sword) | id + name |
| `nystuls-magic-aura` (Nystul's Magic Aura) | `arcanists-magic-aura` (Arcanist's Magic Aura) | id + name |
| `ottos-irresistible-dance` (Otto's Irresistible Dance) | `irresistible-dance` (Irresistible Dance) | id + name |
| `rarys-telepathic-bond` (Rary's Telepathic Bond) | `telepathic-bond` (Telepathic Bond) | id + name |
| `tashas-hideous-laughter` (Tasha's Hideous Laughter) | `hideous-laughter` (Hideous Laughter) | id + name |
| `black-tentacles` (Evard's Black Tentacles) | `black-tentacles` (Black Tentacles) | name only |
| `faithful-hound` (Mordenkainen's Faithful Hound) | `faithful-hound` (Faithful Hound) | name only |
| `private-sanctum` (Mordenkainen's Private Sanctum) | `private-sanctum` (Private Sanctum) | name only |
| `resilient-sphere` (Otiluke's Resilient Sphere) | `resilient-sphere` (Resilient Sphere) | name only |
| `secret-chest` (Leomund's Secret Chest) | `secret-chest` (Secret Chest) | name only |

## Bucket 2: wired non-SRD keepers (12 entries)

Pack ships these post-PHB (XGE / TCE) spells because the engine has substantial investment in their mechanics: dedicated planners, dedicated test files, or both. They remain in the pack with content-attribution.md noting they fall outside SRD 5.2.1.

| Spell id | Engine investment |
|---|---|
| `absorb-elements` | `reactive-spells.ts` planner + dedicated tests |
| `armor-of-agathys` | Dedicated tests exercising the temp-HP + retaliation rider mechanic |
| `blade-ward` | Dedicated test using buff condition shape |
| `cause-fear` | Tests exercising source-predicate save-vs-condition |
| `cloud-of-daggers` | Tests exercising area-damage tick |
| `cordon-of-arrows` | Tests exercising trap shape |
| `crusaders-mantle` | Tests exercising aura damage rider |
| `elemental-weapon` | Dedicated planner + tests |
| `hunger-of-hadar` | Tests exercising area-damage tick + entry-save mechanic |
| `spirit-shroud` | Tests exercising concentration-cleanup riders + heal-blocked condition |
| `summon-beast` | Tests exercising the summon system |
| `thunder-step` | Dedicated planner in `movement.ts` + dedicated tests |

## Bucket 3: drop list (64 entries)

Schema-only post-PHB spells. Consumed only by the generic `planCastSpell` pipeline; only test reference is the `spell-coverage.test.ts` coverage matrix iteration. Removed from pack + from `SPELL_EXPECTATIONS`.

arcane-gate, aura-of-purity, aura-of-vitality, blinding-smite, branding-smite, circle-of-power, compelled-duel, crown-of-madness, crown-of-stars, destructive-wave, dream-of-the-blue-veil, dust-devil, earth-tremor, earthbind, elemental-bane, far-step, feeblemind, feign-death, friends, frostbite, hail-of-thorns, holy-weapon, investiture-of-flame, investiture-of-ice, investiture-of-stone, investiture-of-wind, invulnerability, lightning-arrow, maddening-darkness, mass-polymorph, mind-sliver, mold-earth, power-word-pain, psychic-scream, ravenous-void, skywrite, soul-cage, steel-wind-strike, summon-aberration, summon-celestial, summon-construct, summon-draconic-spirit, summon-elemental, summon-fey, summon-fiend, summon-greater-demon, summon-lesser-demons, summon-shadowspawn, summon-undead, swift-quiver, synaptic-static, tashas-otherworldly-guise, telepathy, tensers-transformation, thorn-whip, thunderclap, thunderous-smite, time-ravage, toll-the-dead, wall-of-light, watery-sphere, whirlwind, word-of-radiance, wrathful-smite.

## Audit fields and caveats

The audit covered spell names (case-insensitive against SRD H4 entries in `references/srd-markdown/spells.md`) and the variant/rename mapping. It does **not** verify:

- Spell level (pack `level` vs SRD level)
- Casting time, range, duration, components (pack vs SRD)
- Damage / save / scaling specifics (pack `mechanicalEffects` vs SRD body text)

A follow-up audit could apply the same scripted pattern to those secondary fields.

## Re-running the audit

```bash
# pack names
jq -r '.spells[].name' src/content/packs/starter-pack.json | sort > /tmp/pack-spells.txt

# SRD names
grep -E "^#### " references/srd-markdown/spells.md \
  | grep -vE "^#### (Actions?|Reactions?|Bonus Actions?|Traits?|Spellcasting|Multiattack|Higher.Level Spell Slot)$" \
  | sed 's/^#### //' | sort -u > /tmp/srd-spells.txt

# diff (case-insensitive)
comm -23 <(tr '[:upper:]' '[:lower:]' < /tmp/pack-spells.txt | sort -u) \
         <(tr '[:upper:]' '[:lower:]' < /tmp/srd-spells.txt | sort -u)
```

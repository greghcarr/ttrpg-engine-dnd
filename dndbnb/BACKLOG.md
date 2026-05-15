# dndbnb backlog

Known gaps surfaced at slice close, plus a feature inventory against D&D Beyond's surface. Each entry says what's missing, why it was deferred (when known), and where the workaround lives in code. Not a roadmap, pick from this when a related slice is being worked or whenever it's the right time. Things move to commits, not off the list.

The goal is parity with D&D Beyond on what a free-tier hobby player would actually use. Marketplace / paid sourcebook / native-app items live in the "Probably out of scope" section.

## Creator

- **No subclass picker.** Most 2024 PHB classes pick subclass at level 3 (a few at 1). Adding it needs the engine's class content to expose subclass options per class. Lives near [dndbnb/src/components/creator/Steps.tsx](src/components/creator/Steps.tsx).
- **No starting-equipment selection.** Class + background grant starting equipment options; the wizard skips this. Engine character is built with an empty `inventory`. Needs the class schema to surface starting-equipment options.
- **Class L1 spell counts hardcoded in dndbnb.** [dndbnb/src/lib/creator/spell-rules.ts](src/lib/creator/spell-rules.ts) carries the cantrips-known / spells-prepared table because the engine's class schema doesn't model it. When Phase E of the engine fills out class progression, move this into the content pack and read it through `ResolvedContent`.
- **No skill / tool / language picker.** Class typically grants N skill choices from a list, plus additional languages and tool proficiencies; today the creator only takes the background's defaults.
- **No identity step beyond name.** Missing: alignment, gender, age, height, weight, hair / eyes / skin, faith / deity, allies & organizations, personality traits, ideals, bonds, flaws, backstory (multi-paragraph rich text).
- **No character portrait / avatar.** Image upload would need a Supabase Storage bucket with moderation on the image too (out of scope for v1, but worth scoping).
- **No multiclassing.** Engine supports multiple class enrollments via `character.classes`; the creator only emits one.
- **No variant-rule toggles.** Custom origins (decoupled species ability bonuses), feat-at-1 variants, hero points, etc., are engine-side flags with no UI surface.

## Sheet (during play, currently read-only)

- **Sheet is read-only.** No way to mutate state after creation. The list below names the specific mutations the engine supports today and that the sheet should expose.
- **HP edits.** Take damage, heal, set current, gain temp HP, clear temp.
- **Death saves UI.** Roll, succeed, fail, stabilize. Engine has all the events; the sheet shows none of them.
- **Condition tracker.** Apply / remove conditions (poisoned, prone, blinded, restrained, exhaustion levels, etc.). Engine has condition handling.
- **Concentration tracker.** Display + break-on-damage prompt.
- **Spell slot tracking.** Mark slots used / restored; current sheet shows totals but not usage.
- **Class resource tracking.** Rage, ki, channel divinity, bardic inspiration, arcane recovery, lay on hands, sorcery points, second wind, action surge, etc. Engine models these via `resources`; sheet shows nothing.
- **Action economy.** Action / bonus action / reaction / movement remaining this turn. Engine tracks per-turn / per-round; sheet doesn't surface it.
- **Inspiration.** Boolean grant + spend.
- **Hit dice spent / available.** Recover on long rest.
- **Short rest + long rest buttons.** Engine has both; sheet has neither.
- **Inline dice rolls from the sheet.** Click an attack / save / ability mod / skill / spell damage to roll it. Engine's plan/commit RNG capture is the right substrate; the sheet should call the planners.
- **Roll history per character.** Last N rolls displayed in a panel; engine emits resolution events, persistence is the only missing piece.
- **Notes / journal per character.** Free-form text the player writes about their character outside the engine's narrative event log.
- **Custom modifiers.** Player-added adjustments (e.g. "+1 to AC from a magic cloak you DM'd into existence"). Engine has effect primitives; needs a UI for ad-hoc entries.
- **Species speed not reflected.** Sheet reads `character.speedFeet` directly, which schema-defaults to 30 even when species traits should bump it. Needs a `derivedSpeed` field on `DerivedCharacter`.

## Inventory & equipment

- **No inventory UI.** Add / remove / move items, with engine `ItemInstance` rows. Today every character has an empty inventory.
- **Equip / unequip slots.** Main hand, off hand, armor, shield, attuned (max 3).
- **Attunement tracking.** Magic item attunement state with a 3-cap. Engine has `equipped.attuned` array.
- **Currency tracking.** cp / sp / ep / gp / pp, with party-shared currency too (engine has both). Add / spend / convert.
- **Encumbrance / carrying capacity.** Optional rule; engine has weight on items.
- **Magic item charge tracking.** Engine has charge resources; sheet shows nothing.

## Spellcasting (during play)

- **Spell preparation editor.** Swap prepared spells on long rest (most prepared casters); add / remove from the known list (sorcerer, warlock, bard, ranger).
- **Spellbook view (wizard).** Distinct list of known + prepared; copy spells from scrolls; transcribe at higher cost.
- **Cast button.** Click a spell, pick a slot level, target, roll. Engine has spell planners.
- **Concentration management.** Casting a concentration spell breaks the previous one; sheet should warn.
- **Ritual casting toggle** for rituals.
- **Spell DC + spellcasting attack mod** displayed. Engine derives them; sheet doesn't show.

## PDF export

- **Static, not fillable.** Generated PDF is read-only. If a printable blank sheet is wanted later, that's a separate generator.
- **Same speed bug as the sheet.** Shows 30ft regardless of species.
- **No equipment block.** Mirrors the sheet gap.
- **One-page only.** No multi-page layout, no spell card sheet, no inventory sheet.

## Public list / favorites / clone

- **No "report this" on public characters.** If the moderation trigger misses something, there's no surfacing path. Adding a `character_reports` table + a count on the row + a hidden-once-N-reports filter is the minimal flow.
- **Favorites store is single-tab.** [dndbnb/src/lib/favorites.ts](src/lib/favorites.ts) loads once on sign-in and never re-syncs. If you favorite something on tab A, tab B doesn't see it until refresh. Fix: subscribe to a Supabase Realtime channel on `favorites` filtered to `user_id = me`.
- **No search / filter on browse.** Today's list is just "most recently updated"; no filter by class, level, species, public-only by tag, etc.
- **No tags / categories on characters.** Owners can't classify their own builds (e.g. "tank", "support", "newbie-friendly").
- **No "draft" vs "finished" state.** A character is created or it isn't; no way to mark a build as a work-in-progress.

## Campaigns

- **No edit-campaign UI.** Owners can update name / description via direct SQL or the API but not via the page. Form on `/campaigns/:id` is the obvious add.
- **No kick-member button.** [supabase/migrations/0003_campaigns.sql](../supabase/migrations/0003_campaigns.sql) RLS allows owners to delete any membership row; the UI doesn't expose it.
- **One campaign per character.** `characters.campaign_id` is a single FK, not a join table. Real D&D Beyond allows many; revisit when there's a concrete need.
- **No online / last-seen indicator on the roster.** Will fall out of the realtime feed slice once presence channels are wired.
- **No realtime feed of party actions.** The roadmap goal: in-campaign roll / damage / cast events stream to every member. Supabase Realtime on a per-campaign channel is the substrate.
- **No campaign log / session notes.** Long-form GM notes per session, optional player visibility.
- **No handouts.** DM uploads an image / document / map snippet and assigns it to specific players.
- **No party HP / status dashboard for the DM.** Quick read of every party member's HP, conditions, slots used.
- **No shared dice rolls.** Player rolls visible to other party members in real time.
- **No group rolls / "everyone roll perception".**

## DM tools / "serious play" mode

- **DM dashboard route.** Single page showing every player's vitals, action economy state, spell slot usage.
- **Encounter builder.** Compose monsters + NPCs into a saveable encounter with difficulty estimate.
- **Combat tracker.** Initiative order, turn pointer, HP per combatant, conditions, AC reference, action economy clock.
- **Initiative roll for the table.** Group roll of d20+DEX per combatant.
- **NPC roster.** Per-campaign list of named NPCs the DM can summon into a scene.
- **Quick monster lookup.** Search the compendium mid-session, drop a statblock into the tracker.
- **Restrict movement / lock state.** DM gates what players can change (mentioned in the long-term vision: parked under Phase 5).
- **Undo master state.** Engine has undo/redo + event log; DM should be able to see + revert.
- **Full event log surface.** Read-only feed of every event in the campaign for debug / forensics.
- **Award XP.** Manual or milestone-based, with a roll-up display.

## Compendium / rules reference

- **No browser at all.** No way to look up a spell, item, monster, feat, condition, background, species, class feature without opening the JSON pack.
- **Spell browser.** Filter by class, level, school, casting time, components, ritual, concentration.
- **Item browser.** Weapons, armor, magic items, gear. Filter by type, rarity, attunement.
- **Monster browser.** Filter by CR, type, environment, size.
- **Conditions reference.** Glossary view, linked from condition badges on the sheet.
- **Class feature reference.** Per-class progression table, full text for every level's features.
- **Feats reference.** Searchable by category (origin / general / fighting style / epic boon).
- **Glossary / rules search.** "What does shove do?", "How does cover work?" type lookups.
- **Linkable references.** `[spell:fireball]` shortcodes in notes / journal that expand to live links.

## Homebrew

- **No homebrew authoring.** Custom species, classes, subclasses, feats, items, monsters, spells. Engine's content packs are the substrate; needs a UI to edit + validate + save.
- **No "import pack" surface.** Today the only pack is the wired starter pack; no way to upload one or pick one per campaign.
- **No public homebrew sharing.** D&D Beyond's biggest non-marketplace draw. Needs moderation, version pinning per character, a popularity / rating signal.

## Profile & social

- **No profile pages.** `/u/alice` showing alice's public characters, favorites count, campaigns they DM, etc.
- **No follow / subscribe.** "Get notified when this user publishes a new character."
- **No notifications surface.** Campaign invites, "your DM tagged you", roll mentions.
- **No DM rating / reviews.** Long-tail nice-to-have.

## Identity / auth

- **No password reset.** Username-only model with synthetic `@dndbnb.invalid` emails means no email-link reset is possible. A non-email recovery flow (security questions, recovery code, admin-issued reset) is unbuilt.
- **No account deletion.** No self-serve way to delete an account + cascade their data.
- **No OAuth providers.** Discord / Google sign-in are common asks but bring their own moderation + email-collection considerations.

## Mobile / accessibility / platform

- **Mobile-responsive layout audit.** The current CSS works on desktop; touch targets, breakpoints, gesture density haven't been thought through.
- **Native app.** D&D Beyond ships iOS + Android. We're web-only by design, but a PWA installable shortcut would be the cheap version.
- **Accessibility audit.** Keyboard nav through the creator, screen-reader labels on the sheet, focus order on modals once we have any.
- **Internationalization.** Strings are English-only; no i18n layer.

## Infrastructure

- **Bundle is monolithic.** Main JS bundle is ~630 KB / ~178 KB gzipped. pdf-lib is already lazy-loaded into its own chunk; route-level splitting (Creator, Browse, Campaigns) is the next lever if performance becomes a concern.
- **No dndbnb-level tests.** The engine has extensive unit + golden tests; dndbnb has none. Worth adding once any single piece of UI is load-bearing enough to regress.
- **Free-tier Supabase pauses after a week of inactivity.** Not actually hit yet. Mitigation when it bites: a tiny GitHub Actions cron that pings the project.
- **No analytics / error reporting.** A small Sentry or PostHog free tier would help triage real-user bugs.

## Engine-side asks (blocking dndbnb features)

- **Class content fill-out (Phase E).** Starting-equipment options, subclass options per class, cantrips-known / spells-prepared per level, prepared-spell list source (e.g. wizard spellbook).
- **`DerivedCharacter` extensions.** `derivedSpeed` including species + effect modifications; `derivedSpellDC` + `derivedSpellAttack`; pre-computed skill totals.
- **Phase B remainder.** Locations + maps (unblocks the future map system); quests + objectives + milestone XP.
- **Phase C combat fill-in.** Grapple / shove / hide, Counterspell / Dispel, full Weapon Mastery wiring, mounted combat, travel.
- **Magic item charges.** Engine has the resource shape; full DSL coverage in content packs is still in progress.
- **Spell mechanic primitives still missing.** Most L1 spells in the starter pack ship schema-only (`mechanicalEffects: []`) because they need primitives the engine doesn't yet model. The blockers grouped by what's needed:
  - **On-hit trigger system** (riders that fire on the next weapon hit): blocks `divine-favor`, `ensnaring-strike`, `hail-of-thorns`, `hex`, `searing-smite`, `thunderous-smite`, `wrathful-smite`. Smite-pattern spells in general.
  - **Reaction system** (cast as a reaction to a trigger event): blocks `absorb-elements`, `feather-fall`, `sanctuary`, plus future `silvery-barbs`, `shield`-as-spell.
  - **Area-effect spell mechanic** (zone with save on enter + ongoing condition / damage): blocks `entangle`, `grease`, plus future `cloudkill`, `wall-of-fire`, etc.
  - **Temp-HP grant as a spell mechanic** (current `heal` only writes to `current`): blocks `false-life`, `heroism`.
  - **Caster-chosen options at cast time** (damage type, spell variant): blocks `chromatic-orb`, `command` (per-word effects).
  - **Summon system** (companion / construct creature instance): blocks `find-familiar`, `unseen-servant`, plus future `conjure-animals`, etc.
  - **AC-buff condition** (flat AC bonus while a condition is active): blocks `shield-of-faith` and any future "+N AC" buff.
  - **Type-conditional buff** (advantage / disadvantage tied to creature type): blocks `protection-from-evil-and-good`.
  - **Pure-narrative L1s with no mechanical event** intentionally ship empty: `alarm`, `animal-friendship`, `comprehend-languages`, `create-or-destroy-water`, `detect-evil-and-good`, `detect-poison-and-disease`, `disguise-self`, `expeditious-retreat`, `fog-cloud`, `goodberry`, `jump`, `longstrider`, `purify-food-and-drink`, `silent-image`, `speak-with-animals`. Most are ritual / utility; they parse and load, they just don't emit anything.
  - **Already-planned-elsewhere:** `hunters-mark` has its own dedicated planner (concentration mark), so its `mechanicalEffects` stays empty by design. Same pattern as `shield`, `misty-step`, `counterspell`, `dispel-magic`, `identify`, `polymorph`.

## The long-tail visual ambition (parked until everything above)

- **Map system in 2D / 3D.** Tile-based map editor, JSON serialization, elevations, fog of war, dynamic lighting, NPCs / enemies as placed entities, free movement out of combat, action-economy-bounded movement in combat. The "HeroForge-style" character creator sits here too. Parked as Phase 6 of the original vision.

## Probably out of scope (not building these unless the project's purpose changes)

- **Paid sourcebook marketplace.** PHB / DMG / MM full text, adventure modules, etc. dndbnb sticks to SRD-licensed content via packs.
- **3D dice with sound.** Aesthetic, low product value.
- **Discord bot integration.** Surface gets thin fast.
- **Forge VTT / Roll20 integration.** Other VTTs exist already; we're not the bridge.
- **DM subscription tier / paywalled features.** This is a hobby project; nothing gates behind a fee.

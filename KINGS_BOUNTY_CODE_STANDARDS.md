# Kings Bounty — Code Standards

This document defines the engineering standards for the King's Bounty roblox-ts
codebase. It is a companion to `KINGS_BOUNTY_CANON.md` (game rules) and
`KINGS_BOUNTY_DOMAIN_LANGUAGE.md` (naming). When these three documents
conflict, canon wins on rules, domain wins on names, this document wins on
*how the code is written*.

---

## 1. Declarative Over Imperative

Write code that describes **what** the game is, not **how** to assemble it
step by step.

**Prefer:**
- Data tables / config maps that the runtime reads.
- Pure functions that transform inputs into outputs.
- One pass that builds a structure from a definition.

**Avoid:**
- Long procedural setup chains with hardcoded values inlined.
- Side-effectful builders that mutate shared state across many call sites.
- Branching trees that re-implement the same logic per case.

If you find yourself writing `if (id === "x") ... else if (id === "y") ...`
across multiple files, the answer is almost always a config map keyed by id.

---

## 2. Config-First (Content Management Approach)

Anything that **can change** — values, IDs, names, prices, cooldowns,
tier curves, item lists, NPC rosters, drop tables, UI strings, Roblox product
IDs — lives in `src/shared/config/` as a typed data table.

Code in `server/` and `client/` reads from those tables. It does **not**
hardcode the same value in a second place.

**Rules:**
- One canonical home per concept. Weapons live in `weapons.ts`. Poisons in
  `poisons.ts`. Game Pass IDs in `game-passes.ts`. Never duplicate.
- Cross-config references use **IDs**, never inlined copies. A Dev Product
  that grants a poison stores the poison's `id`; the poison definition is
  not repeated.
- Adding new content = adding one entry to one config file. If adding
  content requires editing logic files, the logic is not abstract enough.
- Config files are **data only** — no game logic, no side effects on import,
  no remote handlers. Helpers that *operate on* config (lookups, filters,
  derived lists) live next to the config and stay pure.

If a value appears as a magic number in logic code, it belongs in a config.

---

## 3. Refactor The Whole Stream

When a change is needed, fix it at the **right level** and propagate the fix
through every consumer. Do not patch the symptom downstream.

**Forbidden patterns ("slapstick fixes"):**

- Adding a narrow `if` at a call site to special-case one input when the
  underlying function should already handle it.
- Wrapping a buggy function in another function that "corrects" its output.
- Copy-pasting a function and tweaking 2 lines for a new use case.
- Catching an error and silently falling back to a default to make the
  symptom go away.
- Adding a flag parameter (`force: boolean`, `legacy: boolean`,
  `skipValidation: boolean`) to preserve old behaviour alongside new.

**Required approach:**

1. Find the actual source of the value / behaviour.
2. Change it there.
3. Update the type / signature if the shape changed.
4. Walk every call site and update them all in the same edit.
5. If two call sites genuinely need different behaviour, that's a sign the
   abstraction is wrong — split the function, don't branch inside it.

A refactor is finished when the codebase reads as if the new shape was
always there. Half-migrations (new path + legacy path coexisting) are not
acceptable unless explicitly scoped as a migration step with a follow-up.

---

## 4. Single Source Of Truth

Every fact in the system has exactly one home.

- Player state: `src/shared/player-state.ts` (server-authoritative, persisted).
- Inventory: built from weapon/poison/elixir configs; never hand-maintained.
- UI theme: `src/shared/ui-theme.ts`. Never inline a hex or RGB.
- Rarity colours: `RARITY_COLORS` in `shared/inventory.ts`.
- Roblox product IDs: `game-passes.ts` and `dev-products.ts` only.

If you need a value somewhere, **import it**. If the value doesn't exist yet,
add it to its canonical home and import from there.

---

## 5. Types Are Not Optional

This is roblox-**ts**. We use the type system.

- Define an `interface` or `type` for every structured value (configs,
  payloads, remote arguments).
- Export those types alongside the data so consumers stay in sync.
- Use literal unions over loose strings for IDs that have a fixed set.
- Avoid `any`. `unknown` is acceptable at remote boundaries — narrow it
  immediately on the next line.
- Remote payloads are explicitly typed at both ends. The shape lives in
  `shared/`, both sides import it.

---

## 6. Module Boundaries

- `shared/` is importable by both sides. Must not reference server-only or
  client-only services.
- `server/` is the only place that holds authoritative state, validates
  inputs, awards rewards, persists data.
- `client/` is presentation, input, and prediction. Never trusted.
- Cross-side communication goes through remotes defined in
  `shared/remotes/`. Servers must create remote instances eagerly so clients
  can `WaitForChild` them without races.

---

## 7. Function Design

- One responsibility per function. If you need "and" to describe what it
  does, split it.
- Pure where possible. Side effects (instance creation, remote fires, state
  mutation) live in clearly-named functions (`spawn*`, `fire*`, `update*`,
  `apply*`).
- Initialisation functions follow the naming `initializeXxxSystem()` /
  `initializeXxxHandler()` and are called in dependency order from
  `server/bootstrap.ts`.

---

## 8. Logging

- Use `[SYSTEM]` prefixes on warns and prints
  (e.g. `[INVENTORY]`, `[BOUNTY-SCROLL]`, `[ASSASSINATION]`).
- Log decisions and state transitions, not noise.
- No `print(...)` left in production paths for debugging. If you needed it
  while developing, either remove it or convert it to a guarded
  `warn` that tells future-you something useful.

---

## 9. Comments

Comments explain **why**, not **what**. The code already says what.

Good:
```ts
// Reserve a fixed pixel column so long names cannot push the gold value
// off-screen on narrow displays.
```

Bad:
```ts
// Set the size to 1, -64, 1, 0
```

Section banners (`// ── Coin gain ────`) are welcome for navigating long
files. JSDoc on exported functions/types is welcome when the contract is
non-obvious.

---

## 10. Hard Rules (From copilot-instructions.md)

These are reproduced here because violating them causes runtime crashes or
breaks core systems. They are not negotiable.

1. **ASCII-only** in strings reaching the Luau runtime. No emoji, no
   `\uXXXX` escapes. Use letters/words as symbols.
2. **`Array.sort()` comparators return boolean**, not `-1/0/1`. Use
   `(a, b) => a.value < b.value`.
3. **Remotes are created server-side first**, lazy-getter pattern in
   `shared/remotes/*.ts`.
4. **Bootstrap order matters.** New systems go after their dependencies in
   `server/bootstrap.ts`.
5. **No circular imports.** Restructure modules before reaching for
   `require(script.Parent!.FindFirstChild(...))`.

---

## 11. When You're Unsure

- If a new file feels like the right answer, first check whether an existing
  config or module is the actual home.
- If a fix requires touching five files, that's normal for a refactor — do
  all five. If it requires touching fifty, stop and ask.
- If the user's request seems to conflict with these standards, ask before
  inventing a workaround. The standards exist so the codebase stays
  navigable; bypassing them silently makes future work harder.

---

## 12. Palantir — Observability Standard

All analytics — funnel steps, gameplay events, conversion tracking — go
through **one module**: `src/server/modules/analytics-tracker.ts`. Naming and
schema live in `src/shared/config/analytics-events.ts`. Together they are the
Palantir: the only stones we look into.

**Hard rules:**

1. **Never call `AnalyticsService` outside the tracker.** Gameplay code calls
   `trackXxx(...)` helpers. The tracker is the only file that imports
   `AnalyticsService`.
2. **Never send high-cardinality values.** No player names, NPC names, item
   IDs, exact coords, scroll IDs, raw numbers. Every field draws from the
   `AnalyticsField` union, and every value is either a closed string union or
   a bucket label (`levelBucket`, `sessionMinuteBucket`, `remainingTimeBucket`).
   Roblox caps the experience at 8000 unique field-value combos — blowing this
   silently destroys your dashboards.
3. **Max 3 custom fields per event.** Schema is per-event in `EVENT_FIELD_SLOTS`.
4. **Wrap every call in `safe()` (pcall).** Analytics failure must never break
   gameplay.
5. **Server-authoritative only.** Clients can hint via the `UIEvent` remote,
   but the server validates and fires. Never trust raw event names from the
   client.

**Adding a new event (3 steps, never more):**

1. Add a name to `ANALYTICS_EVENTS` in `analytics-events.ts`.
2. Add its slot layout (1–3 fields) to `EVENT_FIELD_SLOTS`.
3. Add a thin typed `trackXxxYyy(player, ...)` helper in `analytics-tracker.ts`
   that closes over the literal event name. Gameplay code calls only the helper.

**Adding a new field:**

1. Add the field name to the `AnalyticsField` union.
2. If it's bucketed, add a `xxxBucket(value)` helper.
3. If it's a derived value, add a private resolver (e.g. `poisonRarity(id)`)
   that reads from the config — never inline the lookup at the call site.

**Resilience contract (must hold for every new event):**

Adding a new weapon, poison, elixir, game pass, dev product, vendor item,
shop type, or NPC must require **zero** edits to the analytics layer. Helpers
read derived fields (rarity, weaponType, shopType) from the config maps. If
a new content item ever requires a tracker edit, the tracker is wrong — fix
the resolver, not the call sites.

**Funnels vs. custom events:**

- True Roblox Funnels (`LogOnboardingFunnelStepEvent`, `LogFunnelStepEvent`)
  are reserved for one-shot lifetime sequences with a defined start and end.
  We use them only for tutorial.
- Everything else is a custom event. Conversion ratios (prompt → purchase,
  visit → buy) are computed in the dashboard, not by chaining funnel APIs.

If you find yourself wanting metrics in three files, you want one event
emitted in three places — not three events. Reuse the existing schema.

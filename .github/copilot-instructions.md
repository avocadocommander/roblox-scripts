# Copilot Instructions — Kings (Roblox Assassin RPG)

## Project Overview

Roblox game being created in Roblox Studio and roblox-ts in vscode with rojo

Medieval assassin RPG built with **roblox-ts** (TypeScript → Luau transpiler). Players assassinate NPCs for bounties, craft with poisons/elixirs, and hunt other wanted players. Dark pirate-guild aesthetic.

Create config or config map files that make it easy to add new items, NPCs, or mechanics without changing core logic. For example, `shared/config/weapons.ts` defines all weapons in a simple data structure — to add a new weapon, just add an entry there. Avoid hardcoding values in logic files. Follow the existing patterns for new features/systems.

## Game Core Loop
Players will spawn in and get assigned a target to assassinate. As you assissinate npcs you will unlock them in the log book as a collector tool. You will also get Notes to trade in for posions/ elixers / weapons ect.

When a player assassinates a NPC they will gather a completed bounty scroll. They then take that scroll (and upto 3 more) and turn them into the right npc for the reward. 

If a player kills a NPC that does not have a active bounty on them or they are seen assassinating a npc (with the eyes logic) that player themself becomes wanted.

When you are wanted you become a target for assassination by other players. If you are killed you will drop the complete bounty scrolls (into the player who killed you inventory). You can only store upto 10 scrolls at a time in your invenyotty.

You can become unwanted either by dying, or buying out of it somehow.

As you level up you will unlock different areas of the map that either have cool stuff or new vendor npcs you can buy new stuff from.

There will be some things players can spend robux on like potions that last a hour or posiopns or cool looking weapons or something.

## Tech Stack

- **roblox-ts** `^3.0.0` — TypeScript to Luau compiler (`rbxtsc`)
- **Rojo** `7.5.1` — syncs compiled Luau into Roblox Studio
- **ESLint + Prettier** — `tabWidth: 4`, tabs, `printWidth: 120`, trailing commas
- Runtime: `@rbxts/services`, `@rbxts/signal`, `@rbxts/rx`

## Source Layout

```
src/
  server/           → ServerScriptService (*.server.ts entry points)
    bootstrap.ts       — init sequence, called on load
    modules/           — server-only systems (assassination, bounty, inventory, stealth…)
  client/            → StarterPlayerScripts (*.client.ts entry points)
    GUI/               — all HUD / UI code
    modules/           — client-only logic (movement, npc-proximity…)
    environment/       — world interaction scripts
  shared/            → ReplicatedStorage (importable from both sides)
    config/            — DATA-ONLY config maps — the SINGLE SOURCE OF TRUTH for all game data
      weapons.ts         — weapon definitions (WeaponDef, WEAPONS)
      poisons.ts         — poison definitions (PoisonDef, POISONS)
      elixirs.ts         — elixir definitions (ElixirDef, ELIXIRS)
      game-passes.ts     — all Roblox Game Pass IDs & metadata (GamePassDef, GAME_PASSES)
      dev-products.ts    — all Roblox Developer Product IDs & grants (DevProductDef, DEV_PRODUCTS)
      premium-offers.ts  — world-object Robux offers (references game-passes & dev-products)
      player.ts          — player defaults & balance constants (starting coins, speeds, limits)
      npcs.ts            — full NPC registry (NPCDef, NPC_REGISTRY)
      factions.ts        — faction definitions & XP helpers
      titles.ts          — player title definitions
      achievements.ts    — (in shared/) achievement definitions
      delivery.ts        — weapon delivery types (blunt / pierce)
      shop-types.ts      — dynamic shop item pools & merchant NPC pool
      npc-clothing.ts    — tier-based NPC clothing data
      npc-quips.ts       — ambient NPC dialog lines
      map-locations.ts   — world locations with ambient sounds/effects
      music.ts           — music playlist
      inspectables.ts    — inspectable world objects
    remotes/           — remote event/function factories
    inventory.ts       — unified ItemDef, rarity colours, bounty scroll types (builds from configs)
    ui-theme.ts        — UI_THEME palette, responsive scaling helpers
    module.ts          — NPC re-exports, medieval constants
    helpers.ts         — log(), isTable(), speed helpers
    player-state.ts    — DataStore persistence (imports defaults from config/player.ts)
```

## Critical Rules (MUST follow)

### 1. No Unicode Above ASCII
Luau cannot handle unicode escape sequences (`\uXXXX`) or emoji characters (🪙, ⚔️, etc.) in template literals or string concatenation. They cause **runtime crashes**.
- **Always** use plain ASCII text or single-byte characters.
- If you need a symbol, use a letter/word substitute (e.g. `"g"` for gold, `"#"` for scroll indicator).

### 2. Array.sort() Uses Boolean Comparators
roblox-ts compiles `Array.sort()` to Lua's `table.sort`, which expects a **boolean** return, not `-1 / 0 / 1`.
```ts
// WRONG — will crash or sort incorrectly
arr.sort((a, b) => a.value - b.value);

// CORRECT
arr.sort((a, b) => a.value < b.value);
```

### 3. Remotes Must Be Created Server-Side First
Clients call `WaitForChild` on remote instances. The server **must** eagerly create all `RemoteEvent` / `RemoteFunction` instances before any client connects. Follow the lazy-create getter pattern in `shared/remotes/*.ts`.

### 4. Server Bootstrap Order Matters
Systems are initialised sequentially in `server/bootstrap.ts`. If a new system depends on another, it must be added **after** its dependency in the init chain.

### 5. Config Files Are Data-Only — EVERYTHING Must Be Config-Driven
All game data, balance values, IDs, and tuning constants MUST live in `shared/config/` files. **Never hardcode** item stats, Roblox product/pass IDs, player defaults, cooldowns, prices, or any tunable value directly in logic files.

**Config file index** (add new items/features here, not in logic):
| File | Contents | Key exports |
|------|----------|-------------|
| `weapons.ts` | Weapon definitions | `WEAPONS`, `WEAPON_LIST` |
| `poisons.ts` | Poison definitions | `POISONS`, `POISON_LIST` |
| `elixirs.ts` | Elixir definitions | `ELIXIRS`, `ELIXIR_LIST` |
| `game-passes.ts` | All Roblox Game Pass IDs | `GAME_PASSES`, `ALL_GAME_PASS_IDS` |
| `dev-products.ts` | All Developer Product IDs | `DEV_PRODUCTS` |
| `premium-offers.ts` | World-object Robux offers | `PREMIUM_OFFERS` |
| `player.ts` | Player defaults & balance | `STARTING_COINS`, `MAX_BOUNTY_SLOTS`, `DEFAULT_WALK_SPEED`, etc. |
| `npcs.ts` | Full NPC registry | `NPC_REGISTRY`, `NPC_NAMES` |
| `factions.ts` | Faction definitions & XP | `FACTIONS`, `FACTION_IDS` |
| `titles.ts` | Player titles | `TITLES`, `TITLE_LIST` |
| `delivery.ts` | Weapon delivery types | `DELIVERY_TYPES` |
| `shop-types.ts` | Dynamic shop item pools | `SHOP_TYPE_POOLS` |

**Cross-reference rules:**
- Roblox product IDs are defined ONCE: Game Passes in `game-passes.ts`, Dev Products in `dev-products.ts`.
- Other configs (weapons, premium-offers, poisons) NEVER store a pass or product ID directly.
- Game Passes link to items via `unlocksItemId` on the `GamePassDef`. Use `getGamePassForItem(itemId)` to check if an item requires a pass.
- Dev Products link to items via `grantItemId` on the `DevProductDef`.
- If an item is both a Dev Product and a poison/elixir, the item definition stays in `poisons.ts`/`elixirs.ts`, and `dev-products.ts` references it by item ID via `grantItemId`.
- `shared/inventory.ts` auto-builds `ITEMS` / `ITEM_LIST` from weapon/poison/elixir configs — never add items there directly.
- `player-state.ts` imports defaults from `config/player.ts` — never hardcode starting values in state logic.

### 6. No `require()` for Circular Deps
Use the lazy `require(script.Parent!.FindFirstChild(...))` pattern only when absolutely necessary to break circular dependencies (see `inventory-handler.ts`). Prefer restructuring imports.

## UI Conventions

- All UI is built procedurally in code (no Roblox Studio GUI editor).
- Use `UI_THEME` from `shared/ui-theme.ts` for all colours, fonts, and transparency values.
- Use `getUIScale()` / `sc()` helpers for responsive sizing (baseline 1280×720, `MIN_SCALE = 0.85`).
- ZIndex layering: base panels `30`, children `31-33`, tooltips `50-51`.
- Dark muted palette — bone/amber text, dark brown backgrounds, gold accents.

## Rarity Tiers

Six tiers, ordered lowest → highest:
| Tier | Colour | Usage |
|------|--------|-------|
| `common` | Grey `(108,100,90)` | Serf NPCs, basic items |
| `uncommon` | Green `(68,138,82)` | Commoner NPCs |
| `rare` | Blue `(58,108,168)` | Merchant NPCs |
| `epic` | Purple `(128,68,148)` | Nobility NPCs |
| `legendary` | Gold `(195,155,50)` | Royalty NPCs |
| `player` | Red `(190,40,40)` | PvP kill scrolls (rarest) |

## Inventory System

- **Weapons**: Non-consumable. Click to equip/toggle. One active weapon at a time.
- **Poisons**: Consumable. Coat the active weapon for 30 min. Affect NPC death animation.
- **Elixirs**: Consumable. Immediate or long-term buff on the player.
- **Bounty Scrolls**: Earned from NPC kills. 4 max slots. Turn in for gold/XP.
- Server state lives in `inventory-handler.ts` (`PlayerInventory` map).
- Client receives `InventoryPayload` via `InventorySync` remote.

## Remote Pattern

Each remote file in `shared/remotes/` exports getter functions that lazy-create instances:
```ts
export function getSomeRemote(): RemoteEvent {
    const folder = getRemotesFolder();
    let remote = folder.FindFirstChild("SomeName") as RemoteEvent | undefined;
    if (!remote) {
        remote = new Instance("RemoteEvent");
        remote.Name = "SomeName";
        remote.Parent = folder;
    }
    return remote;
}
```

## NPC System

- NPC data in `shared/module.ts`: `MEDIEVAL_NPCS` record with status, race, gender per name.
- Status hierarchy: Serf → Commoner → Merchant → Nobility → Royalty.
- Death effects in `shared/npc-manager.ts`: DEFAULT, EVAPORATE, SMOKE (+ poison overrides).

## Wanted / Bounty Board

- Players become "wanted" after illegal kills (non-bounty assassinations).
- Wanted list broadcasts via `PlayerWanted` / `BountyListSync` remotes.
- Bounty board shows: player name, up to 4 coloured `#` rarity indicators, gold amount.
- PvP kill transfers victim's bounty scrolls (highest rarity first), awards a red "player" scroll.

## Naming Conventions

- Server entry points: `*.server.ts`
- Client entry points: `*.client.ts`
- Shared modules: plain `*.ts`
- Interfaces: PascalCase (`ItemDef`, `BountyScroll`, `PlayerInventory`)
- Constants: UPPER_SNAKE or camelCase records (`ITEMS`, `RARITY_COLORS`, `UI_THEME`)
- Exported init functions: `initializeXxxSystem()` / `initializeXxxHandler()`
- Log prefix: `[SYSTEM_NAME]` (e.g. `[INVENTORY]`, `[ASSASSINATION]`, `[BOUNTY-SCROLL]`)


Follow these rules when generating suggestions in this repository.

## Source of Truth
Read and defer to:

1. KINGS_BOUNTY_CANON.md
2. KINGS_BOUNTY_DOMAIN_LANGUAGE.md

If conflicts exist:

Those files win.

Do not invent mechanics that contradict them.

---

## Domain Language
Use canonical names from KINGS_BOUNTY_DOMAIN_LANGUAGE.md.

Examples:
Use:
- The Board

Do not use:
- quest panel
- objective panel

Use:
- Codex

Do not use:
- journal
- kill log

---

## Design Rules
- Reuse existing systems before proposing new systems.
- Favor MVP-safe additions.
- Preserve Protected Realm principles.
- Never propose pay-to-win.
- Never propose pay-for-convenience.
- Never propose gambling mechanics.

---

## Scope Discipline
Avoid inventing:
- large infrastructure
- unnecessary subsystems
- major event frameworks near launch

Prefer:
small additions using current systems.

---

## Technical Context
This project uses:
- Roblox-TS
- Rojo

Respect existing project structure and conventions.

Do not assume Lua.

---

## If unclear
Ask for clarification instead of inventing behavior.
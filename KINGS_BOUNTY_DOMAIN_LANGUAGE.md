# KINGS_BOUNTY_DOMAIN_LANGUAGE

## Purpose
Defines canonical domain language for Kings Bounty.

Use these names consistently in:
- code
- architecture
- documentation
- prompts
- Copilot instructions
- design discussions

If a thing has a canonical name, do not invent alternate names unless this file is updated.

---

## The Board
The main gameplay text area.

Contains:
- bounty contracts
- tutorial guidance
- objective content

Modes:
- Contract Mode
- Guidance Mode

Do NOT call this:
- Quest Panel
- Objective Panel
- Mission UI
- Bounty UI

Canonical name:
The Board

---

## Message Strip
Small banner above The Board.

Used for:
- warnings
- unlocks
- decrees
- event messages

Canonical name:
Message Strip

---

## Guidance Layer
Combined onboarding system consisting of:
- The Board
- Focus Highlight
- UI Pulses

Canonical name:
Guidance Layer

---

## Focus Highlight
World-space highlighted objective guidance.

Examples:
- Guild Leader highlight
- Board highlight
- First target highlight

Canonical name:
Focus Highlight

---

## Pulse
UI signal meaning:

Act now.

Canonical name:
Pulse

---

## Marker
UI signal meaning:

Something new exists.

Preferred visual:
Wax Seal

Canonical name:
Marker

---

## Codex
Player collection book.

Contains:
- collected NPCs
- collection rewards
- hidden discoveries

Do NOT call:
- Journal
- Kill Log
- Collection UI

Canonical name:
Codex

---

## World Whispers
Small mystery/event layer.

Includes:
- Traveling Merchant
- Royal Decrees
- Strange NPC Sightings

Canonical name:
World Whispers

---

## Royal Decree
Reactive world-response event.

Triggered by meaningful player events.

Canonical name:
Royal Decree

---

## Player Board
Local player's persistent HUD panel anchored at the top-left of the screen.

Shows the local player only — never another player. Contains:
- player name
- title + faction reputation line
- currently equipped weapon
- gold total (with inline +/- gain/loss effect)

Code reference:
- `src/client/GUI/user-ui-block.client.ts` (built by `buildCharacterBanner`)

Do NOT call this:
- character banner
- HUD top-left
- nameplate (that name is reserved — see Player Nameplate)

Canonical name:
Player Board

---

## Player Nameplate
Floating BillboardGui above another player's character head, visible in the 3D world.

Shows information about a remote player only. Local player's own nameplate is hidden from themselves. Contains:
- title symbol + title name + player name (single line)
- wanted-state border colour

Does NOT contain gold (gold lives on the Player Board).

Code reference:
- `src/client/modules/npc-proximity.ts` (`createPlayerBillboard`)

Do NOT call this:
- player board
- player overhead UI
- name tag

Canonical name:
Player Nameplate

---

## Protected Realm
Foundational design ethic:
fairness, immersion, no corruption by coin.

Canonical name:
Protected Realm
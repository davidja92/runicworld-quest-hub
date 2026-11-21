# RunicWorld progression pathway

Read START-HERE.txt for installation and usage. The new Progression pathway button combines your quest catalogue, skill targets, bank preparation and client-listed methods. Self-sourcing and no minigames are the defaults.

# Runic Quest Hub

This version adds GE & profits, skill-linked recipe costs, a watchlist, observed trade charts, and client-matched Wiki vendor fallback. Price priority is current directional GE quotes, then actual trade history, then NPC fallback. Guide prices are not trade history. All Wiki shop prices remain reference estimates; client presence does not confirm server stock. Upload every file in this website folder to the repository root. Full use/source/maintenance notes are supplied alongside this folder.

The skill planner now uses the installed RunicWorld client data: 2,177 recipe/training entries and 2,773 skill-guide unlocks. Search and category filters are available. Missing XP, ingredient information, unresolved item names and conflicting XP are shown explicitly. No generic OSRS training fallback or game-sync component is used. See the supplied UPLOAD-INSTRUCTIONS.md for extraction provenance and limits.

Static RunicWorld quest planner for GitHub Pages. Open `index.html` using a local development server or publish these files at the root of a GitHub Pages repository. No build tooling needed.

## What works
- Player lookup uses the **same Cloudflare Worker** and hiscores parsing as the existing RunicWorld GE Profit Finder: `config.js` supplies the proxy base, the app fetches `${proxyBase}/hiscores`, matches the player in `players[]`, and converts the indexed XP to skill levels using the `skills[]` mapping.
- Searchable quest catalogue, skill badges, local completed quest tracking, linked prerequisite chains, item checklists and selected built-in quest outlines.
- Loads full OSRS Wiki `/Quick guide` HTML into the page using MediaWiki's cross-origin JSON API when permitted; otherwise displays an external link.
- Local browser storage preserves character name, saved skills and checklist progress.

## Important limitations
The Cloudflare endpoint and mapping were copied from the published `davidja92/runicworld-profit-finder` repository on November 1, 2026. The connection cannot be live-tested in this build environment; confirm with a known player on GitHub Pages. Keep `config.js` aligned with the Profit Finder if the Worker URL changes.

The local quest requirements are **partial**. Uncurated skills, quest requirements, items, and quest-point requirements are labeled unverified, not 'none'. Full walkthroughs depend on the OSRS Wiki API being accessible in your browser. The item checklist covers curated metadata only; read the full guide for all items and alternate approaches. Quests and wiki pages on modern OSRS may not exist or match RunicWorld's custom content.

RunicWorld hiscores may use different skill indexing; verify a loaded player's skills against in-game values before relying on the eligibility results. Quest completion cannot be automatically extracted from the hiscores endpoint, so it is tracked manually. This is a starter application, not a fully validated quest database.

## Host on GitHub Pages
1. Create a new GitHub repository, e.g. `runicworld-quest-hub`.
2. Upload `index.html`, `config.js`, `app.js`, `quests.js`, `README.md` to its repository root.
3. Settings → Pages → Deploy from branch → `main` / `(root)` → Save.
4. Open the generated Pages URL and enter your RunicWorld character name.

The OSRS Wiki is a community project; provide attribution and follow its reuse and API policies. This site is not affiliated with Jagex or RunicWorld.

## RunicWorld screenshot quest inventory (November 1, 2026)

The quest list has been replaced with the **130 distinct entries** shown in the user-provided in-game screenshots. No newer OSRS quests are shown. In-game labels have been preserved, with wiki aliases for renamed quest pages. The screenshots show 13 green entries, but these are **not automatically marked completed**: browser progress is manually tracked because screenshots may show a different character than the current username. The green names are recorded in `screenshotCompleted` for reference. Some listings are activities or custom entries rather than OSRS quest pages.


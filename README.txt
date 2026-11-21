Runic Quest Hub — Optimal quest order

INSTALL
Upload the five .js/.html files from this folder to the ROOT of
davidja92/runicworld-quest-hub, replacing app.js, index.html and quests.js.
Add quest-requirements.js and quest-order.js alongside them.
Keep all your existing GE, skill planner, config and other website files.
Wait for GitHub Pages to finish deploying, then refresh with Ctrl+F5.

USE
1. Fetch your character's skills and enter your current in-game quest points.
2. Check that your completed quests are marked correctly.
3. In the quest list, choose Quest order > Optimal for my character.
4. Follow the numbered route. Mark completions and refresh skills after training.

The route updates when skills, quest points or marked completions change.
Search and completion filters still work. Alphabetical order remains available.
Your saved progress stays in the same browser storage. The total-level card,
Kudos, skill planner and GE integration are preserved.

WHAT THE ORDER MEANS
Prerequisites come before dependent quests. At each planned step, the route
prefers satisfied skill/QP gates, then useful unlocks and smaller training gaps.
The OSRS Wiki optimal route breaks ties. Completed quests appear last.
Row badges check your ACTUAL current progress, not simulated future completion.
The route uses known QP rewards for future gates, but does not invent future
skill levels from OSRS XP rewards, which may differ on RunicWorld.
This is a progression suggestion, not a guaranteed minimum-time route.

DATA
127 of the 130 entries have OSRS Wiki requirement references retrieved
20 November 2026. Each record links to its source. Three entries remain
unverified: Barbarian Fishing, The Harvest Masquerade and Tutorial Island.
Partial prerequisite progress is flagged for manual checking.
Listed skill levels are conservative unboosted targets. Boosts, bypasses,
combat, equipment, partners and other special conditions require guide checks.
RunicWorld may change or omit requirements that exist in current OSRS.

Sources:
https://oldschool.runescape.wiki/w/Optimal_quest_guide
https://oldschool.runescape.wiki/w/Quests/Requirements_by_quest
Individual quest sources are linked in quest-requirements.js and the quest panel.
Attribution: OSRS Wiki contributors, CC BY-NC-SA 3.0.
https://creativecommons.org/licenses/by-nc-sa/3.0/

VALIDATION
Passed: prerequisite ordering, recursive gates, aliases, QP gates, unknown
levels/QP, partial progress, cycles, completion updates, search/filter rendering,
130-entry coverage, and existing GE, planner, vendor and Kudos checks.
This package has not been uploaded or deployed to GitHub Pages.

# Campaign Balance Ledger

A record of campaign economy changes, kept so any rebalance can be reverted
by pasting the previous values back into `src/lib/campaign.js` (`NODE_BATTLES`).
Nothing else needs migrating: rewards only pay on a node's first clear, and
enemy compositions are read fresh at battle start, so editing these values is
always safe — mid-campaign saves included.

Ship costs (unchanged): fighter 100 · bomber 350 · cruiser 450 requisition.
Starting fleet (unchanged): 8 fighters.

---

## 2026-07-11 — +10% requisition both sides, enemy archetype variety

Every enemy fleet used to be the same fleet scaled (~90% fighters plus a
token sprinkle of bombers/cruisers). Fleets were raised ~10% by requisition
value on both sides, and enemy comps were redistributed into per-node
archetypes so consecutive nodes ask different tactical questions:
swarm → balanced → cruisers → bombers → balanced → swarm → cruisers →
bombers → heavy → finale. Early nodes deviate from exactly +10% because one
fighter is a 100-req quantum. Player rewards were rounded to the nearest 10
(total 15,620 → 17,180, +10.0%).

### Previous values (restore point)

| # | Node | reward | enemy fighters | bombers | cruisers |
|---|---|---|---|---|---|
| 1 | First Light | 560 | 7 | 0 | 0 |
| 2 | Critical Mass | 720 | 9 | 1 | 0 |
| 3 | Antithesis | 880 | 11 | 1 | 1 |
| 4 | Decoherence | 1000 | 17 | 2 | 1 |
| 5 | Logos | 1220 | 22 | 2 | 2 |
| 6 | Catabasis | 1440 | 29 | 3 | 2 |
| 7 | Providence | 1730 | 39 | 3 | 3 |
| 8 | Ultima Ratio | 2020 | 51 | 4 | 3 |
| 9 | Singularity | 2450 | 64 | 5 | 4 |
| 10 | Anastasis | 3600 | 69 | 7 | 6 |

### Current values (introduced by this change)

| # | Node | reward | enemy fighters | bombers | cruisers | archetype |
|---|---|---|---|---|---|---|
| 1 | First Light | 620 | 8 | 0 | 0 | pure fighter ambush |
| 2 | Critical Mass | 790 | 10 | 1 | 0 | balanced light |
| 3 | Antithesis | 970 | 7 | 0 | 3 | cruiser line |
| 4 | Decoherence | 1100 | 13 | 5 | 0 | bomber wave |
| 5 | Logos | 1340 | 22 | 3 | 2 | balanced |
| 6 | Catabasis | 1580 | 53 | 0 | 0 | pure fighter swarm |
| 7 | Providence | 1900 | 33 | 0 | 8 | cruiser wall |
| 8 | Ultima Ratio | 2220 | 44 | 12 | 0 | bomber strike force |
| 9 | Singularity | 2700 | 61 | 6 | 6 | balanced heavy |
| 10 | Anastasis | 3960 | 73 | 8 | 7 | grand finale |

### How to restore

Either paste the "Previous values" table back into the `reward` and `enemy`
fields of `NODE_BATTLES` in `src/lib/campaign.js`, or `git log -- balance.md`
to find the commit that introduced this change and revert it. A player
mid-campaign keeps their banked requisition and progress either way; only
un-fought battles and un-banked rewards are affected.

---

## 2026-07-11 — guaranteed enemy Reinforced Hull ramp

On top of the random card buffs enemy nodes already roll (from battle 5 on,
`ENEMY_CARD_COUNTS`), each node now fields GUARANTEED Reinforced Hull cards
(+5 flagship hull per level), granted every second node: battles 5–6 = +1
level, 7–8 = +2, 9–10 = +3 (finale +15 hull). Implemented as
`guaranteedCapHp` in `src/lib/enemyCards.js`, merged at read time in
`getEnemyUpgrades` — never saved, so existing campaigns inherit it and the
shipyard intel shows it.

**Restore:** change `guaranteedCapHp` to `() => 0` (or delete the merge in
`getEnemyUpgrades`). Previous behaviour: enemy flagship hull came only from
whatever `capHp` levels the random roll happened to land.

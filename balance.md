# Campaign Balance

Current-state reference for the campaign's enemy tuning. **Update this file in
the same change whenever you touch enemy strength, cards, or skills** — it is
the human-readable source of truth; the History section at the bottom is the
changelog.

Sources: enemy comps + rewards in `src/lib/campaign.js` (`NODE_BATTLES`), card
counts + scaling in `src/lib/enemyCards.js`, timed skills in
`src/screens/SpaceBattleScreen.jsx` (`RED_SKILL_SCRIPT`).

Constants: ship cost fighter 100 · bomber 350 · cruiser 450 requisition.
Starting fleet 8 fighters (800). Both flagships are free.

---

## 1 · Enemy strength per node

"Player ceiling" = 800 starting fleet + every prior node's reward banked (what
the player *could* field). "Enemy cost" values the enemy comp at ship prices —
it excludes card buffs, which push real enemy strength above this from node 4 on.

| # | Node | Enemy comp | Enemy cost | Player ceiling | % of ceiling |
|---|------|------------|-----------:|---------------:|:------------:|
| 1 | First Light | 7f | 700 | 800 | 88% |
| 2 | Critical Mass | 10f 1b | 1,350 | 1,420 | 95% |
| 3 | Antithesis | 7f 3c | 2,050 | 2,210 | 93% |
| 4 | Decoherence | 13f 5b | 3,050 | 3,180 | 96% |
| 5 | Logos | 23f 3b 2c | 4,250 | 4,280 | 99% |
| 6 | Catabasis | 56f | 5,600 | 5,620 | 100% |
| 7 | Providence | 36f 8c | 7,200 | 7,200 | 100% |
| 8 | Ultima Ratio | 49f 12b | 9,100 | 9,100 | 100% |
| 9 | Singularity | 65f 6b 6c | 11,300 | 11,320 | 100% |
| 10 | Eschaton | 81f 8b 7c | 14,050 | 14,020 | 100% |

Rewards (banked on first clear): 620 / 790 / 970 / 1,100 / 1,340 / 1,580 /
1,900 / 2,220 / 2,700 / 3,960 — total 17,180.

Archetypes: swarm → balanced → cruiser line → bomber wave → balanced → swarm →
cruiser wall → bomber strike → balanced heavy → grand finale.

---

## 2 · Enemy cards per node

Every node's enemy buff map is assembled live in `getEnemyUpgrades` from three
stacking sources: **random cards** (this section), **guaranteed hull** (§2a),
and **player-scaled bonus cards** (§4).

**Random cards** — `ENEMY_CARD_COUNTS`, drawn from the player's catalog with the
player's rarity odds minus legendaries. Rolled + saved on first play of a node
(stable for the run; `resetCampaign` re-rolls).

| # | Node | Random cards | Guaranteed hull (§2a) |
|---|------|:---:|:---:|
| 1 | First Light | 0 | — |
| 2 | Critical Mass | 0 | — |
| 3 | Antithesis | 0 | — |
| 4 | Decoherence | 1 | — |
| 5 | Logos | 1 | +1 (+5) |
| 6 | Catabasis | 2 | +1 (+5) |
| 7 | Providence | 3 | +2 (+10) |
| 8 | Ultima Ratio | 3 | +2 (+10) |
| 9 | Singularity | 4 | +3 (+15) |
| 10 | Eschaton | 5 | +3 (+15) |

### 2a · Guaranteed Reinforced Hull

Separate from the random roll, the enemy flagship **always** carries free
Reinforced Hull cards from node 5 on — `guaranteedCapHp =
max(0, floor((nodeIndex−2)/2))` levels, +5 flagship hull each. This is a fixed
per-node buff (not rolled, not saved), merged on top of whatever the random roll
lands, so the enemy flagship gets steadily tankier late-campaign regardless of
luck: nodes 5–6 = +1 level (+5 HP), 7–8 = +2 (+10), 9–10 = +3 (+15).

---

## 3 · Enemy admiral skills (hardcoded)

`RED_SKILL_SCRIPT`, keyed by node. Each fires at the given battle-clock second
while the red flagship is alive and not routing; retries if the rig is busy.
Nodes 1–6 have no scripted skills.

| # | Node | Skill(s) & time |
|---|------|-----------------|
| 7 | Providence | Spinal Lance @ 0:45 |
| 8 | Ultima Ratio | Spinal Lance @ 0:20 |
| 9 | Singularity | Nano-Repair @ 0:20 |
| 10 | Eschaton | Macro-Missile Barrage @ 0:15, Spinal Lance @ 0:25 |

---

## 4 · Player-scaled bonus cards

Extra random cards on **every** enemy node, scaled to the player's own deck
(`inventoryBonusCards`, checked live on entering the battle). Stacking:

- **+1 card** once the player holds ≥1 epic OR ≥2 rare (blue) cards.
- **+1 more** once the player owns BOTH legendary cards (Macro-Missile Barrage
  + Throne-Forged Aegis).

Rare/epic counts sum card *levels* (two copies of one rare = 2). The bonus roll
is cached per node+count, so the shipyard briefing and the battle match; it
re-rolls only when the deck crosses a threshold.

Rarity → colour: legendary orange · epic purple · rare blue · uncommon green ·
basic white.

---

## History

- **2026-07-12** — Rewrote this file as a current-state reference. Player-scaled
  enemy bonus cards added (§4). Card nerfs: Targeting Uplink +25%→+18%,
  Auto-Repair +1/sec→+1/2s, Praetorian Wing +4/+14%→+3/+10%, Bastion Bulwark
  +35→+30 HP, Veteran Squadrons +2→+1 HP. Eschaton enemy lance 0:30→0:25.
  Decoherence random cards 0→1.
- **2026-07-12** — Nodes 5–10 raised from ~94–97% to ~100% ship-cost parity
  (fighter counts only; archetypes unchanged). Prior fighter counts:
  Logos 22, Catabasis 53, Providence 33, Ultima Ratio 44, Singularity 61,
  Eschaton 73.
- **2026-07-11** — Guaranteed enemy Reinforced Hull ramp added (§2).
- **2026-07-11** — +10% requisition both sides; enemy comps reshaped into
  per-node archetypes. Pre-rework enemy comps (fighters/bombers/cruisers):
  1: 7/0/0 · 2: 9/1/0 · 3: 11/1/1 · 4: 17/2/1 · 5: 22/2/2 · 6: 29/3/2 ·
  7: 39/3/3 · 8: 51/4/3 · 9: 64/5/4 · 10: 69/7/6. Pre-rework rewards:
  560 / 720 / 880 / 1000 / 1220 / 1440 / 1730 / 2020 / 2450 / 3600.

# Bluff Market — Decision Log

A running record of the major top-level decisions, so you can scan what I chose and
why, and overrule anything. Newest decisions at the bottom of each section.

---

## 1. What we're building
**Decision:** An **Auction Autobattler** — a combination of your "Auction Bluff" and
"Fake Wealth" ideas, expanded to 4 players (you + 3 AI rivals).
**Why:** You liked bluffing; this makes the bluff the core mechanic (hidden gold + blind
bids) and uses an auto-resolved fight as the payoff, which avoids the hard problem of
fun 4-way live combat.

## 2. Player setup
- **Decision:** 4 players total — **you vs. 3 AI opponents**. Solo-playable immediately.
- **Why:** You wanted "more than 2 players." AI-only is the realistic default for a
  single-file browser build (hot-seat was the alternative; not chosen).

## 3. The bluff mechanic (the heart of it)
- **Decision (REVISED):** **Timed ascending auction** — superseded the original blind
  bids. Each unit has a live countdown (10s first, resets to 4s on every raise). You
  raise with +5/+10/+20/min/all-in buttons; AI rivals counter-raise in real time on
  short reaction delays, each holding a private price ceiling. High bidder when the
  clock hits zero wins and pays. (Changed at user request on 2026-11-17.)
- **Decision:** **Your gold stays hidden** from rivals; they see your live bids but not
  your remaining gold, and project an inflated "apparent gold" (`~Xg?`) to bluff back.
- **Why the change:** A timed open auction makes the bluff about *nerve and timing* —
  jump the price to scare a cautious rival, or sit quiet and snipe at the buzzer — which
  is more exciting than a one-shot blind guess.

## 4. Army / synergy system
- **Decision:** 5 unit types (Warrior, Archer, Mage, Beast, Rogue). Owning 2 or 3 of a
  type unlocks escalating **synergy bonuses** (e.g. 2 Warriors = +armor, 3 Mages = big
  attack boost).
- **Why:** Synergies make each auction a real decision and make your bids *readable* —
  which is itself part of the bluff.

## 4b. Combat MODEL (rewritten 2026-11-17)
- **Decision (MAJOR REWRITE):** Combat is now **per-unit**. Each unit keeps its own HP
  and ATK through the fight; squads duel **front-vs-front** until one side is wiped.
  Synergies are applied as **per-unit buffs** up front (Warrior→armor on each unit,
  Mage→each unit's ATK, Beast→each unit's HP, Rogue→first-strike + dodge, Archer→opening
  volley where each archer fires a softening shot before melee). `simBattle` emits a
  per-unit event timeline (hit with attacker/defender indices + defender HP, death,
  ko) that the animation replays exactly — the earlier version was replaced.
- **Why:** User asked for each unit to have its own HP and duel individually. This
  supersedes the old aggregate model (one HP pool per side).
- **BALANCE IMPACT (flagged honestly):** more units is now strongly dominant (3 units
  beat 1 unit >90% of the time in tests). The player's win rate dropped from ~28% to
  ~6–13% with scripted bidding, and bidding style barely compensates. The game is fair
  in structure (not shut out, no crashes) but is now HARDER for a 1-of-4 player and may
  want re-tuning (e.g. more starting gold, fewer AI rivals, or capping squad size).
  Left as-is pending user call — see the options offered after this change.
- Tests rewritten to assert the per-unit model (test-harness.js): buildUnits applies
  per-unit synergy buffs, 3 units beat 1, stronger squad wins >80%, mirror ~50/50,
  winner always keeps ≥1 unit, events carry per-unit indices. All pass.

## 5. Combat (animation)
- **Decision (REVISED twice):** Battles are **animated on a canvas**. First built with
  stick figures; at user request on 2026-11-17 replaced with **armored-warrior
  silhouettes** — filled bodies with helmet+plume, shield, and a weapon that reflects
  the squad's dominant unit type (sword for Warrior/Beast, bow for Archer, glowing staff
  for Mage, dagger for Rogue). Weighted combat motion (wind-up → lunge → recoil),
  impact sparks, screen shake, a battlefield backdrop (sky, hills, ground) and floating
  damage numbers. A KO topples the loser.
- **Note on "realistic":** a single-file canvas game has no art assets, so this is the
  most realistic look honestly achievable without sprites — reads as a 2D fighting game,
  not crude lines. Truly photoreal would need external image assets.
- Matches play one at a time with a **SKIP ANIMATION** and **NEXT MATCH** button.
- **Decision (NEW, 2026-11-17):** **Each unit is now its own warrior.** A squad is
  drawn as a row of its real units (correct count, each with its own type's weapon), not
  a single fighter. The front living unit attacks / flinches on each event; rear units
  topple as the squad's shared HP falls, and the whole losing side is wiped on KO.
  - **Combat model unchanged:** this is purely visual. `simBattle` still resolves fights
    on aggregate squad totals (one HP pool per side) and remains the source of truth; the
    row of warriors is a faithful depiction of that result, not per-unit HP. (A true
    unit-vs-unit combat rewrite was offered and NOT taken — it would re-balance the game
    and invalidate the tests; left as a future option if the user wants it.)
  - Validated by a new `test-anim.js` smoke test (real recording canvas context) across
    1v1, mixed, 6-unit max, empty-squad, and skip-path cases — no throws.
- **Key design point:** `simBattle` stays the single source of truth for who wins; it
  now also emits a timeline of events (hit/volley/dodge/ko) that the canvas replays. So
  the animation is a faithful playback of the real result, never a separate RNG.
- **Decision:** Still a **round-robin** each round (everyone fights everyone), +1 point
  per win. Scales cleanly to 4 players.

## 6. Match structure
- **Decision (REVISED):** **3 rounds, 6 units auctioned per round** (was 4; raised at
  user request on 2026-11-17 for a bigger lineup — 18 units total per game). Gold carries
  over; winners bank a little fight income between rounds. Most points after 3 rounds
  wins (gold breaks ties).
- **Decision (NEW):** **The full round lineup is visible.** A "coming up" preview strip
  shows every unit for the round face-up — current one highlighted, sold ones struck
  through, upcoming ones shown with type/stats — so you can plan gold across what's
  ahead. (Added at user request on 2026-11-17; deepens the bluff — you can see the
  keystone unit is still coming and hold back.)

## 6b. Auction interaction
- **Decision (REVISED):** **No "Drop out" button.** Removed at user request on
  2026-11-17. In a timed auction you're never locked out anyway — staying silent just
  lets the clock run, and you can re-enter with a raise any time. Raise controls are now
  +5 / +10 / +20 / +1(min) / All-in.

## 7. Tech / style
- **Decision:** Single self-contained `index.html`, canvas-free DOM/CSS UI, matching the
  dark-gradient + gold-button look of your existing `stick-fighter` game.
- **Location:** `auction-autobattler/index.html` in the workspace.

---

## Open questions for you (when you're back)
These are things I made a default call on but would genuinely like your steer on:

1. **Difficulty / AI sharpness** — right now the 3 AI personas (Cautious / Aggressive /
   Tricky) are moderately challenging. Want them tuned harder or easier?
2. **Round count** — 3 rounds is a ~5-minute game. Longer (5 rounds) for more comeback
   room?
3. **Combat visibility** — battles are a text log. Want a simple visual/animated clash
   instead, or is the log enough?
4. **Bigger bluff surface** — optional idea: let *you* also set a fake "apparent wealth"
   number that rivals react to, so you can actively bluff them (not just read them).

## 8. Improvement pass (2026-11-17, "keep improving")
Three judgment-call improvements, no new user spec:
- **Balance fix (the big one):** the per-unit rewrite had left the player winning only
  ~6–13%. Softened AI `bidMul` (cautious 0.75→0.66, aggressive 1.15→1.00, tricky
  0.95→0.84) and trimmed overbid frequency. Re-measured over 150-game samples: optimal
  "spend big" play now wins **~23%** (fair for 1-of-4, 25% = even split), casual play
  ~7% — a healthy skill gradient. Did NOT just dump gold on the player (blunt); tuned the
  rivals instead.
- **Low-timer snipe banner:** when the auction clock drops under ~2.6s, an unmissable
  cue appears — "⚡ SNIPE NOW or lose it!" when you can still outbid, "GOING TWICE —
  you're winning it!" when you lead, or "Priced out" when you can't afford it.
- **Live synergy read-out:** during each auction a pill row shows how many of the
  current unit's type you own, what buying it unlocks (→ Mage×3!), and your already-active
  synergies — so bids are informed, not guesswork.

## 9. Unit special abilities (2026-11-17)
- **Decision (NEW):** Each unit type has ONE signature ability, independent of (and
  stacking with) synergies:
  - **Warrior — Bulwark:** first hit it takes each battle is halved.
  - **Archer — First Volley:** fires an opening shot before melee even solo (Archer
    synergy adds a second shot per archer).
  - **Mage — Arcane Burst:** ~30% chance its attack does +80% damage.
  - **Beast — Frenzy:** attack scales up as its HP falls (up to +50%).
  - **Rogue — Backstab:** ~35% chance to ignore the target's armor and crit lightly.
- Implemented inside the per-unit `strike` resolution; emits `ability` events the
  animation flashes as colored labels (BULWARK/FRENZY/BURST/BACKSTAB) over the unit.
  Abilities shown on the auction unit card so players know what they're buying.
- **Balance:** re-measured — optimal play ~29% win (was 23%), casual ~5%; still fair for
  1-of-4. Abilities apply to AIs too, so no re-tuning needed.
- New ability tests in test-harness.js (section 6): each ability provably fires; all pass.

## 10. Independent unit combat (2026-11-17)
- **Decision:** Units now attack **independently and simultaneously**, replacing the
  front-vs-front single-file duel. Each round EVERY living unit acts, choosing its own
  target (lowest-HP living enemy = focus fire, with 25% randomness). Per-unit HP and
  per-unit attack damage were already in place (from the earlier per-unit rewrite); this
  change makes all units act in parallel rather than one front unit at a time.
  - Rogue first-strike makes that side act first in a round; otherwise the leading side
    is RANDOMIZED each round.
  - `simBattle` now emits `round` markers; the animation already keyed off per-unit
    attacker/defender indices, so independent targeting shows correctly.
- **Bug caught + fixed during testing:** the first interleave always let side A strike
  first every round → mirror matches went 89% to A (seat bias). Fixed by randomizing the
  leading side each round; mirror is back to ~50/50 (asserted in tests).
- **Balance:** independent attacks raised optimal-play win rate to ~39%, so AI `bidMul`
  was nudged up (cautious .66→.74, aggressive 1.0→1.10, tricky .84→.92). Re-measured:
  optimal ~30% (fair for 1-of-4), casual ~5%. Healthy skill gradient.

## 11. Bigger lineup + wider stat range (2026-11-17)
- **More units:** `UNITS_PER_ROUND` 6 → **8** (24 units auctioned per game).
- **Wider, type-flavoured stats:** replaced the tight hp 16–26 / atk 5–10 roll with
  per-type `STAT_PROFILE` ranges so units vary a lot and each type has character —
  Beast 24–40hp/5–12atk (bruiser), Mage 10–20hp/8–16atk (glass cannon), Archer
  12–24/6–13, Rogue 12–22/7–14, Warrior 20–34/4–10 (tank). Elite ×1.6 extends the top.
- **Animation:** `buildFormation` is now adaptive — gap, figure scale (down to 0.58),
  and a two-rank layout kick in as squads grow, so up to 8 units fit each half of the
  640px canvas without overflow. Verified with a new 8v8 anim stress case.
- **Balance:** 24 units thinned the player's share (optimal play fell to ~15%). Fix was
  AGAIN softening AI `bidMul` (cautious .74→.58, aggressive 1.10→.88, tricky .92→.72),
  NOT a gold dump — a gold increase was tried and reverted because raising everyone's
  gold equally doesn't change the player's unit SHARE vs 3 rivals. Re-measured: optimal
  ~26% (fair for 1-of-4), casual ~7%.

## 12. Animation polish pass (2026-11-17, "improve the animation")
Judgment-call visual improvements (no sim/balance change):
- **Lunge toward target:** on a melee hit the attacker now visibly steps toward the
  SPECIFIC enemy it's striking (uses the hit event's defender index), so with
  independent targeting you can read who is fighting whom. Lunge eases back home.
- **Projectiles:** Archers fire a real arrow (rotated, arrow-head) and Mages a glowing
  magic bolt, both arcing from attacker to target over ~0.38s; the impact (sparks,
  damage, shake) resolves when the projectile lands, so ranged units no longer look
  like melee.
- **Per-unit mini HP bars:** each living unit shows a small HP bar (green/yellow/red)
  under it, so you can see which individual is nearly dead — not just the squad total.
- **Smoother deaths:** units fade + sink as they fall (deadT 0→1) instead of snapping.
- **Impact flash + stronger shake on heavy hits** (dmg > 14): a brief white flash and
  bigger screen shake sell the big blows.
- **Ambient motes:** faint drifting dust across the field for atmosphere.
- Verified: all anim cases (incl. 8v8) pass; logic/flow unchanged. Rendering-only.

## 13. Onboarding + payoff pass (2026-11-17, "improve the game")
Stepped back from mechanics (combat is deep now) to the two biggest WHOLE-GAME gaps:
- **HOW TO PLAY panel** (the big one): a "How to Play" button on the intro opens a full
  rules panel — goal, round structure, the timed-auction bluff, all 5 synergies, all 5
  unit abilities, and how combat works. **Generated from the live game data** (TYPES,
  SYNERGY, ABILITY_NAME/TEXT, MAX_ROUNDS, UNITS_PER_ROUND) so it can never drift from the
  real rules. Verified by a probe test asserting every ability + synergy string appears.
  Rationale: the game had lots of depth but a new player only saw a one-paragraph intro.
- **Richer end screen:** final screen now shows a run recap — your final squad
  composition (type chips), active synergies, points, and gold left — above the
  standings, with a proper ordinal placing. Gives the ending some payoff.
- Additive + rendering-only; no combat/balance change. All four suites still green.

## 14. Battle ROYALE (replaces round-robin) — 2026-11-17
- **Decision (MAJOR):** The battle phase is now a **4-way battle royale** in one arena,
  replacing the round-robin of 1-on-1 matches. All squads fight at once; every living
  unit targets the weakest living enemy unit from ANY other player; a player is
  eliminated when their whole squad falls; last squad standing wins.
- **New `simRoyale(players)`** (the old two-squad `simBattle` is kept only for unit
  tests). Events are keyed by player index: `start` lists all squads, `hit`/`dodge`
  carry `pi,ui` (attacker) + `tpi,tui` (target), plus `death`, `eliminated`, `done`
  (final placement order). Abilities/synergies/first-strike all carry over.
- **Scoring:** placement points — 1st/2nd/3rd/4th → 3/2/1/0 per round (by reverse
  elimination order; survivors ranked by remaining HP). Keeps the 3-round race
  meaningful instead of winner-take-all. Between-round income now rewards placing well.
- **Animation:** rewritten as `animateRoyale` — N colour-coded squads in columns across
  a wider (640×300) arena, each attacker lunging toward/ facing its actual target,
  "<NAME> OUT" banners on elimination. New `test-anim.js` covers 4-squad, uneven,
  empty-squad, 2-squad and skip cases.
- **Balance:** measured under royale — optimal play ~31%, balanced ~17%, timid ~3%
  (fair for 1-of-4; placement scoring smoothed the gradient). No AI re-tune needed.
- New royale logic tests (section 7): permutation validity, dominant squad wins >70%,
  event shape. All suites green.

## 15. Lineup size + starting gold (decided by me, 2026-11-17)
User asked me to decide both. Both made data-driven, not guessed.
- **Units per lineup: KEPT at 8.** Reasoning: with 4 buyers and placement scoring, 8/round
  gives ~2 units each, building to ~6-unit squads by the finale — enough for synergies
  (need 2-3 of a type) and a populated royale. More drags the live timed auction; fewer
  starves synergies. No change (changing it just to change would be churn).
- **Starting gold: 100 → 90.** Made START_GOLD a named constant and SWEPT it headlessly
  (80/100/120/140/160) measuring optimal-play win rate: 80g→28%, 100g→35%, 120g→50%,
  140g→63%, 160g→68%. Finding (corrects an earlier assumption): gold does NOT wash out
  equally — more gold favours the human, because a fixed-fraction bidder out-contests the
  AIs' valuation-capped ceilings. Picked **90g** → ~26% (fair for 1-of-4, ~8 units/game),
  the sweet spot between 80g (a touch starved) and 100g (slightly player-favoured).
- Verified 90g with a confirmation run; all suites green. (Sweep script was throwaway,
  removed after use.)

## 16. Per-unit HP bars + unit movement + gold value (2026-11-17)
- **Separate HP bars:** dropped the aggregate per-squad HP bar; the PRIMARY readout is
  now a per-unit HP bar floating above each living fighter's head (green/yellow/red).
  Squads keep only a light name + "N/M left" label.
- **Units move around:** each unit has a home slot plus an eased movement offset
  (ox/oy → tox/toy). On a melee attack a unit now ADVANCES most of the way to its
  specific target and eases back; idle units gently wander. Draw order is y-sorted so
  movers overlap correctly. Ranged units fire from their live (moving) position.
- **Estimated gold value:** new `estimateValue(unit)` (neutral stat value, elite-
  adjusted, no persona/synergy noise) shown as "Est. value ~Ng" on the auction unit card
  and "~Ng" on every lineup mini-card — a price anchor for bidding.
- Tests: estimateValue checks (positive, monotonic, elite>common, integer) added; anim
  suite covers the movement/bar changes across all royale configs. All suites green.

## 17. Stacking synergies (2026-11-17)
- **Decision:** synergies now **STACK per unit** instead of capping at the 2/3 tiers.
  Every same-type unit beyond the first keeps adding its buff (with a sane ceiling):
  Warrior +12% armor/unit (cap 70%), Mage +13% atk/unit (cap +120%), Beast +15% hp/unit
  (cap +150%), Rogue first-strike at 2+ and +8% dodge/unit (cap 35%), Archer +1 opening
  volley shot per archer (cap 3 each). So 4 Warriors now beat 3, 5 beat 4, etc.
- **Single source of truth:** new `synergyEffect(type,n)` + `synergyText(type,n)` drive
  combat (`buildUnits`), the auction synergy read-out, and the how-to panel — they can't
  disagree. Replaced the old `tiers`/`SYNERGY[t][2|3]` lookups and `volleyBonus` with a
  per-archer `volleyShots`.
- **Balance:** stacking raised optimal-play win rate to ~41% (player-favoured, because a
  focus-fire buyer snowballs one type harder than the spread-buying AIs). Pulled back via
  starting gold **90 → 75** (the lever validated in §15's sweep): optimal play now ~33%,
  balanced ~13%, timid ~6% — back in the fair 1-of-4 band.
- Tests: section 2 rewritten to assert stacking (buffs grow past 3, caps hold, archer
  shots stack). All suites green.

## 18. Persistent stats + replay meta-layer (2026-11-18, "keep improving")
Stepped back from the (now very deep) systems to the biggest WHOLE-GAME gap: no
reason to replay, no sense of improvement. Added a lightweight meta-layer.
- **Lifetime stats in localStorage** (key `bluffMarket.stats.v1`): games, wins, win
  rate, current streak, best streak, best finish. Safe fallback to in-memory if storage
  is blocked (private mode / file://) — wrapped in try/catch, degrades silently.
- **Surfaced** on the intro ("Record: 3W / 10 played (30%) · best streak 2") and the end
  screen (lifetime line + a celebratory "🔥 new best streak!" / "new best finish" note).
- **Also fixed** a stale how-to line that still described the old round-robin ("+1 point
  per win") — now correctly says battle royale with placement scoring.
- Tests: new `test-stats.js` (streak inc/reset, bestPlace tracking, persistence round-
  trip, statsLine) — 13 checks. Caught + fixed a wrong test assertion (bestPlace is the
  BEST finish, a later worse place must not overwrite it). All 5 suites green.

## 19. Graphics polish pass (2026-11-18, "improve the graphics")
Honest scope: single-file canvas, no art assets — so I raised the quality of everything
drawn procedurally rather than adding sprites.
- **Battlefield backdrop:** dusk sky gradient + low sun glow on the horizon, two parallax
  hill layers, slow drifting clouds, textured ground with a lit horizon strip and
  scattered detail, and a radial **vignette** over the whole scene for depth.
- **Warriors:** metallic sheen highlight clipped to the breastplate, a dark outline for
  definition, a gradient-lit shield with a rim + emblem (boss + cross), via a new
  `lighten(hex,t)` helper. They read as crafted armour now, not flat silhouettes.
- **UI chrome (CSS):** gold gradient-clipped title, layered stage background with inner
  highlight + deeper shadow, glossier unit cards (inset highlight), and a canvas frame
  with inner shadow. Consistent "lit from above" look across the DOM and canvas.
- Rendering-only; all suites green. Noted for the user: true sprite/photoreal art would
  need external assets, which a single self-contained file can't carry.

## 20. Packaging + deploy, and multiplayer scoping (2026-11-18)
- **Packaged as a deployable static site:** added README, MIT LICENSE, .gitignore,
  .gitattributes, package.json (`npm test` runs all suites via run-tests.js; `npm start`
  serves locally via serve.js), a GitHub Pages workflow (test → deploy) and netlify.toml.
  Initialised a git repo on `main` with a REPO-LOCAL identity (global git config left
  untouched) and made the first commit. Not pushed — that needs the user's repo choice
  and GitHub auth.
- **Deploy path:** static site, so GitHub Pages (wired via Actions) or Netlify; the live
  URL is `https://<user>.github.io/<repo>/` once pushed and Pages source is set to Actions.
- **Multiplayer: scoped, NOT built.** Wrote MULTIPLAYER.md — real online 4-player is a
  ~4–6 day server project (authoritative Node server + WebSockets + rooms + reconnect,
  because the hidden-gold bluff is adversarial and can't be trusted client-side), needs a
  non-static host (Render/Railway/Fly/VPS). The existing pure sim functions (simRoyale,
  buildUnits) port to the server almost unchanged. Offered a client-only **hot-seat** (~1
  day) as the cheap middle ground. Left the choice to the user rather than half-building a
  backend on assumptions.

## 21. Sound (2026-11-18, "keep improving" — now live-deployed)
- **Web Audio sound layer**, fully synthesized (no asset files, keeps the single-file
  ethos): bid blips (yours higher-pitched), tense timer ticks under 3s, melee/heavy-hit
  thuds, elimination sting, victory fanfare / defeat cadence.
- **Safe by construction:** no `AudioContext` (headless tests, old browsers) → every call
  no-ops; `setTimeout`-free fallback; verified by a probe (ctx null, nothing throws).
  Audio is unlocked/resumed on the first user gesture (browser autoplay policy), and a
  **🔊/🔇 mute toggle** on the intro persists to localStorage.
- Chosen as the top "feel" upgrade from the earlier what-else map; complements the
  existing tension/impact beats. All suites green; committed to auto-deploy via the Pages
  workflow.

## Status (updated 2026-11-17, after timed-auction + battle-animation changes)
- Game is **built, syntax-validated, and fully tested** after both changes.
- **Logic tests** (`test-harness.js`): 17 checks pass — unit validity, AI bid bounds,
  synergy response, all 5 synergy bonuses, stronger squads win >80%, empty-squad
  battles safe, mirror matches ~50/50.
- **End-to-end flow** (`test-flow.js`): **125/125 games complete cleanly** through the
  new timed auction + animated battles — no crashes/hangs, 20 distinct champions,
  every auction/battle control exercised (raise, all-in, min, drop-out, skip, next
  match, next round).
- **Balance diagnostic** (`test-diag.js`): a player who re-bids to a sensible budget
  wins **~5.9 units/game** (of 12) and **~47% of games** — confirms the timed auction is
  fair and the player is not shut out.
- **Bug fixed during testing:** the canvas guard checked for the `getContext` method
  rather than its return value; hardened to skip animation gracefully when no 2D context
  is available (defensive — real browsers always provide one).
- Run tests: `node test-harness.js`, `node test-flow.js`, `node test-diag.js`.
- Still worth a manual play in a real browser to feel the live-auction tension and the
  fight animation — open `index.html`.

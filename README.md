
A single-file **auction autobattler** for the browser. Bid with a poker face at a
live timed auction, build a squad, then **deploy your troops by hand** and win a 4-way
battle. You vs. 3 AI rivals.

**▶ [Play it live](https://dominickbarry.github.io/bluff-market/)**

> Your gold is **hidden** from everyone else — the whole game is reading the table and
> timing your bids. Act rich to scare rivals off a unit you don't want, or sit quiet and
> snipe the one you do at the buzzer.

## Play

Open `index.html` in any modern browser — that's it, no build step. Or run a local
server so you're not on a restricted `file://` path:

```
npm start
# then open http://localhost:8080
```

## How it plays

Each of the **3 rounds** has two phases:

1. **Timed auction** — 8 units are sold one at a time. A countdown runs and **resets on
   every raise** ("going once, going twice"). Highest bid when the clock hits zero wins
   and pays. Your gold is secret; rivals only see what you bid.
2. **Live deployment battle** — what you won is your army, and you place it on the field
   **one troop at a time, in real time**. Every **5 seconds** a deploy slot opens: pick a
   troop from your bench and **click anywhere on the arena** to drop it in. The 3 AI
   rivals each deploy one troop every 5 seconds too, so the battlefield fills up as you
   fight. A player is **out** when they have no troops left on the field *and* none left
   in reserve. Last army standing wins the round; placement scores **3 / 2 / 1 / 0**.
   Most points after 3 rounds takes the crown.

Once on the field, every unit moves and attacks on its own timer, chasing the **nearest**
enemy. Archers and mages keep their distance and fire while backing away (kiting); melee
charge in. **Where and when you drop each troop is the whole game** — hold your archers
back, wall up front with a tank, or flank. In a hurry? **AUTO-DEPLOY REST** lets the game
place your remaining troops for you. Battles play out on one of **5 themed maps** (pure
scenery — the shape never changes the combat).

**Synergies** stack: every same-type unit beyond the first adds to a squad-wide bonus
(Warrior armor, Mage attack, Beast health, Rogue first-strike + dodge, Archer volley).
**Each unit type also has a signature ability** (Bulwark, First Volley, Arcane Burst,
Frenzy, Backstab). The in-game **How to Play** panel explains it all, generated from the
live rules so it never goes stale.

## Develop & test

Pure HTML + CSS + vanilla JS in one file (`index.html`). No dependencies. The game logic
is tested headlessly (the suites run the real in-file code in a VM with a DOM stub).
Run every gated suite with:

```
npm test        # = node run-tests.js
```

- `test-harness.js` — unit/combat logic (synergies stack, abilities fire, royale rules)
- `test-anim.js` — battle animation renders across squad sizes without errors
- `test-flow.js` — full games complete end to end through the UI
- `test-live.js` — the live deploy battle runs on a real canvas and actually finishes
  (interactive deploy-loop smoke test across several squad shapes)
- `test-stats.js` — persistent win/streak stats
- `test-diag.js` — balance diagnostic (informational win-rate numbers)

`test-harness.js` and `test-anim.js` still cover the underlying combat sim that both the
live battle and the diagnostics build on. See [`DECISIONS.md`](DECISIONS.md) for the full
design-decision log.

## Deploy to a public URL

The site is **static** (just `index.html`), so any static host works.

### GitHub Pages (recommended — already wired)
1. Create a repo and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) runs the tests and publishes.
   Your game goes live at `https://<user>.github.io/<repo>/`.

### Netlify (alternative)
Connect the repo at [app.netlify.com](https://app.netlify.com) — `netlify.toml` already
sets it to publish the repo root. Drag-and-drop the folder onto the Netlify dashboard
also works for an instant deploy.

## Multiplayer

The current game is single-player (you + 3 AI). **Real online multiplayer is a separate
project** — it needs a server and a networking layer. See
[`MULTIPLAYER.md`](MULTIPLAYER.md) for an honest design + effort breakdown before
committing to it.

## License

MIT — see [`LICENSE`](LICENSE).

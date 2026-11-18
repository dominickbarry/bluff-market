# Real multiplayer — design & effort

The game today runs **entirely in the browser**: one player, three AI rivals, all logic
(auction, bidding, combat) on the client. Real online multiplayer is not a tweak to this
file — it's a new piece of software. This doc is the honest scope so you can decide
whether to commit to it, and if so, pick a path.

## Why it's a real project, not an edit

The hidden-gold bluff is the core of the game — which makes it adversarial. If four
browsers each ran their own copy and just messaged each other, any player could lie about
their gold or their bid. So the authoritative state **must** live on a server the clients
can't tamper with:

- **Authoritative server** holds each player's real gold, runs the auction clock, decides
  who wins each unit, and resolves the battle royale. Clients only send intents ("I bid
  X") and render what the server reports.
- **Real-time transport** (WebSocket) pushes auction state — current high bid, clock,
  who's leading — to all four players many times a second, and accepts their raises.
- **Matchmaking / rooms** — create a room, share a code, wait for 2–4 humans, fill empty
  seats with the existing AI so a game can start under-full.
- **Reconnect / timeout handling** — someone's wifi drops mid-auction; the server must
  keep the game sane (auto-pass, or sub in AI).

The good news: the game logic already **separates simulation from rendering**
(`simRoyale`, `buildUnits`, the auction resolution are pure functions over state). That
same code can run on a Node server almost unchanged — the hard part is the networking and
room lifecycle around it, not re-deriving the rules.

## Recommended architecture

```
┌────────────┐   WebSocket    ┌──────────────────────────┐
│  Browser   │ ─ bid intent ─▶│  Node server (authoritative)│
│ (renderer) │◀─ state push ──│  • rooms + matchmaking      │
└────────────┘                │  • auction clock + resolve  │
   ×2–4 players                │  • simRoyale battle resolve │
                              └──────────────────────────┘
```

- **Server:** Node + `ws` (or Socket.IO). Reuse the existing pure game functions.
- **Client:** strip the local AI auction loop; replace "place a bid locally" with "send a
  bid message" and "render auc state" with "render the state the server sent". The battle
  animation stays exactly as-is — it already replays a server-produced event timeline.
- **Shared code:** move `simRoyale`, `buildUnits`, synergy/ability logic into a module
  both the server and (optionally) client import, so the rules live in one place.

## Effort estimate (rough, honest)

| Phase | Work | Size |
|-------|------|------|
| 0 | Extract game logic into a shared module; keep single-player working | ~0.5 day |
| 1 | Node WS server: rooms, join-by-code, seat fill with AI | ~1 day |
| 2 | Server-side timed auction (clock, bids, resolve) + client wiring | ~1–2 days |
| 3 | Server-side battle resolve + push event timeline to clients | ~0.5 day |
| 4 | Reconnect, timeouts, disconnect → AI takeover, edge cases | ~1 day |
| 5 | Deploy the server (it can't be static — needs a host that runs Node) | ~0.5 day |

**~4–6 focused days**, plus ongoing hosting.

## Hosting reality

Static GitHub Pages / Netlify **cannot** host the multiplayer server — they only serve
files. You'd need a host that runs a Node process with WebSockets, e.g.:

- **Render / Railway / Fly.io** — free or cheap tiers, WebSocket-friendly, easy deploy.
- **A small VPS** — more control, ~$5/mo.

The static client can still live on Pages/Netlify and just connect to the server's URL.

## A cheaper middle ground

If "four humans online" is more than you want to build right now, two smaller options give
a lot of the social fun for far less:

1. **Hot-seat / pass-and-play** — 2–4 humans share one screen, taking the auction in
   turns. **No server, no hosting** — it's a client-only change (track whose turn, hide
   gold between handoffs). ~1 day. This is the realistic "multiplayer" for a single-file
   game.
2. **Async / shared-seed** — everyone plays the same generated lineup solo and compares
   scores via a shareable seed code. Also client-only. ~0.5 day.

## Recommendation

- Want it playable-with-friends soon and cheap → **hot-seat** (client-only, I can do it).
- Want true online 4-player → commit to the **~4–6 day server project** above; I'd start
  with Phase 0 (extract the shared module) so single-player keeps working throughout.

Tell me which and I'll start.

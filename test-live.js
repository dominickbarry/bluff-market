// Interactive LIVE DEPLOY battle smoke test.
//
// The real game's battle phase is now a live drag-and-drop deployment arena
// (startBattles -> renderBattleStage -> startLiveBattle) that runs on a canvas
// + requestAnimationFrame, NOT the pre-computed simRoyale replay (which the
// other suites still cover). Here we drive the INTERACTIVE path with a real
// recording 2D context and a fake clock: we simulate the player arming a bench
// troop and clicking the arena to drop it, let the AI rivals auto-deploy, pump
// frames, and assert every battle (a) draws, (b) terminates, and (c) hands off
// to finishRoyaleUI (the NEXT ROUND / SEE FINAL RESULT button appears). This
// guards the whole live loop — the stalemate cap, elimination, placement — from
// regressions a headless-null-ctx test can't see.

const fs = require("fs"), vm = require("vm"), path = require("path");
const js = fs.readFileSync(path.join(__dirname, "index.html"), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];

function mockCtx() {
  const calls = {};
  return new Proxy({}, {
    get(t, k) {
      if (k === "__calls") return calls;
      if (k === "canvas") return { width: 640, height: 300 };
      if (["fillStyle","strokeStyle","lineWidth","font","textAlign","globalAlpha","lineCap"].includes(k)) return t[k];
      return (...a) => { calls[k] = (calls[k]||0)+1;
        if (k === "createLinearGradient" || k === "createRadialGradient") return { addColorStop(){} }; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

let CLOCK = 0; const now = () => CLOCK;
let rafQ = []; const raf = cb => { rafQ.push(cb); return rafQ.length; }; const caf = () => {};
let byId = {}, theCtx;

function el(tag) {
  const L = {};
  const e = {
    tagName: tag, id: "", value: "", dataset: {}, style: {}, children: [], width: 640, height: 300, disabled: false,
    classList: { add(){}, remove(){}, contains(){return false;}, toggle(){} },
    addEventListener(ev, fn){ (L[ev] ||= []).push(fn); },
    _fire(ev, arg){ (L[ev]||[]).slice().forEach(f => f(arg)); }, _has(ev){ return !!(L[ev] && L[ev].length); },
    appendChild(c){ e.children.push(c); if (c._d) c._d.forEach(d => { if (d.id) byId[d.id] = d; }); },
    getBoundingClientRect(){ return { left:0, top:0, width:640, height:300 }; },
    querySelector(){ return null; },
    querySelectorAll(s){ return s && s.includes("button") ? e.children.filter(c => c.tagName === "button") : []; },
    getContext(){ return tag === "canvas" ? theCtx : null; },
    get innerHTML(){ return e._h || ""; }, set innerHTML(v){ e._h = v; e._d = parse(v); e.children = e._d.slice(); },
    get textContent(){ return e._h || ""; }, set textContent(v){ e._h = v; }
  };
  return e;
}
function parse(h) {
  const out = []; const re = /<(button|input|canvas)\b([^>]*)>/g; let m;
  while ((m = re.exec(h))) {
    const a = m[2]; const x = el(m[1]);
    const id = (a.match(/id="([^"]+)"/)||[])[1];
    const di = (a.match(/data-i="([^"]+)"/)||[])[1];
    if (id) { x.id = id; byId[id] = x; }
    if (di !== undefined) x.dataset.i = di;
    out.push(x);
  }
  return out;
}
function gom(id) { return byId[id] || (byId[id] = (() => { const e = el("div"); e.id = id; return e; })()); }

const sb = { document: { getElementById: gom, createElement: el, querySelector: () => null }, Math, console,
  requestAnimationFrame: raf, cancelAnimationFrame: caf, Date: { now }, performance: { now },
  localStorage: { getItem: () => null, setItem: () => {} }, window: null };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(js.replace("})();", "window.__g={startBattles,players};})();"), sb, { filename: "g.js" });
const G = sb.window.__g;

const PERSONA = { key: "balanced", desc: "test", bluffAmt: 0, bidMul: 1, overbid: 0 };
function mkSquad(types) { return types.map(t => ({ type: t, hp: 22, atk: 9, tier: "common" })); }

let fails = 0;
function runBattle(rosters, label) {
  byId = {}; rafQ = []; CLOCK = 0; theCtx = mockCtx();
  ["phaseTag","phaseBody","playersStrip","roundTag","vsLine","battleSub","killFeed","deployBar","bench"].forEach(id => byId[id] = el("div"));
  G.players.length = 0;
  rosters.forEach((types, i) => G.players.push({
    id: i, name: i === 0 ? "You" : "P"+i, you: i === 0, squad: mkSquad(types),
    gold: 100, apparentGold: 100, points: 0, persona: PERSONA, wins: 0, lastPts: 0
  }));
  try {
    G.startBattles();
    let frames = 0;
    while (rafQ.length && frames++ < 6000) {
      CLOCK += 33; const q = rafQ; rafQ = []; q.forEach(cb => cb(CLOCK));
      // player: whenever the bench offers an enabled troop, arm it and drop it mid-arena
      const bench = byId.bench;
      if (bench && bench.children && bench.children.length) {
        const btn = bench.children.find(c => c.tagName === "button" && !c.disabled);
        if (btn && btn._has("click")) {
          btn._fire("click");
          const cv = byId.battleCanvas;
          if (cv && cv._has("click")) cv._fire("click", { clientX: 300 + Math.random()*60, clientY: 130 + Math.random()*40 });
        }
      }
      if (byId.btnAfter && byId.btnAfter.tagName === "button") break;
    }
    const drew = (theCtx.__calls["fill"]||0) + (theCtx.__calls["stroke"]||0);
    if (!drew) { fails++; console.log(`FAIL [${label}] nothing drawn`); return; }
    if (!byId.btnAfter) { fails++; console.log(`FAIL [${label}] battle never finished (no NEXT button) after ${frames} frames`); return; }
    const sub = (byId.battleSub && byId.battleSub._h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`ok   [${label}] finished in ${frames} frames, draw-calls=${drew} — ${sub.slice(0, 64)}`);
  } catch (e) {
    fails++; console.log(`FAIL [${label}] threw: ${e.message}\n   ${(e.stack||"").split("\n").slice(1,3).join("\n   ")}`);
  }
}

console.log("=== live deploy-battle smoke test ===");
runBattle([["Warrior","Archer","Mage","Beast"],["Rogue","Warrior","Archer"],["Beast","Beast","Mage"],["Warrior","Rogue","Archer","Mage"]], "4 squads, mixed");
runBattle([["Archer","Mage"],["Archer","Mage"],["Archer","Mage"],["Archer","Mage"]], "all-ranged (kite stalemate → cap)");
runBattle([["Warrior","Warrior"],["Beast","Beast"],["Rogue","Rogue"],["Warrior","Beast"]], "all-melee");
runBattle([["Mage","Mage","Mage","Mage","Mage","Mage"],["Warrior"],["Beast"],["Rogue"]], "lopsided (6 vs 1s)");
runBattle([[],["Warrior"],["Beast"],["Mage"]], "one empty inventory (edge)");

console.log("\n=== RESULT ===");
if (fails === 0) { console.log("ALL LIVE BATTLE CHECKS PASSED"); process.exit(0); }
else { console.log(`${fails} LIVE BATTLE CHECK(S) FAILED`); process.exit(1); }

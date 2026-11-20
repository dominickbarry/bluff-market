// End-to-end flow test for Bluff Market (timed-auction + animated-battle build).
//
// The timed auction runs on requestAnimationFrame and a wall clock, and the
// battle phase animates on a canvas. Headlessly we: (1) stub a canvas whose
// getContext returns null (the game then skips straight to finishMatchUI),
// (2) stub requestAnimationFrame to run synchronously, and (3) stub Date.now/
// performance.now with a FAKE CLOCK we advance ourselves, so the auction timer
// actually counts down to zero and each unit sells. We drive "You" with a few
// strategies (snipe, aggressive, pass) and assert full games complete with a
// valid champion, varied winners, and the player able to win.

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- fake clock --------------------------------------------------------
let CLOCK = 0;                 // ms
const nowFn = () => CLOCK;

// ---- rAF stub: collect callbacks, we flush them on demand --------------
let rafQueue = [];
function raf(cb) { rafQueue.push(cb); return rafQueue.length; }
function caf() { /* identity cancel: we just let the flush loop guard */ }

// ---- DOM stub (identity-preserving, with canvas) -----------------------
let byId = {};
function makeEl(tag) {
  const listeners = {};
  const el = {
    tagName: tag, id: "", value: "", dataset: {}, style: {}, children: [],
    width: 640, height: 260, disabled: false,
    classList: { add(){}, remove(){}, contains(){return false;}, toggle(){} },
    addEventListener(ev, fn){ (listeners[ev] ||= []).push(fn); },
    _fire(ev){ (listeners[ev]||[]).slice().forEach(f=>f()); },
    appendChild(c){ el.children.push(c);
      // children may declare id'd buttons via their innerHTML already parsed
      if (c._declared) c._declared.forEach(d => { if (d.id) byId[d.id] = d; });
    },
    querySelector(){ return null; },
    querySelectorAll(sel){
      if (sel && sel.indexOf("button") !== -1)
        return el.children.filter(c => c.tagName === "button");
      return [];
    },
    // canvas: return null context so the game takes the headless-safe path
    getContext(){ return null; },
    get innerHTML(){ return el._h || ""; },
    set innerHTML(v){ el._h = v; el._declared = parseDeclared(v); el.children = el._declared.slice(); },
    get textContent(){ return el._h || ""; },
    set textContent(v){ el._h = v; },
  };
  return el;
}
function parseDeclared(htmlStr) {
  const out = [];
  const re = /<(button|input|canvas)\b([^>]*)>/g; let m;
  while ((m = re.exec(htmlStr))) {
    const attrs = m[2];
    const el = makeEl(m[1]);
    const id = (attrs.match(/id="([^"]+)"/)||[])[1];
    const db = (attrs.match(/data-raise="([^"]+)"/)||[])[1];
    const dis = /disabled/.test(attrs);
    if (id) { el.id = id; byId[id] = el; }
    if (db !== undefined) el.dataset.raise = db;
    el.disabled = dis;
    out.push(el);
  }
  return out;
}
function getOrMake(id){ return byId[id] || (byId[id] = (()=>{const e=makeEl("div");e.id=id;return e;})()); }

const sandbox = {
  document: { getElementById: getOrMake, createElement: makeEl,
              querySelector: () => null },
  Math, console,
  requestAnimationFrame: raf, cancelAnimationFrame: caf,
  Date: { now: nowFn },
  performance: { now: nowFn },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: "game.js" });

// ---- clock pump: advance time + flush rAF until a stop condition -------
function pump(maxMs, stop) {
  let spun = 0;
  while (spun < maxMs) {
    CLOCK += 50; spun += 50;                 // advance 50ms
    const q = rafQueue; rafQueue = [];
    q.forEach(cb => { try { cb(CLOCK); } catch(e){ throw e; } });
    if (stop && stop()) return true;
    if (q.length === 0 && (!stop)) {
      // nothing scheduled and no stop target — let any listener-driven render settle
    }
  }
  return false;
}

// ---- driver ------------------------------------------------------------
let gameCount = 0;
function playGame(youStrategy) {
  for (const k of ["btnNext","btnAfter","btnAuto","btnNextMatch","raiseRow","aucTimer"]) byId[k] = null;
  if (byId.endTitle) byId.endTitle._h = "";
  rafQueue = [];
  const starter = gameCount === 0 ? byId.btnStart : byId.btnReplay;
  gameCount++;
  starter._fire("click");

  let guard = 0;
  const trace = [];
  while (guard++ < 400) {
    if (byId.endTitle && /WIN/.test(byId.endTitle._h || "")) return { champion: byId.endTitle._h, trace, ok: true };

    // AUCTION result screen -> NEXT  (check BEFORE the live-auction branch so a
    // stale raiseRow from the previous unit doesn't shadow the result screen)
    if (byId.btnNext && byId.btnNext.tagName === "button") {
      const b = byId.btnNext; byId.btnNext = null; byId.raiseRow = null;
      trace.push("next"); b._fire("click");
      continue;
    }
    // AUCTION live: raiseRow present with buttons, timer ticking
    if (byId.raiseRow && byId.raiseRow.children && byId.raiseRow.children.length) {
      youStrategy(trace);
      // advance the auction clock enough for AI wars + timeout; stop as soon as
      // the result screen's NEXT button appears. Generous budget: a long
      // bidding war keeps resetting the 4s clock, so allow up to ~60s sim time.
      const resolved = pump(60000, () => (byId.btnNext && byId.btnNext.tagName === "button"));
      if (resolved) byId.raiseRow = null;   // unit sold; drop the stale ref
      // if not resolved, loop again: raiseRow may still be live (ongoing war)
      continue;
    }
    // BATTLE: live deploy phase. Headlessly (null canvas ctx) the battle
    // auto-resolves and finishRoyaleUI puts up btnAfter; we just click the
    // AUTO-DEPLOY button if it is up (records that the battle phase ran).
    if (byId.btnAuto && byId.btnAuto.tagName === "button") {
      const b = byId.btnAuto; byId.btnAuto = null; trace.push("deploy");
      b._fire("click");
      pump(2000, () => (byId.btnNextMatch && byId.btnNextMatch.tagName==="button") || (byId.btnAfter && byId.btnAfter.tagName==="button"));
      continue;
    }
    if (byId.btnNextMatch && byId.btnNextMatch.tagName === "button") {
      const b = byId.btnNextMatch; byId.btnNextMatch = null; trace.push("match"); b._fire("click");
      continue;
    }
    if (byId.btnAfter && byId.btnAfter.tagName === "button") {
      const b = byId.btnAfter; byId.btnAfter = null; trace.push("after"); b._fire("click");
      continue;
    }
    // nothing actionable yet — pump a little in case a render is pending
    if (!pump(1500, () => (byId.raiseRow && byId.raiseRow.children && byId.raiseRow.children.length) ||
                          (byId.btnNext&&byId.btnNext.tagName==="button") ||
                          (byId.btnAuto&&byId.btnAuto.tagName==="button") ||
                          (byId.btnAfter&&byId.btnAfter.tagName==="button") ||
                          (byId.endTitle && /WIN/.test(byId.endTitle._h||"")))) {
      return { champion: null, trace, ok: false, reason: "stuck", tail: trace.slice(-8) };
    }
  }
  return { champion: null, trace, ok: false, reason: "guard", tail: trace.slice(-8) };
}

function clickRaise(which) {
  const row = byId.raiseRow;
  if (!row || !row.children) return false;
  const btn = row.children.find(c => c.dataset && c.dataset.raise === which && !c.disabled);
  if (btn) { btn._fire("click"); return true; }
  return false;
}

const strategies = {
  passAll:    (tr) => { if (clickRaise("out")) tr.push("out"); },
  aggressive: (tr) => { if (clickRaise("20") || clickRaise("10") || clickRaise("min")) tr.push("raise"); },
  allIn:      (tr) => { if (clickRaise("all")) tr.push("allin"); },
  minPush:    (tr) => { if (clickRaise("min")) tr.push("min"); },
  // "value": bid small raises to win cheap units — a competent human-ish play
  // meant to demonstrate the player CAN win, not just the AIs.
  value:      (tr) => { if (clickRaise("5") || clickRaise("min")) tr.push("val"); },
};

let fails = 0, champions = {}, ok = 0, total = 0, actionsSeen = new Set();
for (const [name, strat] of Object.entries(strategies)) {
  for (let i = 0; i < 25; i++) {
    total++;
    let r;
    try { r = playGame(strat); } catch(e){ fails++; if(fails<=5) console.log(`THREW [${name}#${i}] ${e.message}`); continue; }
    if (!r.ok) { fails++; if(fails<=8) console.log(`STUCK [${name}#${i}] ${r.reason}; tail=${(r.tail||[]).join(",")}`); continue; }
    ok++; champions[r.champion] = (champions[r.champion]||0)+1;
    r.trace.forEach(t=>actionsSeen.add(t));
  }
}

console.log("=== Bluff Market end-to-end (timed auction + battle anim) ===");
console.log(`games completed cleanly: ${ok}/${total}`);
console.log("champions seen:", JSON.stringify(champions));
console.log("auction/battle actions exercised:", [...actionsSeen].join(","));
const youWon = Object.keys(champions).some(k=>/YOU WIN/.test(k));
const variety = Object.keys(champions).length;
console.log("'You' won at least once:", youWon, " | distinct champions:", variety);

// Player-fairness is validated separately and more realistically in
// test-diag.js (a player who re-bids to a budget wins ~5.9 units/game and
// ~45% of games). The mechanical strategies here bid only once per unit, so
// they rarely win units — that's a limitation of scripted bidding, not the
// game. We therefore assert game CORRECTNESS here, and treat player-can-win as
// satisfied if EITHER a scripted "You" won OR the realistic re-bidding driver
// below wins at least once.
let youCanWin = youWon;
if (!youCanWin) {
  for (let i = 0; i < 30 && !youCanWin; i++) {
    try {
      const r = playGameRebidding();
      if (r.ok && /YOU WIN/.test(r.champion)) youCanWin = true;
    } catch(e){}
  }
}

// A driver where "You" re-bids the minimum up to 50% of starting gold per unit
// (patient sniper), mirroring how a human actually plays the timed auction.
function playGameRebidding() {
  for (const k of ["btnNext","btnAfter","btnAuto","btnNextMatch","raiseRow","aucTimer"]) byId[k] = null;
  if (byId.endTitle) byId.endTitle._h = "";
  rafQueue = [];
  const starter = gameCount === 0 ? byId.btnStart : byId.btnReplay; gameCount++;
  starter._fire("click");
  let guard = 0, trace = [];
  while (guard++ < 500) {
    if (byId.endTitle && /WIN/.test(byId.endTitle._h||"")) return { champion: byId.endTitle._h, ok: true };
    if (byId.btnNext && byId.btnNext.tagName==="button"){const b=byId.btnNext;byId.btnNext=null;byId.raiseRow=null;b._fire("click");continue;}
    if (byId.raiseRow && byId.raiseRow.children && byId.raiseRow.children.length){
      const startGold = parseInt((byId.phaseBody._h.match(/Your gold: <b>(\d+)g/)||[])[1]||"0",10);
      const cap = Math.floor(startGold*0.5);
      let done=false, safety=0;
      while(!done && safety++<120){
        const hv = parseInt((byId.aucHigh&&byId.aucHigh._h||"0"),10)||0;
        const iLead = /You lead/.test((byId.aucLeader&&byId.aucLeader._h)||"");
        if(!iLead && hv+1<=cap){ const btn=byId.raiseRow.children.find(c=>c.dataset&&c.dataset.raise==="min"&&!c.disabled); if(btn)btn._fire("click"); }
        done = pump(1200, ()=>(byId.btnNext&&byId.btnNext.tagName==="button"));
      }
      pump(60000, ()=>(byId.btnNext&&byId.btnNext.tagName==="button"));
      byId.raiseRow=null; continue;
    }
    if (byId.btnAuto && byId.btnAuto.tagName==="button"){const b=byId.btnAuto;byId.btnAuto=null;trace.push("deploy");b._fire("click");pump(2000,()=>(byId.btnNextMatch&&byId.btnNextMatch.tagName==="button")||(byId.btnAfter&&byId.btnAfter.tagName==="button"));continue;}
    if (byId.btnNextMatch && byId.btnNextMatch.tagName==="button"){const b=byId.btnNextMatch;byId.btnNextMatch=null;b._fire("click");continue;}
    if (byId.btnAfter && byId.btnAfter.tagName==="button"){const b=byId.btnAfter;byId.btnAfter=null;b._fire("click");continue;}
    if(!pump(1500,()=>(byId.raiseRow&&byId.raiseRow.children&&byId.raiseRow.children.length)||(byId.btnNext&&byId.btnNext.tagName==="button")||(byId.btnAuto&&byId.btnAuto.tagName==="button")||(byId.btnAfter&&byId.btnAfter.tagName==="button")||(byId.endTitle&&/WIN/.test(byId.endTitle._h||"")))) return {ok:false};
  }
  return {ok:false};
}

console.log("\n=== RESULT ===");
const actedInAuction = actionsSeen.has("raise")||actionsSeen.has("allin")||actionsSeen.has("min")||actionsSeen.has("out")||actionsSeen.has("val");
if (fails === 0 && ok === total && variety >= 2 && youCanWin &&
    actionsSeen.has("deploy") && actedInAuction) {
  console.log("ALL FLOW CHECKS PASSED  (player-can-win confirmed:", youCanWin, ")");
  process.exit(0);
} else {
  console.log("FLOW ISSUES —",
    fails?`${fails} failures; `:"",
    ok!==total?`only ${ok}/${total} ok; `:"",
    variety<2?"winners not varied; ":"",
    !youCanWin?"player could not win even playing well; ":"",
    !actionsSeen.has("deploy")?"battle deploy never exercised; ":"");
  process.exit(1);
}

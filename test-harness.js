// Logic tests for Bluff Market — PER-UNIT combat model.
//
// The game logic lives in pure functions inside an IIFE. We append a probe
// that exposes them on window.__t, run the script in a VM with a DOM stub,
// then unit-test directly. These assert the NEW model where each unit keeps
// its own HP and duels individually (buildUnits + simBattle), replacing the
// old aggregate squadPower checks.

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const probe = `
  window.__t = { makeUnit, aiBid, buildUnits, squadTiers, simBattle, PERSONAS, SYNERGY, TYPES, squadSynergies };
`;
const close = js.lastIndexOf("})();");
if (close < 0) { console.error("could not find IIFE close"); process.exit(1); }
js = js.slice(0, close) + probe + js.slice(close);

function fakeEl() {
  return {
    _h: "", value: "", dataset: {}, style: {}, classList: { add(){}, remove(){}, contains(){return false;} },
    set innerHTML(v){this._h=v;} , get innerHTML(){return this._h;},
    set textContent(v){this._h=v;}, get textContent(){return this._h;},
    addEventListener(){}, appendChild(){}, querySelectorAll(){return [];},
  };
}
const sandbox = { document: { getElementById: fakeEl, createElement: fakeEl }, Math, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: "game.js" });

const T = sandbox.window.__t;
if (!T || !T.simBattle || !T.buildUnits) { console.error("probe did not attach"); process.exit(1); }

let fails = 0;
function check(name, cond, detail) {
  if (!cond) { fails++; console.log("  FAIL:", name, detail !== undefined ? "— " + detail : ""); }
  else console.log("  ok  :", name);
}
const U = (type, hp, atk, tier) => ({ type, hp, atk, tier: tier || "common" });

console.log("=== 1. makeUnit: valid units ===");
{
  let bad = 0, elites = 0, legends = 0, typeSeen = {}, tiers = {};
  for (let i = 0; i < 8000; i++) {
    const u = T.makeUnit();
    if (!T.TYPES.includes(u.type)) bad++;
    if (u.hp <= 0 || u.atk <= 0) bad++;
    if (u.tier === "elite") elites++;
    if (u.tier === "legendary") legends++;
    typeSeen[u.type] = true; tiers[u.tier] = true;
  }
  check("all units valid type + positive stats", bad === 0, `${bad} bad`);
  check("all 5 types appear", Object.keys(typeSeen).length === 5);
  check("elite rate near 20%", elites/8000 > 0.15 && elites/8000 < 0.26, `${(100*elites/8000).toFixed(1)}%`);
  check("legendary rate near 5%", legends/8000 > 0.025 && legends/8000 < 0.085, `${(100*legends/8000).toFixed(1)}%`);
  check("only valid tiers appear", Object.keys(tiers).every(t => ["common","elite","legendary"].includes(t)), Object.keys(tiers).join());
  // a legendary should out-stat a common of the same type most of the time
  function sample(type, tier, n){ let hp=0; for(let i=0;i<n;i++){ let u; do{ u=T.makeUnit(); }while(u.type!==type||u.tier!==tier); hp+=u.hp; } return hp/n; }
  const legHp = sample("Beast","legendary",40), comHp = sample("Beast","common",40);
  check("legendary Beast HP >> common Beast HP", legHp > comHp * 1.6, `${comHp.toFixed(0)} vs ${legHp.toFixed(0)}`);
}

console.log("=== 2. buildUnits: per-unit synergy buffs ===");
{
  // STACKING model: buff grows per extra unit (per=Warrior .12, Mage .13,
  // Beast .15, Rogue dodge .08), no 2/3 cap.
  const warr = (n) => T.buildUnits({ squad: Array(n).fill(0).map(()=>U("Warrior",20,8)) });
  const mg   = (n) => T.buildUnits({ squad: Array(n).fill(0).map(()=>U("Mage",10,10)) });
  const bs   = (n) => T.buildUnits({ squad: Array(n).fill(0).map(()=>U("Beast",10,5)) });
  const rg   = (n) => T.buildUnits({ squad: Array(n).fill(0).map(()=>U("Rogue",10,5)) });

  // single unit: no synergy
  check("1 Warrior: no armor", warr(1)[0].armor === 0, `armor=${warr(1)[0].armor}`);
  check("buildUnits keeps unit count", warr(1).length === 1);

  // Warrior armor stacks: 2->0.12, 3->0.24, 4->0.36
  check("2 Warriors armor 0.12", Math.abs(warr(2)[0].armor - 0.12) < 1e-9, warr(2)[0].armor);
  check("3 Warriors armor 0.24", Math.abs(warr(3)[0].armor - 0.24) < 1e-9, warr(3)[0].armor);
  check("4 Warriors armor 0.36 (STACKS past 3)", Math.abs(warr(4)[0].armor - 0.36) < 1e-9, warr(4)[0].armor);

  // Mage attack stacks and keeps growing past 3
  check("2 Mages atk x1.13 (10->11)", mg(2)[0].atk === Math.round(10*1.13), mg(2)[0].atk);
  check("4 Mages atk > 3 Mages atk (STACKS)", mg(4)[0].atk > mg(3)[0].atk, `${mg(3)[0].atk} -> ${mg(4)[0].atk}`);

  // Beast hp stacks past 3
  check("4 Beasts hp > 3 Beasts hp (STACKS)", bs(4)[0].maxHp > bs(3)[0].maxHp, `${bs(3)[0].maxHp} -> ${bs(4)[0].maxHp}`);

  // Rogue: firstStrike at 2+, dodge stacks per unit
  check("2 Rogues firstStrike", rg(2).every(u=>u.firstStrike));
  check("4 Rogues dodge > 2 Rogues dodge (STACKS)", rg(4)[0].dodge > rg(2)[0].dodge, `${rg(2)[0].dodge} -> ${rg(4)[0].dodge}`);

  // Archer: more archers -> more volley shots each (STACKS, capped at 3)
  const ar = (n) => T.buildUnits({ squad: Array(n).fill(0).map(()=>U("Archer",16,7)) });
  check("1 Archer: 1 volley shot", ar(1)[0].volleyShots === 1, ar(1)[0].volleyShots);
  check("3 Archers: more shots than 1 (STACKS)", ar(3)[0].volleyShots > ar(1)[0].volleyShots, `${ar(1)[0].volleyShots} -> ${ar(3)[0].volleyShots}`);

  // caps hold: huge Warrior stack does not exceed 0.70 armor
  check("Warrior armor capped at 0.70", warr(12)[0].armor <= 0.70, warr(12)[0].armor);
}

console.log("=== 3. simBattle: per-unit outcomes ===");
{
  // stronger squad wins big majority
  const strong = { you:false, name:"S", squad:[U("Beast",25,10,"elite"),U("Beast",25,10,"elite"),U("Beast",25,10,"elite")] };
  const weak   = { you:false, name:"W", squad:[U("Archer",16,5)] };
  let sw=0, N=3000, threw=0;
  for (let i=0;i<N;i++){ try{ if(T.simBattle(strong,weak,[])===strong) sw++; }catch(e){threw++;} }
  check("simBattle never throws", threw===0, `${threw} threw`);
  check("stronger squad wins >80%", sw/N>0.80, `${(100*sw/N).toFixed(1)}%`);

  // more units beats fewer, all else equal (3 identical vs 1 identical)
  const three = { you:false, name:"3", squad:[U("Warrior",18,7),U("Warrior",18,7),U("Warrior",18,7)] };
  const oneU  = { you:false, name:"1", squad:[U("Warrior",18,7)] };
  let mw=0, M=3000;
  for (let i=0;i<M;i++){ if(T.simBattle(three,oneU,[])===three) mw++; }
  check("3 units beat 1 unit >90%", mw/M>0.90, `${(100*mw/M).toFixed(1)}%`);

  // mirror match ~50/50 (no seat bias)
  const mkmir = () => ({ you:false, name:"m", squad:[U("Warrior",20,8),U("Archer",18,7)] });
  let aw=0, MM=4000;
  for (let i=0;i<MM;i++){ const a=mkmir(),b=mkmir(); a.name="A";b.name="B"; if(T.simBattle(a,b,[])===a) aw++; }
  const mr=aw/MM;
  check("mirror ~50/50 (no seat bias)", mr>0.42 && mr<0.58, `A won ${(100*mr).toFixed(1)}%`);

  // winner always finishes with >=1 unit alive (reconstruct from events)
  let badWinner=0, K=2000;
  for (let i=0;i<K;i++){
    const a={you:false,name:"A",squad:[U("Warrior",20,8),U("Mage",14,9)]};
    const b={you:false,name:"B",squad:[U("Beast",22,7),U("Rogue",12,8)]};
    const evs=[]; const w=T.simBattle(a,b,[],evs);
    // count deaths per side from events; winner's side should have < its unit count deaths
    const startEv = evs[0];
    const deaths = {a:0,b:0}; evs.forEach(e=>{ if(e.kind==="death") deaths[e.side]++; });
    const winSide = (w===a)?"a":"b";
    const total = winSide==="a"?startEv.aUnits.length:startEv.bUnits.length;
    if (deaths[winSide] >= total) badWinner++;   // winner lost all units -> wrong
  }
  check("winner always keeps >=1 unit alive", badWinner===0, `${badWinner} bad`);
}

console.log("=== 4. simBattle: empty-squad safety + event shape ===");
{
  let threw=0, got=0;
  for (let i=0;i<500;i++){
    const e1={you:false,name:"A",squad:[]}, e2={you:false,name:"B",squad:[]};
    try{ const w=T.simBattle(e1,e2,[]); if(w===e1||w===e2) got++; }catch(e){threw++;}
  }
  check("empty-vs-empty does not throw", threw===0, `${threw}`);
  check("empty-vs-empty returns a player", got===500, `${got}/500`);

  // events: start carries per-unit arrays; hits reference indices; a ko exists
  const a={you:false,name:"A",squad:[U("Warrior",20,8),U("Archer",16,6)]};
  const b={you:false,name:"B",squad:[U("Mage",12,10)]};
  const evs=[]; T.simBattle(a,b,[],evs);
  const s=evs[0];
  check("start event has aUnits/bUnits arrays", Array.isArray(s.aUnits)&&Array.isArray(s.bUnits)&&s.aUnits.length===2&&s.bUnits.length===1);
  const hit=evs.find(e=>e.kind==="hit");
  check("hit events carry attacker/defender indices + defHp", !!hit && typeof hit.ai==="number" && typeof hit.di==="number" && typeof hit.defHp==="number", JSON.stringify(hit));
  check("a ko event is emitted", evs.some(e=>e.kind==="ko"));
  check("death events emitted when units fall", evs.some(e=>e.kind==="death"));
}

console.log("=== 5. aiBid: still bounded + synergy-aware ===");
{
  const persona = T.PERSONAS.find(p=>p.key==="aggressive");
  const p = { gold:50, squad:[], persona };
  let over=0, neg=0;
  for (let i=0;i<4000;i++){ const u=T.makeUnit(); const bid=T.aiBid(p,u); if(bid>p.gold)over++; if(bid<0)neg++; }
  check("aiBid never exceeds gold", over===0, `${over}`);
  check("aiBid never negative", neg===0, `${neg}`);
}

console.log("=== 6. no signature abilities (removed) + plain armor damage ===");
{
  // Abilities (Frenzy / Burst / Backstab / Bulwark / First Volley) were removed:
  // combat is now a plain attack reduced only by the target's (synergy) armor.
  // (1) No battle should EVER emit an "ability" event, from any unit type.
  {
    let abilityEvents = 0, N = 120;
    const squads = [
      [U("Beast",24,9)], [U("Mage",14,9)], [U("Rogue",14,9)], [U("Warrior",40,6)], [U("Archer",16,8)],
    ];
    for (let i = 0; i < N; i++) {
      for (const sq of squads) {
        const evs = [];
        T.simBattle({you:false,name:"A",squad:sq}, {you:false,name:"B",squad:[U("Warrior",30,7)]}, [], evs);
        abilityEvents += evs.filter(e => e.kind === "ability").length;
      }
    }
    check("no ability events are emitted anymore", abilityEvents === 0, `${abilityEvents} seen`);
  }

  // (2) Armor still reduces damage: a Warrior-stacked (armored) squad takes less
  // damage from identical hits than a no-armor single Warrior. Measure average
  // damage of hits landed on each over many fights.
  {
    function avgHitOnDefender(defSquad, N) {
      let tot = 0, n = 0;
      for (let i = 0; i < N; i++) {
        const evs = [];
        // attacker: 3 plain Warriors; defender: the squad under test
        T.simBattle({you:false,name:"A",squad:[U("Warrior",30,9),U("Warrior",30,9),U("Warrior",30,9)]},
                    {you:false,name:"B",squad:defSquad}, [], evs);
        evs.forEach(e => { if (e.kind === "hit" && e.side === "a") { tot += e.dmg; n++; } });
      }
      return n ? tot/n : 0;
    }
    const N = 120;
    // armored defender: 4 Warriors (stacked armor synergy) vs an un-armored lone Beast
    const armoredAvg = avgHitOnDefender([U("Warrior",30,6),U("Warrior",30,6),U("Warrior",30,6),U("Warrior",30,6)], N);
    const softAvg    = avgHitOnDefender([U("Beast",30,6)], N);
    check("armor reduces incoming damage", armoredAvg < softAvg, `armored ${armoredAvg.toFixed(2)} < soft ${softAvg.toFixed(2)}`);
  }

  // (3) Units still deal damage and battles still resolve to a winner.
  {
    const evs = [];
    const w = T.simBattle({you:false,name:"A",squad:[U("Rogue",18,10),U("Rogue",18,10)]},
                          {you:false,name:"B",squad:[U("Archer",16,8)]}, [], evs);
    const hits = evs.filter(e => e.kind === "hit").length;
    check("plain attacks still land", hits > 0, `${hits} hits`);
    check("battle still resolves to a winner", !!w, w && (w.name||"?"));
  }
}

console.log("=== 6b. estimateValue (gold price anchor) ===");
{
  // need the probe to expose estimateValue; re-run a probe for it
  let jsv = fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  jsv = jsv.slice(0, jsv.lastIndexOf("})();")) + "window.__v={estimateValue};" + jsv.slice(jsv.lastIndexOf("})();"));
  const sbv = { document: { getElementById: fakeEl, createElement: fakeEl }, Math, console }; sbv.window = sbv;
  vm.createContext(sbv); vm.runInContext(jsv, sbv, {filename:"gv"});
  const estv = sbv.window.__v.estimateValue;
  check("estimateValue positive", estv(U("Warrior",20,8)) > 0);
  check("higher stats -> higher value", estv(U("Beast",40,12)) > estv(U("Mage",10,8)));
  check("elite worth more than same-stat common",
    estv({type:"Warrior",hp:20,atk:8,tier:"elite"}) > estv({type:"Warrior",hp:20,atk:8,tier:"common"}));
  check("value is an integer", Number.isInteger(estv(U("Rogue",17,11))));
}

console.log("=== 7. battle royale (simRoyale) ===");
{
  // expose simRoyale via a second probe run
  let js2 = fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
  js2 = js2.slice(0, js2.lastIndexOf("})();")) + "window.__r={simRoyale};" + js2.slice(js2.lastIndexOf("})();"));
  const sb2 = { document: { getElementById: fakeEl, createElement: fakeEl }, Math, console };
  sb2.window = sb2; vm.createContext(sb2); vm.runInContext(js2, sb2, {filename:"g2"});
  const R = sb2.window.__r.simRoyale;
  const P = (id,name,squad)=>({id,name,you:id===0,squad});

  // placement is always a valid permutation of all players, no throws
  let bad=0, threw=0, N=400;
  for (let i=0;i<N;i++){
    const pls=[P(0,"A",[U("Warrior",20,8),U("Mage",14,9)]),P(1,"B",[U("Beast",24,7)]),
               P(2,"C",[U("Rogue",14,9),U("Archer",16,7)]),P(3,"D",[U("Warrior",20,8)])];
    try { const place=R(pls,[], []); 
      if (place.length!==4 || new Set(place.map(p=>p.id)).size!==4) bad++;
    } catch(e){ threw++; }
  }
  check("royale never throws", threw===0, `${threw}`);
  check("royale placement is a valid permutation", bad===0, `${bad} bad`);

  // a clearly dominant squad should place 1st the large majority of the time
  let first=0, M=400;
  for (let i=0;i<M;i++){
    const strong=P(0,"STRONG",[U("Beast",30,12,"elite"),U("Beast",30,12,"elite"),U("Warrior",28,9)]);
    const w1=P(1,"w1",[U("Archer",14,5)]), w2=P(2,"w2",[U("Mage",10,6)]), w3=P(3,"w3",[U("Rogue",12,6)]);
    const place=R([strong,w1,w2,w3],[],[]);
    if (place[0].id===0) first++;
  }
  check("dominant squad usually wins royale (>70%)", first/M>0.70, `${(100*first/M).toFixed(1)}%`);

  // events: start carries all squads; eliminated + done events appear
  const evs=[];
  R([P(0,"A",[U("Warrior",18,8)]),P(1,"B",[U("Mage",12,9)]),P(2,"C",[U("Beast",16,7)]),P(3,"D",[U("Rogue",10,8)])],[],evs);
  const s=evs[0];
  check("royale start lists all squads", s.kind==="start" && Array.isArray(s.squads) && s.squads.length===4);
  check("royale emits eliminated events", evs.some(e=>e.kind==="eliminated"));
  check("royale emits a done event with full order", evs.some(e=>e.kind==="done" && e.order && e.order.length===4));
  const hit=evs.find(e=>e.kind==="hit");
  check("royale hits carry pi/ui + tpi/tui", !!hit && typeof hit.pi==="number" && typeof hit.tpi==="number" && typeof hit.tui==="number", JSON.stringify(hit));
}

console.log("\n=== RESULT ===");
console.log(fails === 0 ? "ALL CHECKS PASSED" : `${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);

// Verifies the dev TEST PANEL's live-tuning mechanism: mutating TUNING changes
// the numbers combat actually uses. The panel UI writes into TUNING; here we
// write into TUNING directly (same effect) and confirm buildUnits / makeUnit
// pick up the new per-type range, speed, cooldown and HP/ATK roll ranges.

const fs = require("fs"), vm = require("vm"), path = require("path");
const js = fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
function el(){ const e={ style:{}, dataset:{}, children:[],
  classList:{add:noop,remove:noop,contains:()=>false,toggle:noop},
  addEventListener:noop, appendChild:noop, querySelector:()=>null, querySelectorAll:()=>[],
  getContext:()=>null, get innerHTML(){return "";}, set innerHTML(v){}, set textContent(v){}, get textContent(){return "";} };
  return e; }
const sb = { Math, console, Date:{now:()=>0}, performance:{now:()=>0},
  document:{getElementById:()=>el(), createElement:()=>el(), querySelector:()=>null, querySelectorAll:()=>[]},
  requestAnimationFrame:noop, cancelAnimationFrame:noop, localStorage:{getItem:()=>null,setItem:noop},
  window:null };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(js.replace("})();","window.__t={TUNING,DEFAULT_TUNING,buildUnits,makeUnit,TYPES};})();"), sb, {filename:"g.js"});
const T = sb.window.__t;

let fails = 0;
function check(name, cond, info){ if(cond) console.log("  ok  : "+name); else { fails++; console.log("  FAIL: "+name+(info!==undefined?"  ("+info+")":"")); } }

console.log("=== dev test-panel live tuning ===");

// buildUnits reads range/speed/cooldown from TUNING.perType
{
  const mk = (type) => T.buildUnits({ squad:[{type, hp:20, atk:8, tier:"common"}] })[0];
  const before = mk("Archer");
  T.TUNING.perType.Archer.range = 999;
  T.TUNING.perType.Archer.speed = 7;
  const after = mk("Archer");
  check("range change flows into buildUnits", after.range === 999, `${before.range} -> ${after.range}`);
  check("speed change flows into buildUnits", after.speed === 7, `${before.speed} -> ${after.speed}`);
  // restore
  Object.assign(T.TUNING.perType.Archer, T.DEFAULT_TUNING.perType.Archer);
  check("restore brings range back", mk("Archer").range === T.DEFAULT_TUNING.perType.Archer.range);
}

// makeUnit HP/ATK honour the edited roll range (force a tight band to assert)
{
  T.TUNING.perType.Mage.hpLo = 500; T.TUNING.perType.Mage.hpHi = 500;
  T.TUNING.perType.Mage.atkLo = 3; T.TUNING.perType.Mage.atkHi = 3;
  let sawMage = 0, hpOk = true, atkOk = true;
  for (let i=0;i<400 && sawMage<8;i++){
    const u = T.makeUnit();
    if (u.type !== "Mage") continue;
    sawMage++;
    // common tier = x1; elite/legendary multiply, so check against the base for common only
    if (u.tier === "common") { if (u.hp !== 500) hpOk=false; if (u.atk !== 3) atkOk=false; }
  }
  check("makeUnit HP honours edited roll range (common Mage = 500)", hpOk, "saw "+sawMage+" mages");
  check("makeUnit ATK honours edited roll range (common Mage = 3)", atkOk);
  Object.assign(T.TUNING.perType.Mage, T.DEFAULT_TUNING.perType.Mage);
}

// global knobs are live-readable objects (panel writes here)
{
  check("global.startGold exists & numeric", typeof T.TUNING.global.startGold === "number");
  check("global has the 5 knobs", ["startGold","deployEvery","speedPxps","fightCap","chaos"].every(k => k in T.TUNING.global));
}

console.log("\n=== RESULT ===");
if (fails === 0) { console.log("ALL TUNING CHECKS PASSED"); process.exit(0); }
else { console.log(`${fails} TUNING CHECK(S) FAILED`); process.exit(1); }

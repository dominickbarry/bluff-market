// Tests the persistent stats module: streak increments on wins and resets on a
// loss, bestStreak/bestPlace track correctly, and load/save round-trips through
// a stubbed localStorage. Exercises the real functions via a probe.

const fs=require("fs"),vm=require("vm"),path=require("path");
let js=fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
js=js.slice(0,js.lastIndexOf("})();"))+"window.__s={recordResult,statsLine,loadStats,get stats(){return stats;},set stats(v){stats=v;}};"+js.slice(js.lastIndexOf("})();"));

// stubbed localStorage so we test real persistence, not the blocked fallback
const store={};
const localStorage={ getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
function fakeEl(){return{_h:"",value:"",dataset:{},style:{},classList:{add(){},remove(){},contains(){return false}},addEventListener(){},appendChild(){},querySelectorAll(){return[]},set innerHTML(v){this._h=v},get innerHTML(){return this._h},set textContent(v){this._h=v},get textContent(){return this._h}};}
const sb={document:{getElementById:fakeEl,createElement:fakeEl},Math,console,localStorage};
sb.window=sb; vm.createContext(sb); vm.runInContext(js,sb,{filename:"g"});
const S=sb.window.__s;

let fails=0; const check=(n,c,d)=>{ if(!c){fails++;console.log("  FAIL:",n,d!==undefined?"— "+d:"");} else console.log("  ok  :",n); };

// reset to a known clean slate
S.stats = { games:0, wins:0, firsts:0, bestPlace:4, streak:0, bestStreak:0 };

console.log("=== stats module ===");
// win, win, lose, win  -> streak ends at 1, bestStreak 2, wins 3, games 4
S.recordResult(1,4);
check("after 1 win: streak 1", S.stats.streak===1, S.stats.streak);
S.recordResult(1,4);
check("after 2 wins: streak 2, bestStreak 2", S.stats.streak===2 && S.stats.bestStreak===2);
S.recordResult(3,4);
check("a loss resets streak to 0", S.stats.streak===0);
// bestPlace is the BEST (lowest) finish ever; two prior 1st places already set it
// to 1, so a 3rd-place finish must NOT worsen it.
check("loss does not worsen bestPlace (stays 1)", S.stats.bestPlace===1, S.stats.bestPlace);
const f=S.recordResult(1,4);
check("win after loss: streak 1 again", S.stats.streak===1);
check("bestStreak stays 2", S.stats.bestStreak===2);
check("totals: 3 wins / 4 games", S.stats.wins===3 && S.stats.games===4, JSON.stringify(S.stats));

// bestPlace tracks improvement from a worse start: fresh slate, finish 3rd then 2nd
S.stats = { games:0, wins:0, firsts:0, bestPlace:4, streak:0, bestStreak:0 };
S.recordResult(3,4); check("bestPlace 3 after first (3rd)", S.stats.bestPlace===3, S.stats.bestPlace);
const imp = S.recordResult(2,4); check("bestPlace improves to 2", S.stats.bestPlace===2 && imp.newBestPlace, S.stats.bestPlace);
S.recordResult(4,4); check("4th does not worsen bestPlace (stays 2)", S.stats.bestPlace===2, S.stats.bestPlace);

// persistence round-trip: recordResult saves each time, so loadStats sees the
// latest totals (3 games here: 3rd, 2nd, 4th).
const reloaded = S.loadStats();
check("loadStats round-trips saved data", reloaded.games===3 && reloaded.bestPlace===2, JSON.stringify(reloaded));

// statsLine renders games played + a win rate
const line = S.statsLine();
check("statsLine shows games + rate", /3 played/.test(line) && /%/.test(line), line);

// a long streak sets a new bestStreak
S.stats = { games:0, wins:0, firsts:0, bestPlace:4, streak:0, bestStreak:0 };
for (let i=0;i<5;i++) S.recordResult(1,4);
check("5 straight wins -> bestStreak 5", S.stats.bestStreak===5, S.stats.bestStreak);

console.log("\n=== RESULT ===");
console.log(fails===0?"ALL STATS CHECKS PASSED":fails+" FAILED");
process.exit(fails===0?0:1);

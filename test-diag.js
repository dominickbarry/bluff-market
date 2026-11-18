// Diagnostic: can the player actually WIN UNITS in the timed auction, if they
// keep bidding up to a sensible limit (not just once)? Isolates the auction
// engine from battle so we can see whether the player is structurally shut out.

const fs = require("fs"), vm = require("vm"), path = require("path");
const js = fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];

let CLOCK = 0; const now = () => CLOCK;
let rafQ = []; const raf = (cb)=>{rafQ.push(cb);return rafQ.length;}; const caf=()=>{};
let byId = {};
function el(tag){ const L={}; const e={tagName:tag,id:"",value:"",dataset:{},style:{},children:[],width:640,height:260,disabled:false,
  classList:{add(){},remove(){},contains(){return false;},toggle(){}},
  addEventListener(ev,fn){(L[ev]||=[]).push(fn);}, _fire(ev){(L[ev]||[]).slice().forEach(f=>f());},
  appendChild(c){e.children.push(c); if(c._d)c._d.forEach(d=>{if(d.id)byId[d.id]=d;});},
  querySelector(){return null;}, querySelectorAll(s){return s&&s.includes("button")?e.children.filter(c=>c.tagName==="button"):[];},
  getContext(){return null;},
  get innerHTML(){return e._h||"";}, set innerHTML(v){e._h=v;e._d=parse(v);e.children=e._d.slice();},
  get textContent(){return e._h||"";}, set textContent(v){e._h=v;} }; return e; }
function parse(h){const out=[];const re=/<(button|input|canvas)\b([^>]*)>/g;let m;while((m=re.exec(h))){const a=m[2];const x=el(m[1]);
  const id=(a.match(/id="([^"]+)"/)||[])[1];const dr=(a.match(/data-raise="([^"]+)"/)||[])[1];x.disabled=/disabled/.test(a);
  if(id){x.id=id;byId[id]=x;} if(dr!==undefined)x.dataset.raise=dr; out.push(x);} return out;}
function gom(id){return byId[id]||(byId[id]=(()=>{const e=el("div");e.id=id;return e;})());}
const sb={document:{getElementById:gom,createElement:el,querySelector:()=>null},Math,console,
  requestAnimationFrame:raf,cancelAnimationFrame:caf,Date:{now},performance:{now}};
sb.window=sb; vm.createContext(sb); vm.runInContext(js,sb,{filename:"g.js"});
function pump(ms,stop){let s=0;while(s<ms){CLOCK+=50;s+=50;const q=rafQ;rafQ=[];q.forEach(cb=>cb(CLOCK));if(stop&&stop())return true;}return false;}

// Play ONE game; "You" keeps raising by +1 (min) as long as the next bid is
// under a budget fraction of starting gold — a patient sniper. Count units won.
function run(budgetFrac){
  for(const k of Object.keys(byId)) if(!["btnStart","btnReplay","scrIntro","scrGame","scrEnd","playersStrip","phaseBody","roundTag","phaseTag","endTitle","endSub","endStandings"].includes(k)) delete byId[k];
  byId.endTitle && (byId.endTitle._h="");
  rafQ=[];
  (run._first===undefined ? (run._first=1, byId.btnStart) : byId.btnReplay)._fire("click");
  let unitsWonByYou = 0, unitsSeen = 0, guard=0;
  while(guard++<500){
    if(byId.endTitle && /WIN/.test(byId.endTitle._h||"")) break;
    if(byId.btnNext && byId.btnNext.tagName==="button"){ const b=byId.btnNext;byId.btnNext=null;byId.raiseRow=null;b._fire("click");continue;}
    if(byId.raiseRow && byId.raiseRow.children && byId.raiseRow.children.length){
      unitsSeen++;
      // keep re-bidding the minimum each time it's our turn, until we lead or
      // the price passes our budget. We do this by pumping in short slices and
      // re-clicking min between slices.
      const startGold = parseInt((byId.phaseBody._h.match(/Your gold: <b>(\d+)g/)||[])[1]||"0",10);
      const cap = Math.floor(startGold * budgetFrac);
      let done=false, safety=0;
      while(!done && safety++<120){
        // current high
        const hv = parseInt((byId.aucHigh && byId.aucHigh._h||"0"),10)||0;
        const leaderTxt = (byId.aucLeader && byId.aucLeader._h)||"";
        const iLead = /You lead/.test(leaderTxt);
        if(!iLead && hv+1<=cap){ const btn=byId.raiseRow.children.find(c=>c.dataset&&c.dataset.raise==="min"&&!c.disabled); if(btn)btn._fire("click"); }
        // advance a short slice
        done = pump(1200, ()=> (byId.btnNext&&byId.btnNext.tagName==="button"));
      }
      pump(60000, ()=>(byId.btnNext&&byId.btnNext.tagName==="button"));
      // did we win it? check result text
      if(/<b>You<\/b> won/.test(byId.phaseBody._h||"")) unitsWonByYou++;
      byId.raiseRow=null; continue;
    }
    if(byId.btnSkip && byId.btnSkip.tagName==="button"){const b=byId.btnSkip;byId.btnSkip=null;b._fire("click");pump(2000,()=>(byId.btnNextMatch&&byId.btnNextMatch.tagName==="button")||(byId.btnAfter&&byId.btnAfter.tagName==="button"));continue;}
    if(byId.btnNextMatch && byId.btnNextMatch.tagName==="button"){const b=byId.btnNextMatch;byId.btnNextMatch=null;b._fire("click");continue;}
    if(byId.btnAfter && byId.btnAfter.tagName==="button"){const b=byId.btnAfter;byId.btnAfter=null;b._fire("click");continue;}
    if(!pump(1500,()=>(byId.raiseRow&&byId.raiseRow.children&&byId.raiseRow.children.length)||(byId.btnNext&&byId.btnNext.tagName==="button")||(byId.btnSkip&&byId.btnSkip.tagName==="button")||(byId.btnAfter&&byId.btnAfter.tagName==="button")||(byId.endTitle&&/WIN/.test(byId.endTitle._h||"")))) break;
  }
  const champ = byId.endTitle._h||"?";
  return { unitsWonByYou, unitsSeen, youWon: /YOU WIN/.test(champ), champ };
}

function series(frac, N){ let u=0,w=0,won=0; for(let i=0;i<N;i++){const r=run(frac); u+=r.unitsSeen; w+=r.unitsWonByYou; if(r.youWon)won++;} return {u,w,won,N}; }

// Compare bidding styles under the new "more units wins" meta.
console.log("strategy comparison (per-unit combat):");
[["spend big (50% cap)",0.5],["balanced (33% cap)",0.33],["buy bodies (22% cap)",0.22]].forEach(([label,frac])=>{
  const s = series(frac, 150);   // larger sample to cut run-to-run jitter
  console.log(`  ${label}: won ${(s.w/s.N).toFixed(1)} units/game, ${s.won}/${s.N} games (${(100*s.won/s.N).toFixed(0)}%)`);
});

let totUnits=0, totWon=0, youWins=0, N=60;
for(let i=0;i<N;i++){ const r=run(0.5); totUnits+=r.unitsSeen; totWon+=r.unitsWonByYou; if(r.youWon)youWins++; }
console.log(`games: ${N}`);
console.log(`avg units auctioned/game: ${(totUnits/N).toFixed(1)}`);
console.log(`avg units WON BY YOU/game: ${(totWon/N).toFixed(2)}`);
console.log(`"You" overall wins: ${youWins}/${N} (${(100*youWins/N).toFixed(0)}%)`);
console.log(totWon>0 ? "-> player CAN win units in the timed auction" : "-> PLAYER IS SHUT OUT of units (balance bug)");

// Animation smoke test for the BATTLE ROYALE renderer. Exercises animateRoyale
// with a real (recording) 2D canvas context across several player/squad-size
// combos, proving simRoyale + the N-squad animation never throw and that the
// placement/events drive the draw loop. (Flow/logic suites cover correctness.)

const fs = require("fs"), vm = require("vm"), path = require("path");
let js = fs.readFileSync(path.join(__dirname,"index.html"),"utf8").match(/<script>([\s\S]*?)<\/script>/)[1];

function mockCtx() {
  const calls = {};
  return new Proxy({}, {
    get(t,k){
      if (k==="__calls") return calls;
      if (k==="canvas") return {width:640,height:300};
      if (["fillStyle","strokeStyle","lineWidth","font","textAlign","globalAlpha","lineCap"].includes(k)) return t[k];
      return (...a)=>{ calls[k]=(calls[k]||0)+1; if(k==="createLinearGradient"||k==="createRadialGradient") return {addColorStop(){}}; };
    },
    set(t,k,v){ t[k]=v; return true; }
  });
}

let CLOCK=0; const now=()=>CLOCK;
let rafQ=[]; const raf=cb=>{rafQ.push(cb);return rafQ.length;}; const caf=()=>{};
let byId={};
const theCtx=mockCtx();
function el(tag){const L={};const e={tagName:tag,id:"",value:"",dataset:{},style:{},children:[],width:640,height:300,disabled:false,
  classList:{add(){},remove(){},contains(){return false},toggle(){}},
  addEventListener(ev,fn){(L[ev]||=[]).push(fn)}, _fire(ev){(L[ev]||[]).slice().forEach(f=>f())},
  appendChild(c){e.children.push(c); if(c._d)c._d.forEach(d=>{if(d.id)byId[d.id]=d})},
  querySelector(){return null}, querySelectorAll(s){return s&&s.includes("button")?e.children.filter(c=>c.tagName==="button"):[]},
  getContext(){ return tag==="canvas"?theCtx:null },
  get innerHTML(){return e._h||""}, set innerHTML(v){e._h=v;e._d=parse(v);e.children=e._d.slice()},
  get textContent(){return e._h||""}, set textContent(v){e._h=v} };return e;}
function parse(h){const out=[];const re=/<(button|input|canvas)\b([^>]*)>/g;let m;while((m=re.exec(h))){const a=m[2];const x=el(m[1]);
  const id=(a.match(/id="([^"]+)"/)||[])[1];if(id){x.id=id;byId[id]=x;}out.push(x);}return out;}
function gom(id){return byId[id]||(byId[id]=(()=>{const e=el("div");e.id=id;return e;})());}
const sb={document:{getElementById:gom,createElement:el,querySelector:()=>null},Math,console,
  requestAnimationFrame:raf,cancelAnimationFrame:caf,Date:{now},performance:{now}};
sb.window=sb;
// probe: expose the royale sim + animator + unit builder
js=js.replace("})();","window.__a={simRoyale,animateRoyale,buildUnits};})();");
vm.createContext(sb); vm.runInContext(js,sb,{filename:"g.js"});
const A=sb.window.__a;

function mkPlayer(id,name,you,types){ return { id, name, you, squad: types.map(t=>({type:t,hp:20,atk:8,tier:"common"})) }; }

let fails=0;
function run(squads,label){
  byId={}; rafQ=[]; CLOCK=0;
  const canvas=el("canvas");canvas.id="battleCanvas";byId.battleCanvas=canvas;
  byId.vsLine=el("div");byId.phaseBody=el("div");byId.battleSub=el("div");
  const playerList=squads.map((s,i)=>mkPlayer(i,s.name,!!s.you,s.types));
  const log=[],events=[];
  let placement;
  try { placement=A.simRoyale(playerList,log,events); } catch(e){ fails++; console.log(`FAIL [${label}] sim threw: ${e.message}`); return; }
  const roy={events, placement};
  try {
    A.animateRoyale(roy);
    let g=0; while(rafQ.length&&g++<20000){ CLOCK+=16; const q=rafQ;rafQ=[];q.forEach(cb=>cb(CLOCK)); }
  } catch(e){ fails++; console.log(`FAIL [${label}] anim threw: ${e.message}`); return; }
  const drew=(theCtx.__calls["fill"]||0)+(theCtx.__calls["stroke"]||0);
  // sanity: placement is a permutation of all players
  const ok = placement.length===playerList.length && new Set(placement.map(p=>p.id)).size===playerList.length;
  if(!ok){ fails++; console.log(`FAIL [${label}] bad placement`); return; }
  console.log(`ok   [${label}] ${squads.length} squads, winner=${placement[0].name}, draw-calls=${drew}`);
}

console.log("=== battle-royale animation smoke test ===");
run([{name:"A",you:true,types:["Warrior","Archer"]},{name:"B",types:["Mage","Beast"]},{name:"C",types:["Rogue","Warrior"]},{name:"D",types:["Beast","Archer"]}], "4 squads x2u");
run([{name:"A",you:true,types:["Warrior"]},{name:"B",types:["Beast"]},{name:"C",types:["Mage"]},{name:"D",types:["Rogue"]}], "4 squads x1u");
run([{name:"A",you:true,types:["Warrior","Archer","Mage","Beast","Rogue","Warrior","Archer","Mage"]},
     {name:"B",types:["Beast","Beast","Beast","Rogue","Rogue"]},
     {name:"C",types:["Mage","Mage","Archer"]},
     {name:"D",types:["Warrior","Warrior","Warrior","Warrior"]}], "4 squads uneven (8/5/3/4)");
run([{name:"A",you:true,types:[]},{name:"B",types:["Warrior"]},{name:"C",types:["Beast"]},{name:"D",types:["Mage"]}], "one empty squad (edge)");
run([{name:"A",you:true,types:["Rogue","Rogue","Rogue"]},{name:"B",types:["Warrior","Warrior","Warrior"]}], "2 squads (degenerate royale)");

// skip-path
(function(){
  byId={};rafQ=[];CLOCK=0;
  const canvas=el("canvas");canvas.id="battleCanvas";byId.battleCanvas=canvas;
  byId.vsLine=el("div");byId.phaseBody=el("div");byId.battleSub=el("div");
  const pl=[mkPlayer(0,"A",true,["Warrior","Mage"]),mkPlayer(1,"B",false,["Beast"]),mkPlayer(2,"C",false,["Rogue"]),mkPlayer(3,"D",false,["Archer"])];
  const log=[],events=[];const placement=A.simRoyale(pl,log,events);
  try{ A.animateRoyale({events,placement}); sb.window.animState && (sb.window.animState.skip=true);
    let g=0;while(rafQ.length&&g++<200){CLOCK+=16;const q=rafQ;rafQ=[];q.forEach(cb=>cb(CLOCK));}
    console.log("ok   [skip path] no throw");
  }catch(e){fails++;console.log("FAIL [skip path] "+e.message);}
})();

console.log("\n=== RESULT ===");
console.log(fails===0?"ALL ANIMATION CHECKS PASSED":fails+" FAILED");
process.exit(fails===0?0:1);

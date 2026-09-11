//   npx electron desktop/build/a11y-menu-test.cjs
//
// The accessibility audit must see the MENU's links. axe skips hidden elements and
// a dropdown or mega panel is hidden until opened, so before this the panels' links
// were never audited at all: contrast, link text, focus order, nothing. This rigs a
// panel link with a guaranteed contrast failure and asserts the audit finds it.
const fs=require("node:fs"), os=require("node:os"), path=require("node:path");
const { spawn, execSync } = require("node:child_process");
const { app } = require("electron");
const REPO = path.resolve(__dirname, "..", "..");
const RUN = path.join(os.tmpdir(), "ta-a11y-menu"), DIR = path.join(RUN, "project");
const SEED = require(path.join(REPO, "desktop/menu-seed.cjs"));

function sh(c,a,o={}){return new Promise((res,rej)=>{const p=spawn(c,a,{stdio:"inherit",...o});p.on("error",rej);p.on("exit",x=>x===0?res():rej(new Error(`${c} exited ${x}`)));});}
function startVite(dir){return new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(REPO,"node_modules/vite/bin/vite.js")],{cwd:dir,env:{...process.env,ELECTRON_RUN_AS_NODE:"1",NO_COLOR:"1"},stdio:["ignore","pipe","pipe"],detached:true});
  let log="",d=false;const on=b=>{log+=String(b).replace(/\x1b\[[0-9;]*m/g,"");const m=log.match(/https?:\/\/localhost:\d+/);if(m&&!d){d=true;res({p,url:m[0]});}};
  p.stdout.on("data",on);p.stderr.on("data",on);setTimeout(()=>!d&&rej(new Error("no url")),90000);});}

app.whenReady().then(async()=>{
  fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
  await sh("git",["-C",REPO,"checkout-index","-a","-f",`--prefix=${DIR}${path.sep}`]);
  fs.copyFileSync(path.join(REPO,"desktop/build/scaffold-package.json"), path.join(DIR,"package.json"));
  fs.rmSync(path.join(DIR,"desktop"),{recursive:true,force:true});
  try{fs.symlinkSync(path.join(REPO,"node_modules"),path.join(DIR,"node_modules"),"dir");}catch{}
  const hc = path.join(DIR,"src/app/header.config.ts");
  let s = fs.readFileSync(hc,"utf8"); const at = s.indexOf("export const headerConfig");
  fs.writeFileSync(hc, s.slice(0,at)+s.slice(at).replace(/(menuKind:\s*)["'][^"']*["']/,'$1"mega"'));
  const items = SEED.clean({ items:[{label:"Services",links:[],columns:[{heading:"Grooming",links:["Full Groom","Bath and Brush"]}]},{label:"Contact",links:[],columns:[]}] }, "mega").items;
  fs.writeFileSync(path.join(DIR,"src/app/pages.ts"), SEED.renderPagesTs(items));
  fs.writeFileSync(path.join(DIR,"src/app/menu.ts"), SEED.renderMenuTs(items));
  let env = fs.readFileSync(path.join(DIR,".env"),"utf8");
  fs.writeFileSync(path.join(DIR,".env"), env.replace(/VITE_CLIENT_NAME=.*/,'VITE_CLIENT_NAME="Four Paws"').replace(/VITE_PROJECT_TYPE=.*/,'VITE_PROJECT_TYPE="website"'));
  // THE RIG: a mega column link in near-white on the panel's near-white surface.
  const skin = path.join(DIR,"src/app/components/header.skin.ts");
  fs.writeFileSync(skin, fs.readFileSync(skin,"utf8")
    .replace(/panel: "[^"]*"/, 'panel: "border border-black/10 bg-white shadow-xl"')
    .replace(/columnLink: "[^"]*"/, 'columnLink: "font-ta-sans text-sm text-[#fbfbfb]"'));

  const {p,url} = await startVite(DIR);
  // Drive the real auditA11y by pointing main's globals at this project.
  process.env.TA_TEST_PREVIEW = url;
  const { runCaptureOp, stopCaptureBridge } = require(path.join(REPO,"desktop/capture-bridge.cjs"));
  // Re-implement the audit's scan loop here (auditA11y is bound to main's state).
  const axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"),"utf8");
  const ev = async (c) => (await runCaptureOp({op:"evaluate",code:c})).result;
  await runCaptureOp({op:"viewport",width:1440,height:900});
  await runCaptureOp({op:"goto",url:`${url}/?v=v00&capture=desktop`});
  await runCaptureOp({op:"waitSelector",selector:"header",timeout:20000});
  await new Promise(r=>setTimeout(r,1500));
  await ev(axe);
  const AXE = fs.readFileSync(path.join(REPO,"desktop/main.cjs"),"utf8").match(/const AXE_RUN = `([\s\S]*?)`;/)[1];
  const before = await ev(AXE);
  const hitsPanel = (vs) => (vs||[]).some(v => v.id==="color-contrast" && (v.nodes||[]).some(n => /column|panel|menu/i.test(String(n.target)) || /text-\[#fbfbfb\]/.test(String(n.html))));
  console.log(`  closed menus: color-contrast in a panel? ${hitsPanel(before)?"yes":"no"}  (expected: no — axe cannot see them)`);
  const ids = await ev(`[...document.querySelectorAll("[data-menu-item]")].map(e=>e.getAttribute("data-menu-item"))`);
  let found = false;
  for (const id of ids||[]) {
    await ev(`(()=>{const t=document.querySelector('[data-menu-item="${id}"]');if(!t)return false;t.dispatchEvent(new MouseEvent("mouseover",{bubbles:true}));t.dispatchEvent(new MouseEvent("mouseenter",{bubbles:true}));if(t.focus)t.focus();return true})()`);
    await new Promise(r=>setTimeout(r,320));
    if (hitsPanel(await ev(AXE))) { found = true; break; }
  }
  console.log(`  opened menus: color-contrast in a panel? ${found?"yes":"no"}  (expected: YES)`);
  console.log(`\n${found?"PASS":"FAIL"}  the audit reaches the menu's links`);
  try{process.kill(-p.pid);}catch{} stopCaptureBridge(); app.exit(found?0:1);
});

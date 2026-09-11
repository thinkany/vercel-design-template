//   npx electron desktop/build/keyboard-menu-test.cjs
//
// WCAG 2.1.1 / 2.1.2 for the configured header: a menu's links must be reachable and
// escapable WITHOUT a mouse. A panel that opens on hover is never open for a keyboard
// user, so Tab alone can't reach its links: ArrowDown opens and enters, Escape closes
// and returns focus to the trigger. Real key events through the input system, not
// scripted focus calls, so this exercises what a person's keyboard does.
const fs=require("node:fs"), os=require("node:os"), path=require("node:path");
const { spawn } = require("node:child_process");
const { app, BrowserWindow } = require("electron");
const REPO = path.resolve(__dirname, "..", "..");
const RUN = path.join(os.tmpdir(), "ta-kbd"), DIR = path.join(RUN, "project");
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
  fs.writeFileSync(path.join(DIR,".env"), fs.readFileSync(path.join(DIR,".env"),"utf8")
    .replace(/VITE_CLIENT_NAME=.*/,'VITE_CLIENT_NAME="Four Paws"').replace(/VITE_PROJECT_TYPE=.*/,'VITE_PROJECT_TYPE="website"'));

  const {p,url} = await startVite(DIR);
  // A real window, so sendInputEvent drives the actual input pipeline.
  const win = new BrowserWindow({ show:false, width:1440, height:900, webPreferences:{ backgroundThrottling:false } });
  const wc = win.webContents;
  await wc.loadURL(`${url}/?v=v00&capture=desktop`);
  await new Promise(r=>setTimeout(r,2500));
  const ev = (c) => wc.executeJavaScript(c, true);
  const key = async (keyCode) => { wc.sendInputEvent({ type:"keyDown", keyCode }); wc.sendInputEvent({ type:"keyUp", keyCode }); await new Promise(r=>setTimeout(r,320)); };

  let fails = 0;
  const check = (label, got, want) => { const ok = got===want; if(!ok) fails++; console.log(`  ${ok?"ok  ":"FAIL"} ${label} (${got})`); };

  // Focus the first menu trigger the way Tab would land on it.
  await ev(`document.querySelector("[data-menu-item]").focus()`);
  await new Promise(r=>setTimeout(r,200));
  check("trigger is focused", await ev(`document.activeElement?.getAttribute("data-menu-item")`), "services");
  check("panel starts closed (hidden from AT)", await ev(`!!document.getElementById("menu-panel-services")?.hidden`), true);
  check("trigger says collapsed", await ev(`document.querySelector('[data-menu-item="services"]').getAttribute("aria-expanded")`), "false");
  check("trigger names its panel", await ev(`document.querySelector('[data-menu-item="services"]').getAttribute("aria-controls")`), "menu-panel-services");

  await key("Down");
  check("ArrowDown opens the panel", await ev(`!document.getElementById("menu-panel-services").hidden`), true);
  check("…and moves focus INTO it", await ev(`!!document.getElementById("menu-panel-services").contains(document.activeElement)`), true);
  check("trigger now says expanded", await ev(`document.querySelector('[data-menu-item="services"]').getAttribute("aria-expanded")`), "true");

  await key("Escape");
  check("Escape closes it", await ev(`!!document.getElementById("menu-panel-services").hidden`), true);
  check("…and focus returns to the trigger", await ev(`document.activeElement?.getAttribute("data-menu-item")`), "services");

  console.log(`\n${fails?"FAIL":"PASS"}  the menu is reachable by keyboard`);
  win.destroy(); try{process.kill(-p.pid);}catch{} app.exit(fails?1:0);
});

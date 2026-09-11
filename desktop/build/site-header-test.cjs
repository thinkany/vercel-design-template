//   npx electron desktop/build/site-header-test.cjs
//
// P3: the SITE's header is the DESIGN's header. Builds a scaffold, pins a design,
// writes a mega-menu nav into content/site.json, starts the Astro dev server and
// runs the SAME menu check against it. The point of the phase is that promote no
// longer re-authors the header, so this must pass with no model turn anywhere.
const fs=require("node:fs"), os=require("node:os"), path=require("node:path");
const { spawn, execSync } = require("node:child_process");
const { app } = require("electron");
const REPO = path.resolve(__dirname, "..", "..");
const RUN = path.join(os.tmpdir(), "ta-site-header"), DIR = path.join(RUN, "project");

function sh(c,a,o={}){return new Promise((res,rej)=>{const p=spawn(c,a,{stdio:"inherit",...o});p.on("error",rej);p.on("exit",x=>x===0?res():rej(new Error(`${c} exited ${x}`)));});}
function startAstro(dir){return new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(REPO,"node_modules/astro/astro.js"),"dev","--root","site"],{cwd:dir,env:{...process.env,ELECTRON_RUN_AS_NODE:"1",FORCE_COLOR:"0",NO_COLOR:"1"},stdio:["ignore","pipe","pipe"],detached:true});
  let log="",done=false;const on=b=>{log+=String(b).replace(/\x1b\[[0-9;]*m/g,"");const m=log.match(/https?:\/\/localhost:\d+/);if(m&&!done){done=true;res({p,url:m[0],log:()=>log});}};
  p.stdout.on("data",on);p.stderr.on("data",on);setTimeout(()=>!done&&rej(new Error("astro never reported a URL:\n"+log.slice(0,2000))),120000);});}

const NAV = [
  { label:"Home", href:"/" },
  { label:"Services", href:"/services", links:[], columns:[
    { heading:"Grooming", links:[{label:"Full Groom",href:"/services#full"},{label:"Bath and Brush",href:"/services#bath"},{label:"Nail Trim",href:"/services#nails"}] },
    { heading:"Special", links:[{label:"Puppy First Visit",href:"/services#puppy"},{label:"Senior Pet Care",href:"/services#senior"}] },
    { feature:{ title:"Mobile Grooming", text:"Professional grooming comes to your driveway.", link:{label:"Book a visit",href:"/contact"} }, links:[] },
  ] },
  { label:"Shop", href:"/shop", links:[{label:"Coats",href:"/shop#coats"},{label:"Collars",href:"/shop#collars"}], columns:[] },
  { label:"Gallery", href:"/gallery", links:[], columns:[] },
  { label:"Contact", href:"/contact", links:[], columns:[] },
];

app.whenReady().then(async()=>{
  const { runMenuCheck, summarize } = require(path.join(REPO,"desktop/menu-check.cjs"));
  const { runCaptureOp, stopCaptureBridge } = require(path.join(REPO,"desktop/capture-bridge.cjs"));
  fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
  await sh("git",["-C",REPO,"checkout-index","-a","-f",`--prefix=${DIR}${path.sep}`]);
  fs.copyFileSync(path.join(REPO,"desktop/build/scaffold-package.json"), path.join(DIR,"package.json"));
  fs.rmSync(path.join(DIR,"desktop"),{recursive:true,force:true});
  try{fs.symlinkSync(path.join(REPO,"node_modules"),path.join(DIR,"node_modules"),"dir");}catch{}

  // A design with a mega header, promoted (pinned) and given a mega nav.
  const hc = path.join(DIR,"src/app/header.config.ts");
  let s = fs.readFileSync(hc,"utf8"); const at = s.indexOf("export const headerConfig");
  fs.writeFileSync(hc, s.slice(0,at)+s.slice(at).replace(/(placement:\s*)["'][^"']*["']/,'$1"center-split"').replace(/(menuKind:\s*)["'][^"']*["']/,'$1"mega"'));
  fs.writeFileSync(path.join(RUN,"palette.json"), JSON.stringify({roles:{primary:{value:"#2AA4A8",text:"#ffffff"},ink:{value:"#101418"},surface:{value:"#E9EDF0"},body:{value:"#46525C"},muted:{value:"#7C8A94"}}}));
  execSync(`node scripts/apply-brand.mjs --variation v01 --palette "${path.join(RUN,"palette.json")}" --client "Four Paws"`, { cwd: DIR, stdio: "pipe" });
  // A distinctive skin, to prove the SITE picks up the DESIGN's look.
  // A COHERENT dark skin: a design that darkens the bar restyles the type with it.
  // (Changing only the bar leaves text-ta-ink on bg-ta-ink, which is invisible; the
  // check now catches that, so writing it here would fail for the wrong reason.)
  const skin = path.join(DIR,"src/variations/v01/components/header.skin.ts");
  fs.writeFileSync(skin, fs.readFileSync(skin,"utf8")
    .replace(/bar: "[^"]*"/, 'bar: "border-b-2 border-ta-primary bg-ta-ink"')
    .replace(/wordmark: "[^"]*"/, 'wordmark: "font-ta-display text-lg leading-none text-ta-surface"')
    .replace(/link: "[^"]*"/, 'link: "font-ta-sans text-xs font-medium uppercase tracking-[0.1em] text-ta-surface/80 transition-colors hover:text-ta-surface"'));
  // A branded project: the wordmark falls back to VITE_CLIENT_NAME, and an unbranded
  // one leaves a hole in the centre of a split header that no geometric rule catches.
  let env = fs.readFileSync(path.join(DIR,".env"),"utf8");
  fs.writeFileSync(path.join(DIR,".env"), env.replace(/VITE_CLIENT_NAME=.*/,'VITE_CLIENT_NAME="Four Paws"'));
  const site = JSON.parse(fs.readFileSync(path.join(DIR,"content/site.json"),"utf8"));
  site.design = "v01"; site.nav = NAV;
  fs.writeFileSync(path.join(DIR,"content/site.json"), JSON.stringify(site,null,2));

  const {p,url,log} = await startAstro(DIR);
  console.log(`site at ${url}`);
  const r = await runMenuCheck({ projectDir: DIR, previewUrl: url, variationId: "v01", captureOp: runCaptureOp, headerMode: "configured", widths: ["desktop","mobile"], site: true });
  console.log(`\n${r.ok?"PASS":"FAIL"}  site header  ${r.error||summarize(r)}`);
  for (const f of r.findings||[]) console.log(`      ${f.rule}/${f.width}${f.item?` (${f.item})`:""}: expected ${f.expected}; got ${f.actual}`);
  // A look at it, mega open.
  await runCaptureOp({op:"viewport",width:1440,height:900});
  await runCaptureOp({op:"goto",url});
  await runCaptureOp({op:"waitSelector",selector:"header",timeout:20000});
  await new Promise(x=>setTimeout(x,2500));
  await runCaptureOp({op:"evaluate",code:`(()=>{const t=document.querySelector('[data-menu-item="services"]');if(!t)return false;t.dispatchEvent(new MouseEvent("mouseenter",{bubbles:true}));return true;})()`});
  await new Promise(x=>setTimeout(x,900));
  const shot = await runCaptureOp({op:"screenshot",fullPage:false});
  fs.writeFileSync(path.join(RUN,"site-mega.png"), Buffer.from(shot.dataUrl,"base64"));
  console.log(`shot: ${path.join(RUN,"site-mega.png")}`);
  try{process.kill(-p.pid);}catch{} stopCaptureBridge(); app.exit(r.ok?0:1);
});

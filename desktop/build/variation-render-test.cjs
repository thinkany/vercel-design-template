//   npx electron desktop/build/variation-render-test.cjs
//
// THE REGRESSION THAT BIT IN THE FIRST GUI RUN: a variation created by
// apply-brand.mjs must actually RENDER. It copies components into the variation
// folder, so a relative import there resolves against the wrong directory and the
// build dies with "Failed to resolve import". Scaffold → seed → apply-brand →
// check, exactly as a real Get Designing build does it.
const fs=require("node:fs"), os=require("node:os"), path=require("node:path");
const { spawn, execSync } = require("node:child_process");
const { app } = require("electron");
const REPO = path.resolve(__dirname, "..", "..");
const RUN = path.join(os.tmpdir(), "ta-variation-check"), DIR = path.join(RUN, "project");
const SEED = require(path.join(REPO, "desktop/menu-seed.cjs"));

function sh(c,a,o={}){return new Promise((res,rej)=>{const p=spawn(c,a,{stdio:"inherit",...o});p.on("error",rej);p.on("exit",x=>x===0?res():rej(new Error(`${c} exited ${x}`)));});}
function startVite(dir){return new Promise((res,rej)=>{
  const p=spawn(process.execPath,[path.join(REPO,"node_modules/vite/bin/vite.js")],{cwd:dir,env:{...process.env,ELECTRON_RUN_AS_NODE:"1",FORCE_COLOR:"0",NO_COLOR:"1"},stdio:["ignore","pipe","pipe"],detached:true});
  let log="",done=false;const on=b=>{log+=String(b).replace(/\x1b\[[0-9;]*m/g,"");const m=log.match(/https?:\/\/localhost:\d+/);if(m&&!done){done=true;res({p,url:m[0],log:()=>log});}};
  p.stdout.on("data",on);p.stderr.on("data",on);setTimeout(()=>!done&&rej(new Error("no url")),90000);});}

app.whenReady().then(async()=>{
  const { runMenuCheck, summarize } = require(path.join(REPO,"desktop/menu-check.cjs"));
  const { runCaptureOp, stopCaptureBridge } = require(path.join(REPO,"desktop/capture-bridge.cjs"));
  fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
  await sh("git",["-C",REPO,"checkout-index","-a","-f",`--prefix=${DIR}${path.sep}`]);
  fs.copyFileSync(path.join(REPO,"desktop/build/scaffold-package.json"), path.join(DIR,"package.json"));
  fs.rmSync(path.join(DIR,"desktop"),{recursive:true,force:true});
  try{fs.symlinkSync(path.join(REPO,"node_modules"),path.join(DIR,"node_modules"),"dir");}catch{}

  // 1. seed the header + nav, as the app does at the build handoff
  const hc = path.join(DIR,"src/app/header.config.ts");
  let s = fs.readFileSync(hc,"utf8"); const at = s.indexOf("export const headerConfig");
  fs.writeFileSync(hc, s.slice(0,at)+s.slice(at).replace(/(placement:\s*)["'][^"']*["']/,'$1"center-split"').replace(/(menuKind:\s*)["'][^"']*["']/,'$1"mega"'));
  const items = SEED.clean({ items: [
    { label:"Grooming Services", links:[], columns:[{heading:"Services",links:["Full Groom","Bath & Brush","Nail Trim"]},{heading:"Add-ons",links:["De-shedding","Teeth Cleaning"]}] },
    { label:"Shop", links:[], columns:[{heading:"Apparel",links:["Coats","Sweaters"]},{heading:"Accessories",links:["Collars","Leads"]}] },
    { label:"Visit Us", links:[], columns:[] }, { label:"Contact", links:[], columns:[] },
  ], featured:{label:"Full Groom",blurb:"Wash, cut and style."} }, "mega").items;
  fs.writeFileSync(path.join(DIR,"src/app/pages.ts"), SEED.renderPagesTs(items));
  fs.writeFileSync(path.join(DIR,"src/app/menu.ts"), SEED.renderMenuTs(items));

  // 2. apply-brand creates v01 — THE STEP THAT BROKE
  fs.writeFileSync(path.join(RUN,"palette.json"), JSON.stringify({roles:{primary:{value:"#B8643C",text:"#ffffff"},ink:{value:"#2A211C"},surface:{value:"#FBF6F0"},body:{value:"#5A4A42"},muted:{value:"#8A7A72"}}}));
  execSync(`node scripts/apply-brand.mjs --variation v01 --palette "${path.join(RUN,"palette.json")}" --client "For Paws"`, { cwd: DIR, stdio: "pipe" });

  const copied = fs.readdirSync(path.join(DIR,"src/variations/v01/components"));
  console.log("variation components:", copied.join(", "));
  console.log(`  ${copied.includes("Header.tsx")?"✗ FAIL Header.tsx copied (would count as a custom header)":"✓ no Header.tsx copied"}`);
  console.log(`  ${copied.includes("header.skin.ts")?"✓ header.skin.ts seeded for the designer":"✗ FAIL no skin to edit"}`);
  console.log(`  ${copied.includes("StyleGuide.tsx")?"✗ FAIL admin surfaces dragged in":"✓ no admin surfaces"}`);

  // 3. does it actually RENDER?
  const {p,url,log} = await startVite(DIR);
  const r = await runMenuCheck({ projectDir: DIR, previewUrl: url, variationId: "v01", captureOp: runCaptureOp, headerMode: "configured" });
  const failedToResolve = /Failed to resolve import|Failed to load url/.test(log());
  console.log(`  ${failedToResolve?"✗ FAIL vite import error":"✓ no vite import errors"}`);
  console.log(`\n${r.ok&&!failedToResolve?"PASS":"FAIL"}  variation renders  ${r.error||summarize(r)}`);
  for (const f of r.findings||[]) console.log(`      ${f.rule}/${f.width}: expected ${f.expected}; got ${f.actual}`);
  await runCaptureOp({op:"viewport",width:1440,height:900});
  await runCaptureOp({op:"goto",url:`${url}/?v=v01&capture=desktop&menu=open&item=grooming-services`});
  await runCaptureOp({op:"waitSelector",selector:"header",timeout:15000});
  await new Promise(x=>setTimeout(x,1200));
  const shot = await runCaptureOp({op:"screenshot",fullPage:false});
  fs.writeFileSync(path.join(RUN,"variation-mega.png"), Buffer.from(shot.dataUrl,"base64"));
  console.log(`shot: ${path.join(RUN,"variation-mega.png")}`);
  try{process.kill(-p.pid);}catch{} stopCaptureBridge(); app.exit(r.ok&&!failedToResolve?0:1);
});

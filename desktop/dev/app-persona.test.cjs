// ©2026 thinkany llc. All rights reserved.
// APP PERSONA TEST: `node desktop/dev/app-persona.test.cjs`.
//
// The Get Designing walk-through's first fork is web site or app. An app project speaks
// through its own builder persona (an app creator, twenty-plus years, best practices said
// plainly, approachable), the web site through the designer's. These pins keep the
// persona's substance, and the routing: main tells the agent the project type (from the
// intake's first fork before .env has it, from .env after), the agent picks the persona,
// the Art Director review is untouched by it.
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const D = path.join(__dirname, "..");
const agent = fs.readFileSync(path.join(D, "agent.mjs"), "utf8");
const main = fs.readFileSync(path.join(D, "main.cjs"), "utf8");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// The persona is a concatenation of string literals; read it as the model will, one string.
const block = (name) => { const i = agent.indexOf(`const ${name} =`); assert.ok(i > -1, `${name} not found`); return new Function(agent.slice(i, agent.indexOf('";\n', i) + 3) + `\nreturn ${name};`)(); };
const app = block("APP_PERSONA");
ok(/# Your persona/.test(app), "the App persona takes the builder's seat (same heading as the designer's)");
ok(/more than twenty years of app development and app design/.test(app), "twenty-plus years of app development and app design");
ok(/native and web apps/.test(app) && /from first sketch to the store/.test(app), "a career that spans the craft, not a title");
ok(/best practices of app development and design/.test(app), "its voice is rooted in the best practices");
for (const practice of ["one obvious next action per screen", "platform conventions", "empty, loading, error, success, offline", "touch targets", "accessibility as a given", "fast and", "predictable"]) {
  ok(app.includes(practice), `and names one: ${practice}`);
}
ok(/confident curiosity/.test(app) && /never lecturing/.test(app) && /when the designer's call is sound, say that too/.test(app), "approachable: curious, not lecturing, credits a sound call");
ok(/Speak as an app maker, never as an engineer/.test(app) && /the flow, the screen, the navigation, a state, a component/.test(app), "talks about the app (flows, screens, states), never the plumbing");
ok(/no file paths, function names, commands, stack or tooling talk unless the designer asks/.test(app), "the same no-tooling rule as the designer persona");
ok(!/—/.test(app), "no em-dashes");

// ---- routing --------------------------------------------------------------------
ok(/const builderPersona = projectState && projectState\.projectType === "app" \? APP_PERSONA : CHAT_PERSONA;/.test(agent), "an app project gets the App persona, anything else the designer's");
ok(/reviewMode \? ART_DIRECTOR_PERSONA : \(builderPersona \+ buildVoiceAppend\(copyVoice\)\)/.test(agent), "the Art Director review is unaffected, and the copy voice still rides the builder");
const state = main.slice(main.indexOf("function projectStateForAgent"), main.indexOf("function siteReady"));
ok(/VITE_PROJECT_TYPE/.test(state) && /intakeBrief\.projectType/.test(state), "main reads the type from .env, else from the walk-through's first fork");
ok(/if \(\(envType \|\| briefType\) === "app"\) projectType = "app";/.test(state), ".env wins once set; otherwise the fork; anything but app is a web site");
ok((state.match(/projectType/g) || []).length >= 5 && /promoted: true, design: r\.design, blocks, projectType/.test(state), "and hands it to the agent on every shape of state (not promoted, promoted, error)");

console.log(`app-persona: ${checks} checks pass.`);

// ©2026 thinkany llc. All rights reserved.
// TOOL GUARD: the PreToolUse rail for the app's agent turns. The model can only
// touch the designer's machine through Bash and the file tools; this decides, per
// call, whether a command or a write stays inside the lines:
//   • writes (files, rm, mv, cp, redirections, …) only inside the project folder
//     or the OS temp dir; nothing under the home folder, / or another project
//   • no privilege escalation, disk/system commands, keychain reads, env dumps
//     (the Claude key rides in the environment), or curl-pipe-shell installs
//   • git pushes only to named remotes the project already has; no remote edits
// Pure and synchronous so it can be unit-tested (scratchpad/tool-guard-test.cjs)
// and reasoned about. Deny reasons go back to the model, which explains in the
// designer's terms; a false positive costs one retry, a miss costs a machine.
const path = require("node:path");
const os = require("node:os");

const WRITE_VERBS = new Set(["rm", "rmdir", "mv", "cp", "mkdir", "touch", "tee", "ln", "install", "rsync", "chmod", "chown", "truncate", "unzip", "tar", "dd", "shred", "sed"]);
const SHELL_TARGETS = /\b(sh|bash|zsh|ksh|fish|node|python3?|perl|ruby|osascript)\b/;

// Patterns denied outright, wherever they appear in the command.
const DENY = [
  [/(^|[\s;&|(])(sudo|su|doas)(\s|$)/, "privilege escalation (sudo/su)"],
  [/\b(mkfs|diskutil\s+(erase|partition|unmount)|fdisk|newfs)\b/, "a disk-level command"],
  [/\bdd\b[^|;&]*\bof=\/dev\//, "writing raw bytes to a device"],
  [/\b(shutdown|reboot|halt|poweroff)\b/, "a power command"],
  [/\b(launchctl|crontab|systemctl)\b/, "a system service or scheduler change"],
  [/\bdefaults\s+write\b/, "a system preferences change"],
  [/\bosascript\b/, "AppleScript, which can drive any app on the machine"],
  [/\bsecurity\s+(find|dump|export|delete|unlock)/, "a keychain read or write"],
  [/\bprintenv\b|(^|[\s;&|(])env\s*($|[;&|)])/, "dumping the environment (it carries keys)"],
  [/ANTHROPIC_API_KEY|DERIVE_LICENSE_KEY|DESIGN_LICENSE_KEY|FORMS_LICENSE_KEY|vercel-token|forms-secrets/, "reading or exposing a stored key"],
  [/:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, "a fork bomb"],
  [/\bkill\s+(-\d+\s+)?-1\b|\bkillall\s+-u\b/, "killing every process"],
  [/\b(chmod|chown)\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)[^;&|]*\s(\/|~)(\s|$)/, "a recursive permission change on the whole disk or home folder"],
  [/\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(sh|bash|zsh|ksh|node|python3?|perl|ruby)\b/, "piping a download straight into a shell"],
  [/\b(sh|bash|zsh|node|python3?)\s+<\(\s*(curl|wget)\b/, "running a download straight from the network"],
  [/\bgit\s+remote\s+(add|set-url|rename|remove|rm)\b/, "changing the project's git remotes"],
  [/\bgit\s+push\b[^;&|]*\s(--mirror|--all)\b/, "pushing every branch or mirroring the repo"],
  [/\bgit\s+push\b[^;&|]*\s(https?:\/\/|git@|ssh:\/\/|[\w.-]+@[\w.-]+:)/, "pushing to a remote given as a URL rather than one the project has"],
];

function allowedRoots(projectDir) {
  const roots = [projectDir, os.tmpdir(), "/tmp", "/private/tmp", "/private/var/folders", "/var/folders"];
  return roots.map((r) => { try { return path.resolve(r); } catch { return r; } });
}
const DEV_OK = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);

function inside(p, roots) {
  const rp = path.resolve(p);
  return roots.some((r) => rp === r || rp.startsWith(r + path.sep));
}

/** Expand ~ and $HOME; returns null for tokens that aren't a path we can judge. */
function asPath(token, cwd) {
  let t = token.replace(/^["']|["']$/g, "");
  if (!t) return null;
  if (t.startsWith("-")) return null; // a flag
  t = t.replace(/^\$\{?HOME\}?(?=\/|$)/, os.homedir()).replace(/^~(?=\/|$)/, os.homedir());
  if (/[$`]/.test(t)) return null; // unresolved expansion: can't judge; the write verbs rule stays conservative below
  if (t.startsWith("/")) return t;
  if (t.startsWith("./") || t.startsWith("../") || t === ".." || t === "." || t.includes("/")) return path.resolve(cwd, t);
  return path.resolve(cwd, t); // a bare name: relative to the current dir
}

/** Split a command line into segments on ; && || | (quotes respected loosely). */
function segments(cmd) {
  const out = []; let cur = ""; let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { cur += c; if (c === q && cmd[i - 1] !== "\\") q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ";" || c === "\n") { out.push(cur); cur = ""; continue; }
    if ((c === "&" || c === "|") && cmd[i + 1] === c) { out.push(cur); cur = ""; i++; continue; }
    if (c === "|") { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
function tokens(seg) {
  return (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t);
}

/**
 * Judge a Bash command. Returns null (fine) or a reason string.
 */
function checkBash(command, projectDir) {
  const cmd = String(command || "");
  for (const [re, why] of DENY) if (re.test(cmd)) return why;
  const roots = allowedRoots(projectDir);
  let cwd = path.resolve(projectDir);
  for (const seg of segments(cmd)) {
    const toks = tokens(seg);
    if (!toks.length) continue;
    // strip leading env assignments (FOO=1 cmd …)
    let i = 0; while (i < toks.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i])) i++;
    const verb = (toks[i] || "").replace(/^.*\//, "");
    const args = toks.slice(i + 1);
    if (verb === "cd") {
      const target = args.find((a) => !a.startsWith("-"));
      const p = target ? asPath(target, cwd) : os.homedir();
      if (p) cwd = p;
      continue;
    }
    // redirections: > path, >> path, 2> path
    const redir = seg.match(/(?:^|\s)\d?>{1,2}\s*("[^"]*"|'[^']*'|\S+)/g) || [];
    for (const r of redir) {
      const target = r.replace(/^.*>+\s*/, "");
      const p = asPath(target, cwd);
      if (p && !DEV_OK.has(p) && !inside(p, roots)) return `writing outside the project (${target})`;
    }
    if (!WRITE_VERBS.has(verb)) continue;
    if (verb === "sed" && !args.some((a) => /^-[a-zA-Z]*i/.test(a))) continue; // sed without -i only reads
    // rm on the project root itself, home, or / is never fine
    if (verb === "rm" && args.some((a) => { const p = asPath(a, cwd); return p && (p === os.homedir() || p === "/" || p === path.resolve(projectDir)); })) return "deleting the project folder, the home folder or the disk root";
    // cp / mv / rsync / install / ln read their sources from anywhere (a photo in
    // Downloads, a font in /tmp); only where they WRITE, the last path, is judged.
    const destOnly = ["cp", "mv", "rsync", "install", "ln"].includes(verb);
    const pathArgs = args.filter((a) => !a.startsWith("-"));
    const judged = destOnly ? pathArgs.slice(-1) : pathArgs;
    for (const a of judged) {
      if (verb === "tar" && !args.some((x) => /^-?[a-zA-Z]*x/.test(x) || x === "--extract")) break; // tar without extract only reads/creates locally
      const p = asPath(a, cwd);
      if (!p) continue;
      if (DEV_OK.has(p)) continue;
      if (!inside(p, roots)) return `${verb} touching a path outside the project (${a})`;
    }
    if (!inside(cwd, roots)) return `${verb} run from a folder outside the project`;
  }
  return null;
}

/** Judge a file tool's target path. Returns null (fine) or a reason string. */
function checkFilePath(filePath, projectDir) {
  if (!filePath || typeof filePath !== "string") return null;
  const roots = allowedRoots(projectDir);
  const p = path.isAbsolute(filePath) ? filePath : path.resolve(projectDir, filePath);
  return inside(p, roots) ? null : `writing outside the project (${filePath})`;
}

const FILE_TOOLS = { Write: "file_path", Edit: "file_path", MultiEdit: "file_path", NotebookEdit: "notebook_path" };
/**
 * The guard for one tool call. { allow: true } or { allow: false, reason }.
 */
function guardToolUse({ toolName, input, projectDir }) {
  if (!projectDir) return { allow: true };
  const inp = input && typeof input === "object" ? input : {};
  let why = null;
  if (toolName === "Bash") why = checkBash(inp.command, projectDir);
  else if (FILE_TOOLS[toolName]) why = checkFilePath(inp[FILE_TOOLS[toolName]], projectDir);
  if (!why) return { allow: true };
  return { allow: false, reason: `Blocked by thinkany design: ${why}. Work only inside this project's folder, and never with system-level commands. If the designer needs this, tell them in plain terms what you were going to do and why it was stopped.` };
}

module.exports = { guardToolUse, checkBash, checkFilePath, segments };

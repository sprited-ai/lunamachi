#!/usr/bin/env node
// gen-component — author a room prop the way you author a room: by prompt.
//
//   npm run gen:component -- "북극광이 천천히 흐르는 오로라" --room moon
//
// Pipeline:  prompt → Claude API → a self-contained component file
//            → inject its usage into a room → `npm run build` (the GREEN GATE)
//            → (if green) commit + push + deploy   [main 직행, opt-in flags]
//            → (if red)   feed the errors back to Claude and retry; else revert
//
// The model invents the procedural drawing (no assets); the seed lives in the
// engine, so the prop is reproducible. Runtime-agnostic Claude call mirrors
// ../anima/v34/core.mjs — the same brain can later sit behind a Worker endpoint
// for in-game summoning.

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENTS_DIR = resolve(ROOT, "src/rooms/components");
const ROOMS_DIR = resolve(ROOT, "src/rooms");
const MAX_REPAIR = 2; // build-error feedback rounds before giving up

// ── key (mirrors anima: a Worker secret in prod, .dev.vars locally) ──────────
function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = resolve(ROOT, ".dev.vars");
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

// ── args ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { prompt: "", room: "white", commit: false, deploy: false, model: process.env.GEN_MODEL || "claude-opus-4-8" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--room") a.room = argv[++i];
    else if (x === "--model") a.model = argv[++i];
    else if (x === "--commit") a.commit = true;
    else if (x === "--deploy") { a.commit = true; a.deploy = true; }
    else rest.push(x);
  }
  a.prompt = rest.join(" ").trim();
  return a;
}

// ── the authoring contract — kept in sync with the code by embedding it live ──
function buildContract() {
  const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
  const types = read("src/rooms/types.ts");
  const shared = read("src/rooms/shared.ts");
  const coerce = read("src/rooms/coerce.ts");
  const example = read("src/rooms/components/Fireflies.ts");

  const system = `You author **room components** for lunamachi — a 2.5D sprite world of tiny beings in procedurally generated rooms. A component is one in-world prop (rain, aurora, drifting petals, a lantern…), drawn entirely in code with Pixi.js. There are NO image assets: every prop is generated from Graphics primitives. This is non-negotiable.

A component is a single self-contained TypeScript file that default-exports a \`RoomComponent\`:
- \`tag\`: PascalCase, used as the XML element (e.g. "Aurora").
- \`type\`: the kebab/camel discriminant string (e.g. "aurora").
- \`parse(el)\`: read the element's attributes (via the coerce helpers) into a typed prop object whose first field is \`type\`.
- \`mount(prop, ctx)\`: build the visuals into \`ctx.container\` and return a \`SceneUpdate\` (a per-frame \`(dtMs, w, h) => void\`). For ALL randomness use \`ctx.rng()\` (the room's seeded stream) — never Math.random — so the room is reproducible from its seed.

You MAY import the shared primitives from "../shared" (addMoon/addStarField/addFireflies/combine/mulberry32) and the attribute coercers from "../coerce" (attr/opt/int/num/pair/hex), and Pixi's { Container, Graphics } from "pixi.js". Define the prop's own interface (extends Prop) inside the file and cast inside mount. Keep it tasteful and atmospheric — soft alphas, gentle motion, nothing garish.

Respond in EXACTLY this delimited format and nothing else:
TAG: <PascalCaseTag>
TYPE: <discriminant>
USAGE: <a single example XML element with sensible attributes, e.g. \`<Aurora bands="3" hue="#9ff0c8"/>\`>
NOTE: <one short line describing it>
---CODE---
<the complete .ts file content>
---END---`;

  const user = `Here is the exact contract — the types, the primitive toolkit, the coercers, and a worked example component.

=== src/rooms/types.ts ===
${types}

=== src/rooms/shared.ts (the no-asset primitive kit you may reuse) ===
${shared}

=== src/rooms/coerce.ts (attribute coercers) ===
${coerce}

=== EXAMPLE — src/rooms/components/Fireflies.ts ===
${example}

Now author a NEW component for this prop:`;

  return { system, user };
}

// ── Claude call (anima pattern) ───────────────────────────────────────────────
async function callClaude({ key, model, system, messages }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text().catch(() => "")).slice(0, 400)}`);
  const data = await r.json();
  return (data.content || []).map((b) => b.text || "").join("").trim();
}

// ── parse the delimited reply ─────────────────────────────────────────────────
function parseReply(raw) {
  const field = (name) => (raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m")) || [])[1]?.trim();
  const code = (raw.match(/---CODE---\n([\s\S]*?)\n---END---/) || [])[1];
  return { tag: field("TAG"), type: field("TYPE"), usage: field("USAGE"), note: field("NOTE"), code: code?.trim() };
}

// ── inject `<Usage/>` into a room's XML, just before </Room> ───────────────────
function injectIntoRoom(roomId, usage) {
  const f = resolve(ROOMS_DIR, `${roomId}.room.xml`);
  if (!existsSync(f)) throw new Error(`room not found: ${roomId}.room.xml`);
  const xml = readFileSync(f, "utf8");
  if (xml.includes(usage)) return () => {}; // already there
  const indented = `  ${usage}\n`;
  const next = xml.replace(/\n?<\/Room>\s*$/, `\n${indented}</Room>\n`);
  writeFileSync(f, next);
  return () => writeFileSync(f, xml); // undo
}

function recipeHeader({ prompt, model }, dateISO) {
  return `// @generated by gen-component — reproducible recipe:\n//   prompt: ${JSON.stringify(prompt)}\n//   model:  ${model}\n//   at:     ${dateISO}\n`;
}

function tryBuild() {
  try {
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    return { ok: true };
  } catch (e) {
    const out = `${e.stdout || ""}${e.stderr || ""}`.toString();
    return { ok: false, errors: out.slice(-2500) };
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
if (!args.prompt) {
  console.error('usage: npm run gen:component -- "<prompt>" [--room <id>] [--commit] [--deploy] [--model <id>]');
  process.exit(1);
}
const key = loadKey();
if (!key) {
  console.error("✗ no ANTHROPIC_API_KEY — put it in .dev.vars (ANTHROPIC_API_KEY=sk-...) or the environment.");
  process.exit(1);
}

const { system, user } = buildContract();
const dateISO = new Date().toISOString().slice(0, 10);
console.log(`▸ summoning a prop from: "${args.prompt}"  (model ${args.model}, room ${args.room})`);

const messages = [{ role: "user", content: `${user}\n\n${args.prompt}` }];
let reply = await callClaude({ key, model: args.model, system, messages });

let undoRoom = null;
let filePath = null;

for (let round = 0; ; round++) {
  const { tag, type, usage, note, code } = parseReply(reply);
  if (!tag || !code) {
    console.error("✗ model did not return a parseable component. Raw reply head:\n" + reply.slice(0, 600));
    if (undoRoom) undoRoom();
    if (filePath && existsSync(filePath)) rmSync(filePath);
    process.exit(1);
  }

  // write the component file (with a reproducible recipe header) + wire it in
  filePath = resolve(COMPONENTS_DIR, `${tag}.ts`);
  const withHeader = code.startsWith("//") ? code : recipeHeader(args, dateISO) + "\n" + code;
  writeFileSync(filePath, withHeader.endsWith("\n") ? withHeader : withHeader + "\n");
  if (!undoRoom && usage) undoRoom = injectIntoRoom(args.room, usage);
  console.log(`  wrote ${tag}.ts  —  ${note || ""}`);
  if (usage) console.log(`  using: ${usage}  (in ${args.room})`);

  console.log("  building (green gate)…");
  const build = tryBuild();
  if (build.ok) {
    console.log(`✓ build green. <${tag}/> is live in the ${args.room} room.`);
    break;
  }

  if (round >= MAX_REPAIR) {
    console.error(`✗ build still failing after ${MAX_REPAIR} repair rounds — reverting.\n${build.errors}`);
    if (undoRoom) undoRoom();
    if (existsSync(filePath)) rmSync(filePath);
    process.exit(1);
  }

  console.log(`  build red — feeding errors back (repair ${round + 1}/${MAX_REPAIR})…`);
  messages.push({ role: "assistant", content: reply });
  messages.push({
    role: "user",
    content: `The build failed:\n\n${build.errors}\n\nFix the component and return it again in the exact same delimited format (TAG/TYPE/USAGE/NOTE then ---CODE---…---END---).`,
  });
  reply = await callClaude({ key, model: args.model, system, messages });
}

// ── land it (opt-in) ──────────────────────────────────────────────────────────
const { tag } = parseReply(reply);
if (args.commit) {
  console.log("  committing to main…");
  execSync("git add -A", { cwd: ROOT });
  execSync(`git commit -q -m ${JSON.stringify(`prop: <${tag}/> — ${args.prompt}`)}`, { cwd: ROOT });
  execSync("git push", { cwd: ROOT, stdio: "inherit" });
}
if (args.deploy) {
  console.log("  deploying (wrangler)…");
  execSync("npx wrangler deploy", { cwd: ROOT, stdio: "inherit" });
}
if (!args.commit) console.log("  (local only — add --commit to push to main, --deploy to ship)");

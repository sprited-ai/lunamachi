#!/usr/bin/env node
// gen-particle — author an ambient particle effect as DATA, not code.
//
//   npm run gen:particle -- "thin mist drifting low over the floor" --room rain
//
// The model returns a single <Particles .../> element (attributes only); we
// validate it and inject it into a room. No new file, no build gate, no
// self-repair — the <Particles> engine already renders any valid config. This is
// the data-gen path (vs gen-component's code-gen): safe, instant, and the same
// call could one day run in-app (it produces data, never code to compile).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOMS_DIR = resolve(ROOT, "src/rooms");

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

function parseArgs(argv) {
  const a = { prompt: "", room: "white", model: process.env.GEN_MODEL || "claude-opus-4-8" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--room") a.room = argv[++i];
    else if (x === "--model") a.model = argv[++i];
    else rest.push(x);
  }
  a.prompt = rest.join(" ").trim();
  return a;
}

async function callClaude({ key, model, system, user }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 512, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text().catch(() => "")).slice(0, 400)}`);
  const data = await r.json();
  return (data.content || []).map((b) => b.text || "").join("").trim();
}

// pull the single <Particles .../> element out of the reply (strips any prose/fence)
function extract(reply) {
  const m = reply.match(/<Particles\b[^<>]*\/>/);
  return m ? m[0] : null;
}

// light validation — Particles.parse is lenient (defaults + enum fallback); only
// `count` is required and must be numeric, and any colour must be hex. No build
// gate needed because it's data conforming to an existing component's schema.
function validate(el) {
  const attrs = {};
  for (const m of el.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]] = m[2];
  if (attrs.count === undefined || !Number.isFinite(Number(attrs.count))) {
    throw new Error(`<Particles> needs a numeric count: ${el}`);
  }
  if (attrs.color && !/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(attrs.color)) {
    throw new Error(`bad colour "${attrs.color}"`);
  }
  return attrs;
}

function injectIntoRoom(roomId, el) {
  const f = resolve(ROOMS_DIR, `${roomId}.room.xml`);
  if (!existsSync(f)) throw new Error(`room not found: ${roomId}.room.xml`);
  const xml = readFileSync(f, "utf8");
  if (xml.includes(el)) return; // already there
  writeFileSync(f, xml.replace(/\n?<\/Room>\s*$/, `\n  ${el}\n</Room>\n`));
}

const args = parseArgs(process.argv.slice(2));
if (!args.prompt) {
  console.error('usage: npm run gen:particle -- "<vibe>" [--room <id>] [--model <id>]');
  process.exit(1);
}
const key = loadKey();
if (!key) {
  console.error("✗ no ANTHROPIC_API_KEY — put it in .dev.vars (ANTHROPIC_API_KEY=sk-...) or the environment.");
  process.exit(1);
}

// the schema reference = the live Particles component (attrs, defaults, families)
const particles = readFileSync(resolve(ROOT, "src/rooms/components/Particles.ts"), "utf8");
const system = `You design an ambient particle effect for a lunamachi room as a SINGLE <Particles/> element — data, not code. Here is the component that renders it (its attributes, defaults, and the families it can express):

${particles}

Given a vibe, output ONLY one self-closing <Particles .../> element whose attributes capture that vibe — choose shape (dot/glow/line), motion (fall/rise/drift/still), and tune count / band / color / glow / size / length / tilt / sway / twinkle / depth. Keep it tasteful and atmospheric. No prose, no markdown, no code fence — just the element.`;

console.log(`▸ designing a particle effect: "${args.prompt}"  (model ${args.model}, room ${args.room})`);
const reply = await callClaude({ key, model: args.model, system, user: args.prompt });
const el = extract(reply);
if (!el) {
  console.error("✗ model did not return a <Particles/> element. Raw reply:\n" + reply.slice(0, 400));
  process.exit(1);
}
validate(el);
injectIntoRoom(args.room, el);
console.log(`✓ ${el}`);
console.log(`  added to the ${args.room} room — data only: no new file, no build gate.`);

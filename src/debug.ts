// Component debug page (/debug.html) — a standalone harness to eyeball every
// registered component in isolation (or all at once) on a neutral backdrop, with
// a live inspector: the component's prop + the Pixi scene tree with per-node
// properties. QA a freshly authored/generated prop without entering a room.
// Deliberately app-shell-free (no React, no beings) so it never touches main.tsx.

import { Application, Container } from "pixi.js";
import { COMPONENTS } from "./rooms/components";
import { mulberry32 } from "./rooms/shared";
import type { Prop, RoomComponent, SceneUpdate } from "./rooms/types";

const mountable = COMPONENTS.filter((c) => c.mount && c.example);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const isColorKey = (k: string) => /color|hue|tint|accent/i.test(k);
const hex = (n: number) => "#" + (n >>> 0).toString(16).padStart(6, "0");

function formatProp(p: Prop): string {
  return Object.entries(p)
    .map(([k, v]) => {
      let val: string;
      if (isColorKey(k) && typeof v === "number") val = hex(v);
      else if (Array.isArray(v)) val = `[${v.join(", ")}]`;
      else val = JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join("\n");
}

// A compact one-line summary of a Pixi display node's live properties.
function describe(node: Container): string {
  const name = node.label || node.constructor?.name || "Object";
  const bits = [`x${node.x | 0} y${node.y | 0}`, `α${(node.alpha ?? 1).toFixed(2)}`];
  const s = node.scale?.x ?? 1;
  if (Math.abs(s - 1) > 0.001) bits.push(`s${s.toFixed(2)}`);
  if (node.rotation) bits.push(`r${node.rotation.toFixed(2)}`);
  if (node.visible === false) bits.push("hidden");
  return `${name}  ${bits.join("  ")}`;
}

const MAX_ROWS = 90;

function buildTree(roots: Container[]): string {
  const rows: string[] = [];
  let count = 0;
  const walk = (node: Container, depth: number) => {
    if (count >= MAX_ROWS) return;
    count++;
    const kids = node.children as Container[];
    const indent = "  ".repeat(depth);
    const lead = kids.length ? "▸ " : "· ";
    rows.push(`${indent}${lead}${describe(node)}${kids.length ? `  ·${kids.length}` : ""}`);
    for (const k of kids) {
      if (count >= MAX_ROWS) {
        rows.push(`${"  ".repeat(depth + 1)}…`);
        break;
      }
      walk(k, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  return rows.join("\n") || "(empty)";
}

(async () => {
  const app = new Application();
  await app.init({ resizeTo: window, background: "#0b0e1a", antialias: true });
  document.body.appendChild(app.canvas);

  const stage = new Container();
  app.stage.addChild(stage);
  let updates: SceneUpdate[] = [];
  let current: RoomComponent | "all" = mountable[mountable.length - 1] ?? "all";

  const inspProp = $<HTMLPreElement>("insp-prop");
  const inspTree = $<HTMLPreElement>("insp-tree");
  const inspector = $<HTMLElement>("inspector");

  const mountOne = (comp: RoomComponent) => {
    const container = new Container();
    container.label = `<${comp.tag}/>`;
    stage.addChild(container);
    const rng = mulberry32(42); // fixed seed → stable layout while debugging
    updates.push(comp.mount!(comp.example!, { container, w: app.screen.width, h: app.screen.height, rng }));
  };

  const render = (sel: RoomComponent | "all") => {
    current = sel;
    for (const c of stage.removeChildren()) c.destroy({ children: true });
    updates = [];
    if (sel === "all") mountable.forEach(mountOne);
    else mountOne(sel);

    label.textContent = sel === "all" ? `all · ${mountable.length} components` : `<${sel.tag}/>`;
    inspProp.textContent =
      sel === "all" ? mountable.map((c) => `<${c.tag}/>`).join("\n") : formatProp(sel.example!);
    for (const [c, b] of buttons) b.classList.toggle("active", c === sel);
  };

  app.ticker.add((t) => {
    for (const u of updates) u(t.deltaMS, app.screen.width, app.screen.height);
  });

  // live scene-tree refresh (only while the inspector is open)
  let inspectorOpen = true;
  window.setInterval(() => {
    if (inspectorOpen) inspTree.textContent = buildTree(stage.children as Container[]);
  }, 350);

  const toggleInspector = () => {
    inspectorOpen = !inspectorOpen;
    inspector.style.display = inspectorOpen ? "" : "none";
  };
  $<HTMLButtonElement>("insp-toggle").onclick = toggleInspector;
  window.addEventListener("keydown", (e) => {
    if (e.key === "i") toggleInspector();
  });

  // re-mount on resize so position-at-mount components stay correct
  let rt: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => render(current), 120);
  });

  // toolbar
  const bar = $<HTMLDivElement>("bar");
  const buttons = new Map<RoomComponent | "all", HTMLButtonElement>();
  const addBtn = (sel: RoomComponent | "all", text: string) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = () => render(sel);
    bar.appendChild(b);
    buttons.set(sel, b);
  };
  for (const c of mountable) addBtn(c, c.tag);
  addBtn("all", "all");
  const label = document.createElement("span");
  label.id = "label";
  bar.appendChild(label);

  render(current);
})();

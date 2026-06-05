// Component debug page (/debug.html) — a standalone harness to eyeball every
// registered component in isolation (or all at once) on a neutral backdrop, with
// a live inspector: the component's prop + the Pixi scene tree with per-node
// properties. QA a freshly authored/generated prop without entering a room.
// Deliberately app-shell-free (no React, no beings) so it never touches main.tsx.
//
// The "P:" buttons mount ONE <Particles> component with different props — snow,
// rain, fireflies, stars, mist — making the components-as-data idea visible: a
// whole family of ambient props is one component plus data.

import { Application, Container } from "pixi.js";
import { COMPONENTS } from "./rooms/components";
import { mulberry32 } from "./rooms/shared";
import type { Prop, RoomComponent, SceneUpdate } from "./rooms/types";
import { buildTree } from "./scene-tree";

const mountable = COMPONENTS.filter((c) => c.mount && c.example);

interface Preset { name: string; prop: Prop }
type Sel = RoomComponent | "all" | Preset;
const isPreset = (s: Sel): s is Preset => typeof s === "object" && "prop" in s;

// One <Particles> component expressing a whole family — data, not code.
const particles = COMPONENTS.find((c) => c.tag === "Particles" && c.mount);
const parsePreset = (xml: string): Prop =>
  particles!.parse(new DOMParser().parseFromString(xml, "application/xml").documentElement);
const PRESETS: Preset[] = !particles
  ? []
  : (
      [
        ["snow", `<Particles count="90" shape="glow" motion="fall" color="#f4f8ff" glow="3" size="1.2" sway="14" speed="0.45"/>`],
        ["rain", `<Particles count="120" shape="line" motion="fall" color="#9fb4d6" tilt="0.18" length="14" speed="0.9"/>`],
        ["fireflies", `<Particles count="50" shape="glow" motion="drift" color="#fff7c0" glow="5" sway="10" band="0.4,0.95"/>`],
        ["stars", `<Particles count="90" shape="dot" motion="still" color="#ffffff" size="1.2" twinkle="0.35" band="0,0.6"/>`],
        ["mist", `<Particles count="34" shape="glow" motion="drift" color="#9fb4c8" glow="22" size="2" band="0.82,0.98" sway="26" speed="0.18"/>`],
      ] as const
    ).map(([name, xml]) => ({ name, prop: parsePreset(xml) }));

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

(async () => {
  const app = new Application();
  await app.init({ resizeTo: window, background: "#0b0e1a", antialias: true });
  document.body.appendChild(app.canvas);

  const stage = new Container();
  app.stage.addChild(stage);
  let updates: SceneUpdate[] = [];
  let current: Sel = mountable[mountable.length - 1] ?? "all";

  const inspProp = $<HTMLPreElement>("insp-prop");
  const inspTree = $<HTMLPreElement>("insp-tree");
  const inspector = $<HTMLElement>("inspector");

  const mount = (label: string, comp: RoomComponent, prop: Prop) => {
    const container = new Container();
    container.label = label;
    stage.addChild(container);
    const rng = mulberry32(42); // fixed seed → stable layout while debugging
    updates.push(comp.mount!(prop, { container, w: app.screen.width, h: app.screen.height, rng }));
  };

  const render = (sel: Sel) => {
    current = sel;
    for (const c of stage.removeChildren()) c.destroy({ children: true });
    updates = [];
    if (sel === "all") mountable.forEach((c) => mount(`<${c.tag}/>`, c, c.example!));
    else if (isPreset(sel)) mount(`<Particles> ${sel.name}`, particles!, sel.prop);
    else mount(`<${sel.tag}/>`, sel, sel.example!);

    label.textContent =
      sel === "all" ? `all · ${mountable.length} components`
      : isPreset(sel) ? `<Particles/> · ${sel.name}`
      : `<${sel.tag}/>`;
    inspProp.textContent =
      sel === "all" ? mountable.map((c) => `<${c.tag}/>`).join("\n")
      : isPreset(sel) ? formatProp(sel.prop)
      : formatProp(sel.example!);
    for (const [c, b] of buttons) b.classList.toggle("active", c === sel);
  };

  app.ticker.add((t) => {
    for (const u of updates) u(t.deltaMS, app.screen.width, app.screen.height);
  });

  // live scene-tree refresh (only while the inspector is open)
  let inspectorOpen = true;
  window.setInterval(() => {
    if (inspectorOpen) inspTree.textContent = buildTree(stage.children as Container[], { maxRows: 200 });
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
  const buttons = new Map<Sel, HTMLButtonElement>();
  const addBtn = (sel: Sel, text: string) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = () => render(sel);
    bar.appendChild(b);
    buttons.set(sel, b);
  };
  for (const c of mountable) addBtn(c, c.tag);
  addBtn("all", "all");
  for (const pr of PRESETS) addBtn(pr, `P:${pr.name}`);
  const label = document.createElement("span");
  label.id = "label";
  bar.appendChild(label);

  render(current);
})();

// Component debug page (/debug.html) — a standalone harness to eyeball every
// registered component in isolation (or all at once) on a neutral backdrop.
// Useful for QA'ing a freshly authored/generated prop without entering a room.
// Deliberately app-shell-free (no React, no beings) so it never touches main.tsx.

import { Application, Container } from "pixi.js";
import { COMPONENTS } from "./rooms/components";
import { mulberry32 } from "./rooms/shared";
import type { RoomComponent, SceneUpdate } from "./rooms/types";

const mountable = COMPONENTS.filter((c) => c.mount && c.example);

(async () => {
  const app = new Application();
  await app.init({ resizeTo: window, background: "#0b0e1a", antialias: true });
  document.body.appendChild(app.canvas);

  const stage = new Container();
  app.stage.addChild(stage);
  let updates: SceneUpdate[] = [];
  let current: RoomComponent | "all" = mountable[mountable.length - 1] ?? "all";

  const mountOne = (comp: RoomComponent) => {
    const container = new Container();
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
    for (const [c, b] of buttons) b.classList.toggle("active", c === sel);
  };

  app.ticker.add((t) => {
    for (const u of updates) u(t.deltaMS, app.screen.width, app.screen.height);
  });

  // re-mount on resize so position-at-mount components stay correct
  let rt: number | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => render(current), 120);
  });

  // toolbar
  const bar = document.getElementById("bar")!;
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

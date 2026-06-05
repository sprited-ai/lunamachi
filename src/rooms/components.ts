// Room components — the JSX-like vocabulary a room composes.
//
// Each component is self-contained, like a React component: it owns its tag
// (PascalCase, used in the XML), how to parse its attributes into a typed prop,
// and (for in-world props) how to mount itself into the scene. A room is just a
// composition of these. Adding a component here = a new tag rooms can use.
//
//   <Moon at="0.72,0.2"/>  <StarField count="110"/>  <MagicCircle/>

import type { Container } from "pixi.js";
import type { Prop, SceneUpdate } from "./types";
import { addMoon, addStarField, addFireflies } from "./shared";
import { attr, opt, pair, int, hex } from "./coerce";

export interface MountCtx {
  container: Container;
  w: number;
  h: number;
  rng: () => number;
}

export interface RoomComponent {
  /** PascalCase XML tag, e.g. "Moon" */
  tag: string;
  /** the prop discriminant this component produces, e.g. "moon" */
  type: Prop["type"];
  /** parse this element's attributes into a typed prop */
  parse(el: Element): Prop;
  /** draw into the scene container; omitted for non-visual / engine-handled props */
  mount?(prop: Prop, ctx: MountCtx): SceneUpdate;
}

const Moon: RoomComponent = {
  tag: "Moon",
  type: "moon",
  parse: (el) => ({ type: "moon", at: opt(el, "at", pair, [0.72, 0.2]) }),
  mount: (prop, { container, w, h }) => {
    if (prop.type !== "moon") throw new Error("unreachable");
    return addMoon(container, w, h, prop.at[0], prop.at[1]);
  },
};

const StarField: RoomComponent = {
  tag: "StarField",
  type: "starField",
  parse: (el) => ({ type: "starField", count: int(attr(el, "count")) }),
  mount: (prop, { container, w, h, rng }) => {
    if (prop.type !== "starField") throw new Error("unreachable");
    return addStarField(container, w, h, prop.count, rng);
  },
};

const Fireflies: RoomComponent = {
  tag: "Fireflies",
  type: "fireflies",
  parse: (el) => ({
    type: "fireflies",
    count: int(attr(el, "count")),
    band: opt(el, "band", pair, [0.6, 0.96]),
    glow: opt(el, "glow", Number, undefined),
    color: opt(el, "color", hex, undefined),
  }),
  mount: (prop, { container, w, h, rng }) => {
    if (prop.type !== "fireflies") throw new Error("unreachable");
    return addFireflies(container, w, h, prop.count, rng, {
      band: prop.band,
      glow: prop.glow,
      color: prop.color,
    });
  },
};

// The portal. Declared per-room so a room states "I have a way out"; the engine
// (main) owns its placement, nav and interactivity. No mount() — not a scene prop.
const MagicCircle: RoomComponent = {
  tag: "MagicCircle",
  type: "magic-circle",
  parse: () => ({ type: "magic-circle" }),
};

export const COMPONENTS: RoomComponent[] = [MagicCircle, Moon, StarField, Fireflies];

export const byTag = new Map(COMPONENTS.map((c) => [c.tag, c]));
export const byType = new Map(COMPONENTS.map((c) => [c.type, c]));

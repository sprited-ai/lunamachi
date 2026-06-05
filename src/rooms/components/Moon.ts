// <Moon at="fx,fy"/> — a soft glowing moon high in the sky.

import type { RoomComponent, Prop } from "../types";
import { addMoon } from "../shared";
import { opt, pair } from "../coerce";

interface MoonProp extends Prop {
  type: "moon";
  at: [number, number];
}

const Moon: RoomComponent = {
  tag: "Moon",
  type: "moon",
  parse: (el): MoonProp => ({ type: "moon", at: opt(el, "at", pair, [0.72, 0.2]) }),
  mount: (prop, { container, w, h }) => {
    const p = prop as MoonProp;
    return addMoon(container, w, h, p.at[0], p.at[1]);
  },
  example: { type: "moon", at: [0.5, 0.28] } as MoonProp,
};

export default Moon;

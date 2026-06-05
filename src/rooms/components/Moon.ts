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
  parse: (el) => ({ type: "moon", at: opt(el, "at", pair, [0.72, 0.2]) } satisfies MoonProp),
  mount: (prop, { container, w, h }) => {
    const p = prop as MoonProp;
    return addMoon(container, w, h, p.at[0], p.at[1]);
  },
};

export default Moon;

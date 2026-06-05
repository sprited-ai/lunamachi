// <Fireflies count="80" band="0.42,0.98" glow="5" color="#fff7c0"/>
// Warm motes drifting and pulsing within a vertical band.

import type { RoomComponent, Prop } from "../types";
import { addFireflies } from "../shared";
import { attr, int, opt, pair, hex } from "../coerce";

interface FirefliesProp extends Prop {
  type: "fireflies";
  count: number;
  band: [number, number];
  glow?: number;
  color?: number;
}

const Fireflies: RoomComponent = {
  tag: "Fireflies",
  type: "fireflies",
  parse: (el) =>
    ({
      type: "fireflies",
      count: int(attr(el, "count")),
      band: opt(el, "band", pair, [0.6, 0.96]),
      glow: opt(el, "glow", Number, undefined),
      color: opt(el, "color", hex, undefined),
    }) satisfies FirefliesProp,
  mount: (prop, { container, w, h, rng }) => {
    const p = prop as FirefliesProp;
    return addFireflies(container, w, h, p.count, rng, { band: p.band, glow: p.glow, color: p.color });
  },
};

export default Fireflies;

import { Container } from "pixi.js";
import type { Room } from "./types";
import { addFireflies, addMoon, addStarField, combine } from "./shared";

function background(): string {
  // Deep indigo sky, a soft moon-glow high-right, warming toward a hazy summer
  // horizon, settling to a calm dark ground the beings stand on.
  return (
    `radial-gradient(46% 34% at 72% 21%, rgba(196,206,240,0.22) 0%, rgba(196,206,240,0) 60%),` +
    `linear-gradient(to bottom,` +
    `#070b1e 0%,` +
    `#0c1228 34%,` +
    `#141b3c 54%,` +
    `#1d2550 66%,` +
    `#2a2a55 75%,` +
    `#232545 84%,` +
    `#14182f 100%)`
  );
}

export const moon: Room = {
  id: "moon",
  name: "summer moon",
  accent: 0xb6a4ff,
  background,
  tuning: {
    population: 70,
    speed: 32, poseChance: 0.42, greetChance: 0.16, shadow: 0.34,
    floorTop: 0.62, floorBottom: 0.96, height: 120,
  },
  createScene(w, h) {
    const container = new Container();
    return {
      container,
      update: combine([
        addMoon(container, w, h),
        addStarField(container, w, h, 110),
        addFireflies(container, w, h, 16),
      ]),
    };
  },
};

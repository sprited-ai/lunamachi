import { Container } from "pixi.js";
import type { Room } from "./types";
import { addFireflies, addStarField, combine } from "./shared";

function background(): string {
  // A warm summer dusk: deep teal sky settling into a dark meadow, a faint green
  // glow low where the grass would be — the stage for drifting fireflies.
  return (
    `radial-gradient(55% 42% at 50% 14%, rgba(150,190,170,0.12) 0%, rgba(150,190,170,0) 55%),` +
    `linear-gradient(to bottom,` +
    `#0e1f28 0%,` +
    `#143038 33%,` +
    `#1b3e42 53%,` +
    `#234a40 65%,` +     /* warm-green horizon band */
    `#1a3a32 79%,` +
    `#0f231f 100%)`      /* dark meadow ground */
  );
}

export const fireflies: Room = {
  id: "fireflies",
  name: "fireflies",
  accent: 0xd8f0a0,
  background,
  tuning: {
    population: 55,
    speed: 28, poseChance: 0.4, greetChance: 0.16, shadow: 0.3,
    floorTop: 0.6, floorBottom: 0.97, height: 118,
  },
  createScene(w, h) {
    const container = new Container();
    return {
      container,
      update: combine([
        addStarField(container, w, h, 36),
        addFireflies(container, w, h, 80, { band: [0.42, 0.98], glow: 5, color: 0xfff7c0 }),
      ]),
    };
  },
};

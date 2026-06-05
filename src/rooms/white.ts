import { cfg } from "../config";
import type { Room } from "./types";

function background(): string {
  const h = Math.round(cfg.horizon * 100);
  return (
    `radial-gradient(80% 50% at 52% 6%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%),` +
    `linear-gradient(to bottom,` +
    `#e6ecf4 0%,` +
    `#e1e8f1 ${Math.round(h * 0.62)}%,` +
    `#d8dfea ${Math.round(h * 0.92)}%,` +
    `#d0d9e7 ${h}%,` +
    `#eef2f8 ${h + 5}%,` +
    `#fafbfe ${h + 11}%,` +
    `#ffffff ${h + 18}%)`
  );
}

export const white: Room = {
  id: "white",
  name: "white room",
  accent: 0x86b8ff,
  background,
  tuning: {
    population: 100,
    speed: 75, poseChance: 0.2, greetChance: 0.13, shadow: 0.7,
    floorTop: 0.56, floorBottom: 0.95, horizon: 0.56, height: 128,
  },
};

// Named backdrop generators. A room's <Background type="..."/> picks one; it
// reads the room's <Palette> and returns a CSS gradient. No fixed images — the
// backdrop is generated from a handful of colours (see PRINCIPLES.md).

import { cfg } from "../config";
import type { Palette } from "./types";

const css = (n: number) => "#" + (n >>> 0).toString(16).padStart(6, "0");

/** Deep sky settling onto a floor — the night / dusk rooms. */
export function skyFloor(p: Palette): string {
  const top = css(p.skyTop);
  const mid = css(p.skyMid ?? p.skyTop);
  const hor = css(p.horizon);
  const gnd = css(p.ground);
  return (
    `radial-gradient(48% 36% at 72% 20%, rgba(200,210,240,0.16) 0%, rgba(200,210,240,0) 60%),` +
    `linear-gradient(to bottom, ${top} 0%, ${mid} 38%, ${hor} 64%, ${gnd} 100%)`
  );
}

/** A bright gallery wall meeting a pale floor at the (live-tunable) horizon seam. */
export function gallery(p: Palette): string {
  const h = Math.round(cfg.horizon * 100);
  const wall = css(p.skyTop);
  const seam = css(p.horizon);
  const floor = css(p.ground);
  return (
    `radial-gradient(80% 50% at 52% 6%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%),` +
    `linear-gradient(to bottom, ${wall} 0%, ${seam} ${h}%, ${floor} ${h + 18}%)`
  );
}

export const BACKGROUNDS: Record<string, (p: Palette) => string> = { skyFloor, gallery };

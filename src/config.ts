// Live-tunable config for the mini-beings room. A single mutable object the
// beings read every frame, and the Tab debug panel mutates. Changing a field
// takes effect immediately (population changes require a respawn).

export interface Config {
  population: number;
  uniformSize: boolean; // ignore perspective scaling — every being the same height
  height: number; // on-screen cell height (px) when uniformSize
  minHeight: number; // back of the floor band (perspective)
  maxHeight: number; // front / nearest (perspective)
  floorTop: number; // fraction of room height — the vanishing line (gradient horizon)
  floorBottom: number; // fraction of room height — the front of the floor
  shadow: number; // contact-shadow size multiplier
  speed: number; // wander speed (px/s)
  poseChance: number; // chance a rest shows the static reference pose
  greetChance: number; // chance a rest spontaneously greets
  horizon: number; // gradient wall/floor seam (fraction) — kept == floorTop
}

export const cfg: Config = {
  population: 120,
  uniformSize: true,
  height: 128,
  minHeight: 62,
  maxHeight: 150,
  floorTop: 0.56,
  floorBottom: 0.96,
  shadow: 0.7,
  speed: 75,
  poseChance: 0.2,
  greetChance: 0.13,
  horizon: 0.56,
};

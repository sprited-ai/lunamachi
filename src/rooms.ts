// Rooms — each is a backdrop + an optional ambient Pixi scene behind the beings
// + a set of behaviour tweaks applied to the shared cfg on enter. The same
// little crowd persists across rooms; only the mood changes.

import { Container, Graphics } from "pixi.js";
import { cfg, type Config } from "./config";

export interface Scene {
  container: Container;
  update(dtMs: number, w: number, h: number): void;
}

export interface Room {
  id: string;
  name: string;
  /** body CSS background for this room */
  background: () => string;
  /** behaviour tweaks merged into cfg on enter (never changes population) */
  tuning: Partial<Config>;
  /** optional ambient scene drawn behind the beings */
  createScene?: (w: number, h: number) => Scene;
}

// --- white room (the original) ------------------------------------------------

function whiteBackground(): string {
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

const WHITE_TUNING: Partial<Config> = {
  speed: 75, poseChance: 0.2, greetChance: 0.13, shadow: 0.7,
  floorTop: 0.56, floorBottom: 0.95, horizon: 0.56, height: 128,
};

// --- summer-night moon room ---------------------------------------------------

function nightBackground(): string {
  // Deep indigo sky, a soft moon-glow high-right, warming toward a hazy summer
  // horizon, settling to a calm dark ground the beings stand on.
  return (
    `radial-gradient(46% 34% at 72% 21%, rgba(196,206,240,0.22) 0%, rgba(196,206,240,0) 60%),` +
    `linear-gradient(to bottom,` +
    `#070b1e 0%,` +
    `#0c1228 34%,` +
    `#141b3c 54%,` +
    `#1d2550 66%,` +       /* horizon haze */
    `#2a2a55 75%,` +       /* faint warm summer band */
    `#232545 84%,` +
    `#14182f 100%)`        /* ground */
  );
}

// Calmer behaviour: slower, more still poses, softer night shadows, beings
// gathered a touch lower under the moon.
const MOON_TUNING: Partial<Config> = {
  speed: 32, poseChance: 0.42, greetChance: 0.16, shadow: 0.34,
  floorTop: 0.62, floorBottom: 0.96, height: 120,
};

function createMoonScene(w: number, h: number): Scene {
  const container = new Container();
  let t = 0;

  // Moon — soft layered glow + a warm pale disc with a couple of faint maria.
  const moon = new Container();
  const R = Math.min(w, h) * 0.085;
  moon.addChild(new Graphics().circle(0, 0, R * 2.8).fill({ color: 0xc9d6ff, alpha: 0.05 }));
  moon.addChild(new Graphics().circle(0, 0, R * 1.8).fill({ color: 0xdfe7ff, alpha: 0.08 }));
  moon.addChild(new Graphics().circle(0, 0, R * 1.25).fill({ color: 0xeef1ff, alpha: 0.12 }));
  moon.addChild(new Graphics().circle(0, 0, R).fill({ color: 0xf4f0df }));
  moon.addChild(new Graphics().circle(-R * 0.32, -R * 0.22, R * 0.18).fill({ color: 0xe6e0c9, alpha: 0.55 }));
  moon.addChild(new Graphics().circle(R * 0.28, R * 0.12, R * 0.13).fill({ color: 0xe6e0c9, alpha: 0.45 }));
  moon.addChild(new Graphics().circle(R * 0.05, -R * 0.4, R * 0.09).fill({ color: 0xe6e0c9, alpha: 0.4 }));
  container.addChild(moon);

  // Stars — scattered across the upper sky, gently twinkling.
  const stars: { g: Graphics; base: number; phase: number; speed: number }[] = [];
  for (let i = 0; i < 110; i++) {
    const r = 0.5 + Math.random() * 1.4;
    const g = new Graphics().circle(0, 0, r).fill({ color: 0xffffff });
    g.x = Math.random() * w;
    g.y = Math.random() * h * 0.62;
    const base = 0.25 + Math.random() * 0.5;
    g.alpha = base;
    container.addChild(g);
    stars.push({ g, base, phase: Math.random() * Math.PI * 2, speed: 0.001 + Math.random() * 0.003 });
  }

  // Fireflies — a few warm motes drifting near the ground (the summer touch).
  const flies: { g: Container; x: number; y: number; phase: number; sx: number; sy: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const g = new Container();
    g.addChild(new Graphics().circle(0, 0, 4).fill({ color: 0xfff1a0, alpha: 0.22 }));
    g.addChild(new Graphics().circle(0, 0, 1.5).fill({ color: 0xfff6c8 }));
    const x = Math.random() * w;
    const y = h * (0.6 + Math.random() * 0.36);
    g.x = x; g.y = y;
    container.addChild(g);
    flies.push({ g, x, y, phase: Math.random() * Math.PI * 2, sx: 6 + Math.random() * 8, sy: 4 + Math.random() * 6 });
  }

  return {
    container,
    update(dtMs, vw, vh) {
      t += dtMs;
      moon.x = vw * 0.72;
      moon.y = vh * 0.2;
      const breathe = 1 + Math.sin(t * 0.0008) * 0.02;
      moon.scale.set(breathe);
      for (const s of stars) s.g.alpha = s.base + Math.sin(t * s.speed + s.phase) * 0.35 * s.base;
      for (const f of flies) {
        f.phase += dtMs * 0.0012;
        f.g.x = f.x + Math.sin(f.phase) * f.sx;
        f.g.y = f.y + Math.cos(f.phase * 0.7) * f.sy;
        f.g.alpha = 0.55 + Math.sin(f.phase * 1.6) * 0.45;
      }
    },
  };
}

// --- registry -----------------------------------------------------------------

export const ROOMS: Room[] = [
  { id: "white", name: "white room", background: whiteBackground, tuning: WHITE_TUNING },
  { id: "moon", name: "summer moon", background: nightBackground, tuning: MOON_TUNING, createScene: createMoonScene },
];

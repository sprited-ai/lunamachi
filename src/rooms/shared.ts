// Shared procedural scene generators — the no-asset building blocks rooms
// compose. Each adds its visuals to a container and returns a per-frame updater.
// (See PRINCIPLES.md: every prop is generated in code.)

import { Container, Graphics } from "pixi.js";
import type { SceneUpdate } from "./types";

/** A soft glowing moon high in the sky, gently breathing. */
export function addMoon(
  container: Container,
  w: number,
  h: number,
  fx = 0.72,
  fy = 0.2,
): SceneUpdate {
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

  let t = 0;
  return (dtMs, vw, vh) => {
    t += dtMs;
    moon.x = vw * fx;
    moon.y = vh * fy;
    moon.scale.set(1 + Math.sin(t * 0.0008) * 0.02);
  };
}

/** Scattered stars across the upper sky, gently twinkling. */
export function addStarField(container: Container, w: number, h: number, count: number): SceneUpdate {
  const stars: { g: Graphics; base: number; phase: number; speed: number }[] = [];
  for (let i = 0; i < count; i++) {
    const g = new Graphics().circle(0, 0, 0.5 + Math.random() * 1.4).fill({ color: 0xffffff });
    g.x = Math.random() * w;
    g.y = Math.random() * h * 0.62;
    const base = 0.25 + Math.random() * 0.5;
    g.alpha = base;
    container.addChild(g);
    stars.push({ g, base, phase: Math.random() * Math.PI * 2, speed: 0.001 + Math.random() * 0.003 });
  }
  let t = 0;
  return (dtMs) => {
    t += dtMs;
    for (const s of stars) s.g.alpha = s.base + Math.sin(t * s.speed + s.phase) * 0.35 * s.base;
  };
}

export interface FireflyOptions {
  /** vertical band (fraction of room height) the motes drift within */
  band?: [number, number];
  color?: number; // mote core colour
  glow?: number; // halo radius (px)
}

/** Warm motes drifting and pulsing — the firefly effect. */
export function addFireflies(
  container: Container,
  w: number,
  h: number,
  count: number,
  opts: FireflyOptions = {},
): SceneUpdate {
  const [b0, b1] = opts.band ?? [0.6, 0.96];
  const color = opts.color ?? 0xfff6c8;
  const glow = opts.glow ?? 4;
  const flies: { g: Container; x: number; y: number; phase: number; sx: number; sy: number }[] = [];
  for (let i = 0; i < count; i++) {
    const g = new Container();
    g.addChild(new Graphics().circle(0, 0, glow).fill({ color: 0xfff1a0, alpha: 0.22 }));
    g.addChild(new Graphics().circle(0, 0, 1.5).fill({ color }));
    g.x = Math.random() * w;
    g.y = h * (b0 + Math.random() * (b1 - b0));
    container.addChild(g);
    flies.push({
      g, x: g.x, y: g.y, phase: Math.random() * Math.PI * 2,
      sx: 6 + Math.random() * 10, sy: 4 + Math.random() * 8,
    });
  }
  return (dtMs) => {
    for (const f of flies) {
      f.phase += dtMs * 0.0012;
      f.g.x = f.x + Math.sin(f.phase) * f.sx;
      f.g.y = f.y + Math.cos(f.phase * 0.7) * f.sy;
      f.g.alpha = 0.55 + Math.sin(f.phase * 1.6) * 0.45;
    }
  };
}

/** Combine several scene-element updaters into one Scene's update. */
export function combine(updates: SceneUpdate[]): SceneUpdate {
  return (dtMs, w, h) => {
    for (const u of updates) u(dtMs, w, h);
  };
}

// <Particles> — a generic, data-driven particle system. The first step toward
// "components as data": instead of a new code file per ambient prop, a whole
// family (snow, rain, fireflies, dust, embers, stars…) is THIS one component with
// different attributes. New particle props become DATA, not code — safe to
// generate and (one day) editable live. Code-gen stays the escape hatch for the
// shapes a particle system can't express (the moon, the magic circle).
//
// The bespoke particle props reduce to a Particles config, e.g.:
//   snow      <Particles count="90"  shape="glow" motion="fall"  sway="14"/>
//   rain      <Particles count="120" shape="line" motion="fall"  tilt="0.18" speed="0.9"/>
//   fireflies <Particles count="40"  shape="glow" motion="drift" glow="5" color="#fff7c0"/>
//   stars     <Particles count="80"  shape="dot"  motion="still" twinkle="0.35" band="0,0.6"/>
//   embers    <Particles count="30"  shape="glow" motion="rise"  color="#ffb070"/>
//
// rng is owned by the engine: setup uses the room's shared seeded stream
// (deterministic layout); a private sub-stream drives runtime respawns, so the
// shared stream is never consumed per-frame (the room stays reproducible).

import { Container, Graphics } from "pixi.js";
import type { RoomComponent, Prop, SceneUpdate } from "../types";
import { mulberry32 } from "../shared";
import { attr, int, opt, num, hex, pair } from "../coerce";

type Shape = "dot" | "glow" | "line";
type Motion = "fall" | "rise" | "drift" | "still";

interface ParticlesProp extends Prop {
  type: "particles";
  count: number;
  shape: Shape;
  motion: Motion;
  size: number; // dot/glow radius, or line thickness (px)
  length: number; // line streak length (px)
  glow: number; // glow halo radius (px)
  color: number;
  band: [number, number]; // vertical spawn band, fraction of height
  speed: number; // base speed factor (fall/rise/drift)
  tilt: number; // horizontal lean for fall/rise (fraction)
  sway: number; // horizontal sine sway amplitude (px)
  twinkle: number; // alpha pulse amount (0 = steady)
  depth: boolean; // vary size / alpha / speed by a random near-far depth
}

const MARGIN = 16; // off-band respawn margin (px), avoids per-frame getBounds

function enumOpt<T extends string>(el: Element, name: string, allow: readonly T[], def: T): T {
  const v = el.getAttribute(name);
  return v !== null && (allow as readonly string[]).includes(v) ? (v as T) : def;
}

const Particles: RoomComponent = {
  tag: "Particles",
  type: "particles",
  parse: (el): ParticlesProp => ({
    type: "particles",
    count: int(attr(el, "count")),
    shape: enumOpt(el, "shape", ["dot", "glow", "line"] as const, "dot"),
    motion: enumOpt(el, "motion", ["fall", "rise", "drift", "still"] as const, "still"),
    size: opt(el, "size", num, 1.4),
    length: opt(el, "length", num, 12),
    glow: opt(el, "glow", num, 4),
    color: opt(el, "color", hex, 0xffffff),
    band: opt(el, "band", pair, [0, 1]),
    speed: opt(el, "speed", num, 0.4),
    tilt: opt(el, "tilt", num, 0),
    sway: opt(el, "sway", num, 0),
    twinkle: opt(el, "twinkle", num, 0),
    depth: opt(el, "depth", (s) => s !== "false", true),
  }),
  mount: (prop, { container, w, h, rng }): SceneUpdate => {
    const p = prop as ParticlesProp;
    const [b0, b1] = p.band;
    const layer = new Container();
    container.addChild(layer);

    interface Particle {
      g: Container;
      x: number;
      y: number;
      d: number; // depth 0 far .. 1 near
      phase: number;
      base: number; // base alpha
      sway: number;
    }
    const items: Particle[] = [];

    for (let i = 0; i < p.count; i++) {
      const d = p.depth ? rng() : 0.6;
      const s = p.depth ? 0.5 + d : 1; // size/length scale
      const g = new Container();
      if (p.shape === "line") {
        const len = p.length * s;
        g.addChild(
          new Graphics()
            .moveTo(0, 0)
            .lineTo(-p.tilt * len, len)
            .stroke({ color: p.color, width: Math.max(0.4, p.size * s), alpha: 1 }),
        );
      } else if (p.shape === "glow") {
        g.addChild(new Graphics().circle(0, 0, p.glow * s).fill({ color: p.color, alpha: 0.14 }));
        g.addChild(new Graphics().circle(0, 0, Math.max(0.6, p.size * s)).fill({ color: p.color }));
      } else {
        g.addChild(new Graphics().circle(0, 0, Math.max(0.4, p.size * s)).fill({ color: p.color }));
      }
      const x = rng() * w;
      const y = (b0 + rng() * (b1 - b0)) * h;
      g.x = x;
      g.y = y;
      layer.addChild(g);
      items.push({
        g, x, y, d,
        phase: rng() * Math.PI * 2,
        base: p.depth ? 0.4 + d * 0.5 : 0.8,
        sway: p.sway * (p.depth ? 0.6 + d * 0.6 : 1),
      });
    }

    const reRng = mulberry32((rng() * 0x100000000) >>> 0); // private respawn stream
    const FALL = 0.06; // px per (speed · depthScale · ms)
    let t = 0;

    return (dtMs, vw, vh) => {
      t += dtMs;
      for (const it of items) {
        const ds = p.depth ? 0.5 + it.d : 1;
        it.phase += dtMs * 0.0012;

        if (p.motion === "fall" || p.motion === "rise") {
          const dy = p.speed * ds * dtMs * FALL * (p.motion === "rise" ? -1 : 1);
          it.y += dy;
          it.x -= dy * p.tilt;
          const top = b0 * vh - MARGIN;
          const bot = b1 * vh + MARGIN;
          if (p.motion === "fall" && it.y > bot) { it.y = top; it.x = reRng() * vw; }
          else if (p.motion === "rise" && it.y < top) { it.y = bot; it.x = reRng() * vw; }
          if (it.x < -MARGIN) it.x += vw + MARGIN * 2;
          else if (it.x > vw + MARGIN) it.x -= vw + MARGIN * 2;
          it.g.x = it.x + Math.sin(it.phase) * it.sway;
          it.g.y = it.y;
        } else if (p.motion === "drift") {
          it.g.x = it.x + Math.sin(it.phase) * (it.sway || 8);
          it.g.y = it.y + Math.cos(it.phase * 0.7) * (it.sway || 6) * 0.6;
        }
        // "still": stays at its spawn point; only twinkles

        if (p.twinkle > 0) {
          it.g.alpha = Math.min(1, it.base * (1 + Math.sin(t * 0.002 + it.phase) * p.twinkle));
        } else if (p.motion === "drift") {
          it.g.alpha = Math.min(1, it.base + Math.sin(it.phase * 1.6) * 0.35 * it.base);
        } else {
          it.g.alpha = it.base;
        }
      }
    };
  },
  example: { type: "particles", count: 50, shape: "glow", motion: "drift", glow: 4, sway: 10 } as ParticlesProp,
};

export default Particles;

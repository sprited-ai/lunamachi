// A diegetic way to travel between rooms: an intricate magic circle laid on the
// floor (perspective-flattened). Click it to step through to another room — no
// buttons, no chrome. The beings (non-interactive) render over it.
//
// Fully procedural (see PRINCIPLES.md) — concentric rings, tick rings, a ring of
// generated runes, and nested star polygons (sacred-geometry), drawn in code and
// spun in counter-rotating layers. No art assets.

import { Container, Ellipse, Graphics } from "pixi.js";

const R = 70;
const FLATTEN = 0.42; // squash to sit on the ground

// Small rune glyphs (local segments in a ~±5 box) — varied, deterministic by index.
const RUNES: number[][][] = [
  [[0, -5, 0, 5], [-3, -2, 3, -2]],
  [[-3, -5, -3, 5], [-3, -5, 3, -1], [-3, 0, 2, 4]],
  [[0, -5, -3, 0], [0, -5, 3, 0], [-3, 0, 3, 0]],
  [[-3, -5, 3, -5], [0, -5, 0, 5], [-3, 5, 3, 5]],
  [[-3, 5, 0, -5], [0, -5, 3, 5], [-2, 1, 2, 1]],
  [[-3, -4, 3, -4], [3, -4, -3, 4], [-3, 4, 3, 4]],
  [[0, -5, 0, 5], [-3, -3, 0, 0], [3, -3, 0, 0], [-3, 3, 0, 0], [3, 3, 0, 0]],
  [[-3, -5, -3, 5], [3, -5, 3, 5], [-3, 0, 3, 0]],
];

export interface Portal {
  container: Container;
  setColor(color: number): void;
  update(dtMs: number, w: number, h: number, fx: number, fy: number): void;
}

function ring(g: Graphics, radius: number) {
  g.circle(0, 0, radius);
}

function ticks(g: Graphics, radius: number, n: number, len: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    g.moveTo(c * (radius - len), s * (radius - len)).lineTo(c * radius, s * radius);
  }
}

function star(g: Graphics, n: number, step: number, radius: number) {
  const pts: [number, number][] = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i];
    const [qx, qy] = pts[(i + step) % n];
    g.moveTo(px, py).lineTo(qx, qy);
  }
}

function runeRing(g: Graphics, radius: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cx = Math.cos(a) * radius;
    const cy = Math.sin(a) * radius;
    const rot = a + Math.PI / 2; // orient outward
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const glyph = RUNES[i % RUNES.length];
    for (const [x1, y1, x2, y2] of glyph) {
      g.moveTo(cx + x1 * cr - y1 * sr, cy + x1 * sr + y1 * cr)
        .lineTo(cx + x2 * cr - y2 * sr, cy + x2 * sr + y2 * cr);
    }
  }
}

function nodes(g: Graphics, radius: number, n: number, dot: number) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    g.circle(Math.cos(a) * radius, Math.sin(a) * radius, dot);
  }
}

export function createPortal(onEnter: () => void): Portal {
  const root = new Container();
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = new Ellipse(0, 0, R, R);
  root.scale.set(1, FLATTEN);

  const ground = new Graphics().circle(0, 0, R * 1.06).fill({ color: 0x2a3344, alpha: 0.06 });
  const glow = new Graphics();
  const g1 = new Graphics(); // outer: rings + ticks + runes  (spins CW slow)
  const g2 = new Graphics(); // mid: nested star polygons     (spins CCW)
  const g3 = new Graphics(); // inner: rings + center sigil    (spins CW)
  root.addChild(ground, glow, g1, g2, g3);

  let color = 0x9fd0ff;

  function redraw() {
    // --- outer layer ---
    g1.clear();
    ring(g1, R);
    ring(g1, R * 0.93);
    g1.stroke({ width: 2.5, color, alpha: 0.95 });
    ticks(g1, R * 0.88, 72, 4);
    g1.stroke({ width: 1, color, alpha: 0.5 });
    ticks(g1, R * 0.88, 12, 8);
    g1.stroke({ width: 2, color, alpha: 0.8 });
    runeRing(g1, R * 0.74, 12);
    g1.stroke({ width: 1.5, color, alpha: 0.9 });
    nodes(g1, R * 0.93, 12, 1.6);
    g1.fill({ color, alpha: 0.85 });

    // --- middle star polygons ---
    g2.clear();
    ring(g2, R * 0.62);
    g2.stroke({ width: 1.5, color, alpha: 0.55 });
    star(g2, 12, 5, R * 0.62); // {12/5}
    g2.stroke({ width: 1.3, color, alpha: 0.7 });
    star(g2, 7, 3, R * 0.44); // heptagram {7/3}
    g2.stroke({ width: 1.3, color, alpha: 0.85 });

    // --- inner sigil ---
    g3.clear();
    ring(g3, R * 0.3);
    ring(g3, R * 0.18);
    g3.stroke({ width: 1.5, color, alpha: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g3.moveTo(0, 0).lineTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    }
    g3.stroke({ width: 1, color, alpha: 0.6 });
    g3.circle(0, 0, R * 0.05).fill({ color, alpha: 0.9 });
  }
  redraw();

  root.on("pointertap", onEnter);
  let hover = false;
  root.on("pointerover", () => { hover = true; });
  root.on("pointerout", () => { hover = false; });

  let t = 0;
  return {
    container: root,
    setColor(c: number) { color = c; redraw(); },
    update(dtMs, _w, _h, fx, fy) {
      t += dtMs;
      g1.rotation += dtMs * 0.00028;
      g2.rotation -= dtMs * 0.00045;
      g3.rotation += dtMs * 0.0007;
      const pulse = 0.7 + Math.sin(t * 0.003) * 0.3;
      glow.clear();
      glow.circle(0, 0, R * 0.98).fill({ color, alpha: (hover ? 0.26 : 0.16) * pulse });
      glow.circle(0, 0, R * 0.42).fill({ color, alpha: (hover ? 0.55 : 0.38) * pulse });
      const k = hover ? 1.08 : 1;
      root.scale.set(k, FLATTEN * k);
      root.x = fx;
      root.y = fy;
    },
  };
}

// A diegetic way to travel between rooms: a glowing magic circle laid on the
// floor (flattened in perspective). Click it to step through to another room —
// no buttons, no chrome. The beings (non-interactive) render over it, so it
// reads as something painted on the ground that they wander across.

import { Container, Ellipse, Graphics } from "pixi.js";

const R = 66;
const FLATTEN = 0.42; // squash to sit on the ground

export interface Portal {
  container: Container;
  setColor(color: number): void;
  update(dtMs: number, w: number, h: number, fx: number, fy: number): void;
}

export function createPortal(onEnter: () => void): Portal {
  const root = new Container();
  root.eventMode = "static";
  root.cursor = "pointer";
  root.hitArea = new Ellipse(0, 0, R, R);
  root.scale.set(1, FLATTEN);

  // Faint dark grounding so the circle reads on a bright floor too (untinted).
  const ground = new Graphics().circle(0, 0, R * 1.04).fill({ color: 0x2a3344, alpha: 0.06 });

  const rings = new Graphics(); // concentric rings + ticks, recolored by setColor
  const runeA = new Container();
  const runeB = new Container();
  const glow = new Graphics();
  root.addChild(ground, glow, rings, runeA, runeB);

  let color = 0x9fd0ff;

  function drawRunes(g: Graphics, radius: number, n: number, len: number) {
    g.clear();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      g.moveTo(c * (radius - len), s * (radius - len)).lineTo(c * radius, s * radius);
    }
    g.stroke({ width: 2.5, color, alpha: 1 });
  }

  function redraw() {
    rings.clear();
    rings.circle(0, 0, R).stroke({ width: 3, color, alpha: 0.95 });
    rings.circle(0, 0, R * 0.7).stroke({ width: 2, color, alpha: 0.7 });
    rings.circle(0, 0, R * 0.34).stroke({ width: 2, color, alpha: 0.8 });
    runeA.removeChildren();
    runeB.removeChildren();
    const ga = new Graphics();
    drawRunes(ga, R * 0.86, 16, 7);
    runeA.addChild(ga);
    const gb = new Graphics();
    drawRunes(gb, R * 0.52, 8, 9);
    runeB.addChild(gb);
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
      runeA.rotation += dtMs * 0.0004;
      runeB.rotation -= dtMs * 0.0006;
      const pulse = 0.5 + Math.sin(t * 0.003) * 0.18;
      glow.clear();
      glow.circle(0, 0, R * 0.95).fill({ color, alpha: (hover ? 0.3 : 0.2) * (0.7 + pulse * 0.6) });
      glow.circle(0, 0, R * 0.45).fill({ color, alpha: (hover ? 0.6 : 0.42) * (0.7 + pulse * 0.6) });
      const k = hover ? 1.1 : 1;
      root.scale.set(k, FLATTEN * k);
      root.x = fx;
      root.y = fy;
    },
  };
}

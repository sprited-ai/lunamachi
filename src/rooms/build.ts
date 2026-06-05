// buildRoom: a typed RoomSpec → a live Room (what main.tsx consumes).
//
// The spec is pure data; this is the engine that renders it. The backdrop comes
// from the named generator, the scene is each mountable component composed under
// one deterministic seed, and tuning passes straight through to the live config.

import { Container } from "pixi.js";
import type { Room, RoomSpec, Scene, SceneUpdate } from "./types";
import { byType } from "./components";
import { combine, mulberry32 } from "./shared";
import { BACKGROUNDS } from "./backgrounds";

export function buildRoom(spec: RoomSpec): Room {
  const bg = BACKGROUNDS[spec.background];
  if (!bg) throw new Error(`<Room id="${spec.id}"> unknown background "${spec.background}"`);

  const mountable = spec.props.filter((p) => byType.get(p.type)?.mount);

  return {
    id: spec.id,
    name: spec.name,
    vibe: spec.vibe,
    accent: spec.accent,
    background: () => bg(spec.palette),
    tuning: spec.tuning,
    createScene: mountable.length
      ? (w, h) => {
          const container = new Container();
          container.label = `scene:${spec.id}`;
          const rng = mulberry32(spec.seed); // one stream → reproducible layout
          const ctx = { container, w, h, rng };
          const updates: SceneUpdate[] = mountable.map(
            (prop) => byType.get(prop.type)!.mount!(prop, ctx),
          );
          return { container, update: combine(updates) } satisfies Scene;
        }
      : undefined,
  };
}

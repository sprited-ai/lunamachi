// A room is one self-contained module (its own file, or folder once it grows).
// That module is the single source of truth for everything the room is: its
// backdrop, its procedural ambient scene, its behaviour tuning, its accent.
// src/rooms/index.ts is the source of truth for which rooms exist (and order).

import type { Container } from "pixi.js";
import type { Config } from "../config";

/** A per-frame updater for a procedural scene element. */
export type SceneUpdate = (dtMs: number, w: number, h: number) => void;

export interface Scene {
  container: Container;
  update: SceneUpdate;
}

export interface Room {
  id: string;
  name: string;
  /** accent colour (tints the portal that travels here) */
  accent: number;
  /** body CSS background for this room */
  background: () => string;
  /** behaviour tweaks merged into cfg on enter (incl. this room's population) */
  tuning: Partial<Config>;
  /** optional procedural ambient scene drawn behind the beings */
  createScene?: (w: number, h: number) => Scene;
}

// The room model's vocabulary.
//
// A room is authored as XML (its source of truth), parsed into a typed RoomSpec
// — the room's full *parameter space*. buildRoom() turns a spec into a live Room.
// Changing the spec = changing the room. The seed lives here (deterministic
// procedural layer), not in any generator. Schema grows one prop at a time.

import type { Container } from "pixi.js";
import type { Config } from "../config";

export type SceneUpdate = (dtMs: number, w: number, h: number) => void;

export interface Scene {
  container: Container;
  update: SceneUpdate;
}

/** Semantic colours (hex numbers) a room's backdrop is built from. */
export interface Palette {
  skyTop: number;
  skyMid?: number;
  horizon: number;
  ground: number;
}

/** The bounded prop vocabulary a room composes. Grows one entry at a time.
 *  v0: magic-circle (the portal) + ambient moon / starField / fireflies. */
export type Prop =
  | { type: "magic-circle" }
  | { type: "moon"; at: [number, number] }
  | { type: "starField"; count: number }
  | { type: "fireflies"; count: number; band: [number, number]; glow?: number; color?: number };

/** The parsed, validated room — the room model's parameter space. */
export interface RoomSpec {
  id: string;
  name: string;
  vibe: string;
  /** seeds the deterministic procedural layer (placement); same seed → same room */
  seed: number;
  accent: number;
  palette: Palette;
  /** named backdrop generator (see backgrounds.ts) */
  background: string;
  props: Prop[];
  tuning: Partial<Config>;
}

/** What main.tsx consumes — produced by buildRoom(spec). */
export interface Room {
  id: string;
  name: string;
  vibe: string;
  accent: number;
  background: () => string;
  tuning: Partial<Config>;
  createScene?: (w: number, h: number) => Scene;
}

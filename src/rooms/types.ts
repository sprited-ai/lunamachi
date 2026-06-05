// The room model's vocabulary.
//
// A room is authored as XML (its source of truth), parsed into a typed RoomSpec
// — the room's full *parameter space*. buildRoom() turns a spec into a live Room.
// Changing the spec = changing the room. The seed lives here (deterministic
// procedural layer), not in any generator.
//
// Components are an OPEN set: each lives in its own file under components/ and
// self-registers, so the vocabulary can grow (by hand or by the gen flow) without
// editing any shared type. Hence `Prop` is an open base, not a closed union.

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

/** An in-world prop instance, as parsed from its tag. Open by design: each
 *  component defines its own shape extending this (discriminated by `type`). */
export interface Prop {
  type: string;
}

/** What a component gets to draw into when it mounts. `rng` is the room's seeded
 *  stream — use it for all randomness so the layout is reproducible. */
export interface MountCtx {
  container: Container;
  w: number;
  h: number;
  rng: () => number;
}

/** A self-contained room component — like a React component: owns its tag, how
 *  to parse its attributes, and (for visual props) how to mount into the scene. */
export interface RoomComponent {
  /** PascalCase XML tag, e.g. "Moon" */
  tag: string;
  /** the prop discriminant this component produces, e.g. "moon" */
  type: string;
  /** parse this element's attributes into a typed prop */
  parse(el: Element): Prop;
  /** draw into the scene container; omitted for non-visual / engine-handled props */
  mount?(prop: Prop, ctx: MountCtx): SceneUpdate;
  /** a representative prop for the debug page to showcase this component with */
  example?: Prop;
}

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

// The room registry: which rooms exist, and their order (the portal cycles
// through them). Adding a room = create its module + add one line here.

import type { Room } from "./types";
import { white } from "./white";
import { moon } from "./moon";
import { fireflies } from "./fireflies";

export type { Room, Scene, SceneUpdate } from "./types";

export const ROOMS: Room[] = [white, moon, fireflies];

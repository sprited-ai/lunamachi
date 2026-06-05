// The room registry: which rooms exist, and their order (the portal cycles
// through them). Each room is authored as XML — its source of truth — parsed
// into a RoomSpec and built into a live Room at load. Adding a room = drop a
// *.room.xml beside these and add one import + one array entry.

import type { Room } from "./types";
import { parseRoom } from "./parse";
import { buildRoom } from "./build";
import whiteXml from "./white.room.xml?raw";
import moonXml from "./moon.room.xml?raw";
import firefliesXml from "./fireflies.room.xml?raw";

export type { Room, Scene, SceneUpdate } from "./types";

export const ROOMS: Room[] = [whiteXml, moonXml, firefliesXml].map((xml) =>
  buildRoom(parseRoom(xml)),
);

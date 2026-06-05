// The room registry, manifest-driven. Every room is an XML file in this folder;
// rooms.manifest.json lists which rooms exist and their order (the portal cycles
// through them). Adding a room = drop <id>.room.xml here and add its id to the
// manifest — no code change. The XML is each room's source of truth.

import type { Room } from "./types";
import { parseRoom } from "./parse";
import { buildRoom } from "./build";
import manifest from "./rooms.manifest.json";

export type { Room, Scene, SceneUpdate } from "./types";

// All *.room.xml in this folder, loaded as raw strings and indexed by path.
const files = import.meta.glob<string>("./*.room.xml", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const ROOMS: Room[] = manifest.map((id) => {
  const xml = files[`./${id}.room.xml`];
  if (!xml) throw new Error(`room "${id}" is in the manifest but ./${id}.room.xml is missing`);
  return buildRoom(parseRoom(xml));
});

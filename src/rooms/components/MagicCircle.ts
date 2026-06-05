// <MagicCircle/> — the portal. Declared per-room so a room states "I have a way
// out"; the engine (main) owns its placement, nav and interactivity. No mount()
// — it is not a scene-container prop.

import type { RoomComponent } from "../types";

const MagicCircle: RoomComponent = {
  tag: "MagicCircle",
  type: "magic-circle",
  parse: () => ({ type: "magic-circle" }),
};

export default MagicCircle;

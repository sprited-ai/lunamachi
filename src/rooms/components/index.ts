// The component registry. Every *.ts in this folder that default-exports a
// RoomComponent is auto-collected here — so adding a component (by hand or via
// the gen flow) is just dropping a file beside these. No edit to any shared list.

import type { RoomComponent } from "../types";

const modules = import.meta.glob<{ default: RoomComponent }>("./*.ts", { eager: true });

export const COMPONENTS: RoomComponent[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith("/index.ts"))
  .map(([, mod]) => mod.default);

export const byTag = new Map(COMPONENTS.map((c) => [c.tag, c]));
export const byType = new Map(COMPONENTS.map((c) => [c.type, c]));

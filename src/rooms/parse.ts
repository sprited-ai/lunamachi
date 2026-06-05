// parseRoom: a room's XML → a typed, validated RoomSpec.
//
// <Room> carries metadata (id/name/accent/seed) and holds children: a few
// structural tags (Vibe / Palette / Background / Tuning) plus any number of
// component tags (Moon, StarField, …) resolved through the component registry.
// Built-in DOMParser, so this runs in the browser with no dependency.

import type { Config } from "../config";
import type { Palette, Prop, RoomSpec } from "./types";
import { byTag } from "./components";
import { hex, num, int, attr, hashSeed } from "./coerce";

const TUNING_NUM = [
  "population", "height", "minHeight", "maxHeight",
  "floorTop", "floorBottom", "shadow", "speed",
  "poseChance", "greetChance", "horizon",
] as const;

function parsePalette(el: Element): Palette {
  return {
    skyTop: hex(attr(el, "skyTop")),
    skyMid: el.hasAttribute("skyMid") ? hex(attr(el, "skyMid")) : undefined,
    horizon: hex(attr(el, "horizon")),
    ground: hex(attr(el, "ground")),
  };
}

function parseTuning(el: Element): Partial<Config> {
  const t: Partial<Config> = {};
  for (const k of TUNING_NUM) {
    const v = el.getAttribute(k);
    if (v !== null) (t as Record<string, number>)[k] = num(v);
  }
  if (el.hasAttribute("uniformSize")) t.uniformSize = el.getAttribute("uniformSize") === "true";
  return t;
}

export function parseRoom(xml: string): RoomSpec {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const perr = doc.querySelector("parsererror");
  if (perr) throw new Error(`room XML parse error: ${perr.textContent?.trim()}`);

  const root = doc.documentElement;
  if (root.tagName !== "Room") throw new Error(`root must be <Room>, got <${root.tagName}>`);

  const id = attr(root, "id");
  const name = root.getAttribute("name") ?? id;
  const accent = hex(attr(root, "accent"));
  const seed = root.hasAttribute("seed") ? int(attr(root, "seed")) : hashSeed(id);

  let vibe = "";
  let palette: Palette | undefined;
  let background = "skyFloor";
  let tuning: Partial<Config> = {};
  const props: Prop[] = [];

  for (const el of Array.from(root.children)) {
    switch (el.tagName) {
      case "Vibe": vibe = (el.textContent ?? "").trim(); break;
      case "Palette": palette = parsePalette(el); break;
      case "Background": background = attr(el, "type"); break;
      case "Tuning": tuning = parseTuning(el); break;
      default: {
        const comp = byTag.get(el.tagName);
        if (!comp) throw new Error(`<Room id="${id}"> unknown element <${el.tagName}>`);
        props.push(comp.parse(el));
      }
    }
  }

  if (!palette) throw new Error(`<Room id="${id}"> missing <Palette>`);
  return { id, name, vibe, seed, accent, palette, background, props, tuning };
}

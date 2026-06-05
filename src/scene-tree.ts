// A tiny live Pixi scene-tree inspector — shared by the /debug.html harness and
// the in-app Tab HUD. Walks a display tree into indented text with each node's
// live properties (x / y / alpha / scale / rotation), so you can read what's on
// the stage as it animates.

import type { Container } from "pixi.js";

/** One-line summary of a display node's live transform/visibility. */
export function describe(node: Container): string {
  const name = node.label || node.constructor?.name || "Object";
  const bits = [`x${node.x | 0} y${node.y | 0}`, `α${(node.alpha ?? 1).toFixed(2)}`];
  const s = node.scale?.x ?? 1;
  if (Math.abs(s - 1) > 0.001) bits.push(`s${s.toFixed(2)}`);
  if (node.rotation) bits.push(`r${node.rotation.toFixed(2)}`);
  if (node.visible === false) bits.push("hidden");
  return `${name}  ${bits.join("  ")}`;
}

export interface TreeOpts {
  /** stop after this many rows (then append "…") */
  maxRows?: number;
  /** don't expand a node with more than this many children (show "·N ⊘") —
   *  keeps a busy live room readable (the 120-being crowd stays one line) */
  collapseOver?: number;
}

export function buildTree(roots: Container[], opts: TreeOpts = {}): string {
  const { maxRows = 240, collapseOver = Infinity } = opts;
  const rows: string[] = [];
  let count = 0;

  const walk = (node: Container, depth: number) => {
    if (count >= maxRows) return;
    count++;
    const kids = node.children as Container[];
    const collapsed = kids.length > collapseOver;
    const indent = "  ".repeat(depth);
    const lead = kids.length ? "▸ " : "· ";
    const tail = kids.length ? `  ·${kids.length}${collapsed ? " ⊘" : ""}` : "";
    rows.push(`${indent}${lead}${describe(node)}${tail}`);
    if (collapsed) return;
    for (const k of kids) {
      if (count >= maxRows) {
        rows.push(`${"  ".repeat(depth + 1)}…`);
        break;
      }
      walk(k, depth + 1);
    }
  };

  for (const r of roots) walk(r, 0);
  return rows.join("\n") || "(empty)";
}

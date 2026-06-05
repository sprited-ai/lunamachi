// The editor Hierarchy — an interactive view of the live Pixi tree. Rows expand
// and collapse; clicking a row selects that object (the canvas pick and this tree
// share one selection, so they highlight each other, Unity-style). Roots are open
// by default (so the room's beings list under `world`); deeper nodes open on click.

import { useEffect, useState } from "react";
import type { Container } from "pixi.js";
import { describe } from "./scene-tree";

const MAX_ROWS = 500;

export function Hierarchy({
  getRoots,
  selectedUid,
  onSelect,
}: {
  getRoots: () => Container[];
  selectedUid: number | null;
  onSelect: (c: Container) => void;
}) {
  const [, tick] = useState(0);
  // roots: open unless in `closedRoots`; deeper nodes: closed unless in `openDeep`
  const [closedRoots, setClosedRoots] = useState<Set<number>>(() => new Set());
  const [openDeep, setOpenDeep] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 350); // live transforms
    return () => clearInterval(id);
  }, []);

  const isOpen = (node: Container, depth: number) =>
    depth === 0 ? !closedRoots.has(node.uid) : openDeep.has(node.uid);

  const toggle = (node: Container, depth: number) => {
    const setter = depth === 0 ? setClosedRoots : setOpenDeep;
    setter((s) => {
      const n = new Set(s);
      n.has(node.uid) ? n.delete(node.uid) : n.add(node.uid);
      return n;
    });
  };

  const rows: { node: Container; depth: number; kids: number }[] = [];
  let count = 0;
  const walk = (node: Container, depth: number) => {
    if (count >= MAX_ROWS) return;
    count++;
    const kids = (node.children as Container[]).length;
    rows.push({ node, depth, kids });
    if (kids && isOpen(node, depth)) for (const k of node.children as Container[]) walk(k, depth + 1);
  };
  for (const r of getRoots()) walk(r, 0);

  return (
    <div className="dbg-tree">
      {rows.map(({ node, depth, kids }) => {
        const open = kids > 0 && isOpen(node, depth);
        return (
          <div
            key={node.uid}
            className={"dbg-row" + (node.uid === selectedUid ? " sel" : "")}
            style={{ paddingLeft: 6 + depth * 12 }}
            onClick={() => onSelect(node)}
          >
            <span
              className="tw"
              onClick={(e) => {
                if (kids) {
                  e.stopPropagation();
                  toggle(node, depth);
                }
              }}
            >
              {kids ? (open ? "▾" : "▸") : "·"}
            </span>
            <span className="nm">{describe(node)}</span>
            {kids ? <span className="ct">·{kids}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

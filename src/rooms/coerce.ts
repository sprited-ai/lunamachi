// Tiny attribute coercers for room XML. Everything in XML is a string; these
// turn it into the typed values a RoomSpec holds, and throw clear errors so a
// malformed room surfaces immediately at author time (not as a silent default).

/** "#rrggbb" | "#rgb" → 0xRRGGBB */
export function hex(s: string): number {
  let h = s.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad colour "${s}" (want #rrggbb)`);
  return parseInt(h, 16);
}

export function num(s: string): number {
  const n = Number(s.trim());
  if (!Number.isFinite(n)) throw new Error(`bad number "${s}"`);
  return n;
}

export function int(s: string): number {
  return Math.trunc(num(s));
}

/** "0.72,0.2" → [0.72, 0.2] */
export function pair(s: string): [number, number] {
  const parts = s.split(",").map((p) => num(p));
  if (parts.length !== 2) throw new Error(`bad pair "${s}" (want "a,b")`);
  return [parts[0], parts[1]];
}

/** Required attribute, or a clear error naming the element. */
export function attr(el: Element, name: string): string {
  const v = el.getAttribute(name);
  if (v === null) throw new Error(`<${el.tagName}> missing required "${name}"`);
  return v;
}

/** Optional attribute, coerced through `f` if present, else `fallback`. */
export function opt<T>(el: Element, name: string, f: (s: string) => T, fallback: T): T {
  const v = el.getAttribute(name);
  return v === null ? fallback : f(v);
}

/** A stable seed derived from a string (FNV-1a), for rooms that omit seed=. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

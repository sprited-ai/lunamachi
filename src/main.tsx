// mini-beings — a soft white room (atmosphere from anima/v34) crowded with the
// generated characters as little autonomous beings. They wander a floor band,
// occasionally strike a static reference pose or greet, and greet on bump-ins.
// Press Tab for a debug HUD to tune size, perspective, floor, shadow, etc. live.

import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Application, Container, type Renderer } from "pixi.js";
import { OutlineFilter } from "pixi-filters";
import { Being } from "./being";
import { cfg } from "./config";
import { MusicPlayer } from "./player";
import { ROOMS, type Scene } from "./rooms";
import { createPortal, type Portal } from "./portal";
import { Hierarchy } from "./debug-hierarchy";
import { SummonChrome, runSummon, createMockClient, type SummonVariant, type SummonResult } from "./summon-prototype";
import { createRemoteClient } from "./sprite-dx-client";
import "./global.css";
import "./debug-editor.css";

const BEINGS_URL = "";
const ASSETS = `${BEINGS_URL}/beings`;
const GREET_DISTANCE = 24;

interface BeingMeta { id: string; seed: number | null; ref?: boolean }

/** Room index from the URL path (/<id>); defaults to the first room. */
function roomIndexFromPath(): number {
  const id = window.location.pathname.replace(/^\/+/, "").split("/")[0];
  const i = ROOMS.findIndex((r) => r.id === id);
  return i >= 0 ? i : 0;
}

const BEING_SEED = 1337;

// PROTOTYPE verdict: Seed Hatch (B) won — locked in, switcher removed.
const SUMMON_VARIANT: SummonVariant = "B";

// PROTOTYPE: summon is opt-in. Off by default — it isn't a real feature yet, so
// the ambient room stays clean; add ?summon (or ?summon=1) to reveal it, ?summon=0
// to force it off. Still DEV-gated at the call site so it can never ship.
function summonEnabled(): boolean {
  const v = new URLSearchParams(window.location.search).get("summon");
  return v !== null && v !== "0" && v !== "false";
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Give each room its own disjoint slice of the (shuffled) character pool, so
 *  every room is inhabited by a different cast. Within a room the cast is cycled
 *  to reach its population. */
function partitionByRoom(all: BeingMeta[], nRooms: number): BeingMeta[][] {
  const shuffled = seededShuffle(all, BEING_SEED);
  const per = Math.max(1, Math.floor(shuffled.length / nRooms));
  return Array.from({ length: nRooms }, (_, i) =>
    i === nRooms - 1 ? shuffled.slice(i * per) : shuffled.slice(i * per, (i + 1) * per),
  );
}

// Unity-style selection outline — an orange silhouette traced around the
// selected node's actual shape (not a bounding box).
const OUTLINE = new OutlineFilter({ thickness: 3, color: 0xffb030, alpha: 1, quality: 0.25 });

/** Alpha (0–255) of the rendered pixel under a stage-space point, for one node. */
function pixelAlpha(renderer: Renderer, node: Container, px: number, py: number): number {
  const r = node.getBounds();
  if (r.width <= 0 || r.height <= 0) return 0;
  try {
    const { pixels, width, height } = renderer.extract.pixels(node);
    const lx = Math.min(width - 1, Math.max(0, Math.floor(((px - r.x) / r.width) * width)));
    const ly = Math.min(height - 1, Math.max(0, Math.floor(((py - r.y) / r.height) * height)));
    return pixels[(ly * width + lx) * 4 + 3];
  } catch {
    return 255; // extract unavailable → treat the bounds hit as a hit
  }
}

/** The being under a stage-space point — frontmost (highest y) first, confirmed by
 *  the sprite's actual pixel alpha so transparent areas of a cell don't catch. */
function pickBeing(beings: Being[], px: number, py: number, renderer: Renderer): Being | null {
  const cands = beings
    .filter((b) => {
      const r = b.container.getBounds();
      return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
    })
    .sort((a, b) => b.y - a.y);
  for (const b of cands) if (pixelAlpha(renderer, b.container, px, py) > 60) return b;
  return null;
}

function Room() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [count, setCount] = useState(0);
  const [, force] = useState(0);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const beingsRef = useRef<Being[]>([]);
  const metaRef = useRef<BeingMeta[]>([]);
  const ownedRef = useRef<BeingMeta[][]>([]); // per-room character sets
  const respawnTokenRef = useRef(0);
  const roomIndexRef = useRef(0);
  const sceneRef = useRef<Scene | null>(null);
  const portalRef = useRef<Portal | null>(null);
  const [roomName, setRoomName] = useState(ROOMS[0].name);

  // editor: click-to-select. selectedRef = the picked display object (canvas pick
  // and hierarchy click share it); selection shows the Unity-style outline filter.
  const selectedRef = useRef<Container | null>(null);
  const showDebugRef = useRef(false);
  const [, setSelTick] = useState(0);

  // Move the outline filter onto the newly-selected node (off the previous one).
  const select = (node: Container | null) => {
    const prev = selectedRef.current;
    if (prev && prev !== node) prev.filters = [];
    selectedRef.current = node;
    if (node) node.filters = [OUTLINE];
    setSelTick((n) => n + 1);
  };

  // PROTOTYPE: summon is opt-in via ?summon (off by default). Manifestation is
  // locked to Seed Hatch; summonRef is a lazy summon fn the chrome calls.
  const [summonOn] = useState(summonEnabled);
  const variantRef = useRef<SummonVariant>(SUMMON_VARIANT);
  const summonRef = useRef<((p: string) => Promise<SummonResult>) | null>(null);

  const applyRoomBg = () => {
    const bg = ROOMS[roomIndexRef.current].background();
    document.body.style.background = bg;
    // the editor shrinks the canvas to a cell; paint the room gradient on the host
    // too so the transparent canvas shows the room (not a black viewport).
    if (hostRef.current) hostRef.current.style.background = bg;
  };

  // nav: how to reflect the room in the URL — 'push' (user click, new history
  // entry), 'replace' (canonicalize on load), 'none' (already navigated, e.g. back).
  function enterRoom(i: number, nav: "push" | "replace" | "none" = "push") {
    select(null); // the selected node may be torn down by the room swap / respawn
    roomIndexRef.current = i;
    const room = ROOMS[i];
    Object.assign(cfg, room.tuning); // includes population — each room has its own cast
    document.body.dataset.room = room.id; // lets CSS adapt overlay text to the mood
    applyRoomBg();
    const app = appRef.current;
    if (app) {
      if (sceneRef.current) {
        app.stage.removeChild(sceneRef.current.container);
        sceneRef.current.container.destroy({ children: true });
        sceneRef.current = null;
      }
      if (room.createScene) {
        const scene = room.createScene(app.renderer.width, app.renderer.height);
        app.stage.addChildAt(scene.container, 0); // behind the beings
        sceneRef.current = scene;
      }
    }
    const path = `/${room.id}${window.location.search}`; // keep ?variant= (prototype) across room nav
    if (nav === "push" && window.location.pathname !== `/${room.id}`) history.pushState({}, "", path);
    else if (nav === "replace") history.replaceState({}, "", path);
    // The portal hints its destination with that room's accent colour.
    portalRef.current?.setColor(ROOMS[(i + 1) % ROOMS.length].accent);
    setRoomName(room.name);
    document.title = `${room.name} · lunamachi`;
    void respawn(); // swap in this room's cast
    force((n) => n + 1);
  }

  // Repopulate the world with the current room's cast. Guarded by a token so a
  // slow load from a previous room can't clobber a newer one; the old crowd
  // stays on screen until the new one is ready (no empty flash).
  async function respawn() {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) return;
    const token = ++respawnTokenRef.current;

    const cast = ownedRef.current[roomIndexRef.current] ?? metaRef.current;
    if (!cast.length) return;
    const created = await Promise.all(
      Array.from({ length: cfg.population }, (_, i) => {
        const m = cast[i % cast.length];
        return Being.create(ASSETS, m.id, { hasRef: !!m.ref }).catch((e) => {
          console.warn(`[mini-beings] load ${m.id} failed:`, e);
          return null;
        });
      }),
    );
    if (token !== respawnTokenRef.current) {
      created.forEach((b) => b?.container.destroy({ children: true })); // stale — drop
      return;
    }
    for (const b of beingsRef.current) b.container.destroy({ children: true });
    world.removeChildren();
    const beings = created.filter((b): b is Being => b !== null);
    const W = app.renderer.width;
    const H = app.renderer.height;
    for (const b of beings) {
      b.spawn(W, H);
      b.update(0, W, H);
      world.addChild(b.container);
    }
    beingsRef.current = beings;
    setCount(beings.length);
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    roomIndexRef.current = roomIndexFromPath(); // start on the room in the URL
    document.body.dataset.room = ROOMS[roomIndexRef.current].id;
    document.body.style.background = ROOMS[roomIndexRef.current].background(); // avoid flash

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);

    const onPop = () => enterRoom(roomIndexFromPath(), "none"); // back/forward
    window.addEventListener("popstate", onPop);

    (async () => {
      const index: { beings: BeingMeta[] } = await fetch(`${BEINGS_URL}/beings.json`).then((r) => r.json());
      if (!index.beings.length) throw new Error("no beings in index");
      metaRef.current = index.beings;
      ownedRef.current = partitionByRoom(index.beings, ROOMS.length); // each room its own cast

      const app = new Application();
      await app.init({ backgroundAlpha: 0, resizeTo: host, antialias: false });
      if (disposed) return app.destroy(true);
      host.appendChild(app.canvas);
      appRef.current = app;

      const world = new Container();
      world.sortableChildren = true;
      world.eventMode = "none"; // beings don't intercept clicks → portal stays tappable
      world.label = "world";
      app.stage.addChild(world);
      worldRef.current = world;

      // Floor portal: drawn under the beings (so they wander over it) but still
      // clickable (beings are non-interactive). Tapping it travels to the next room.
      const portal = createPortal(() => enterRoom((roomIndexRef.current + 1) % ROOMS.length));
      app.stage.addChildAt(portal.container, 0); // below world; enterRoom inserts scene under it
      portal.container.label = "portal";
      portalRef.current = portal;

      // The generation contract. Default = mock (works under plain `npm run dev`).
      // `?real` routes to our OWN same-origin Worker (src/worker.ts), which holds
      // the sprite-dx api-key and proxies to /api/characters — so the browser
      // never carries a key. (`?real` needs `wrangler dev` + sprite-dx live.)
      const useRealBackend = new URLSearchParams(window.location.search).has("real");
      const summonClient = useRealBackend
        ? createRemoteClient({ baseUrl: "", apiKey: "" }) // key injected by the Worker
        : createMockClient({
            assetBase: ASSETS,
            pickLocal: () => {
              const c = metaRef.current;
              return c.length ? c[Math.floor(Math.random() * c.length)] : undefined;
            },
          });

      // PROTOTYPE: wire the summon entry point now that app/world exist.
      summonRef.current = (prompt: string) => {
        const a = appRef.current;
        const w = worldRef.current;
        if (!a || !w) return Promise.resolve({ ok: false });
        return runSummon(prompt, {
          app: a,
          world: w,
          variant: () => variantRef.current,
          client: summonClient,
          onLive: (b) => {
            beingsRef.current = [...beingsRef.current, b];
            setCount(beingsRef.current.length);
          },
        });
      };

      enterRoom(roomIndexRef.current, "replace"); // mount scene + cast + canonicalize URL

      app.ticker.add((ticker) => {
        const beings = beingsRef.current;
        const w = app.renderer.width;
        const h = app.renderer.height;
        const dt = ticker.deltaMS;
        sceneRef.current?.update(dt, w, h);
        portal.update(dt, w, h, w * 0.5, h * 0.75);
        for (const b of beings) b.update(dt, w, h, ticker);

        for (let a = 0; a < beings.length; a++) {
          for (let b = a + 1; b < beings.length; b++) {
            const dx = beings[a].x - beings[b].x;
            const dy = beings[a].y - beings[b].y;
            if (dx * dx + dy * dy < GREET_DISTANCE * GREET_DISTANCE && Math.random() < 0.03) {
              beings[a].greet();
              beings[b].greet();
            }
          }
        }
      });
    })().catch((e) => console.error("[mini-beings] init failed:", e));

    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      appRef.current?.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // entering/leaving the editor changes the canvas host size → resize the renderer
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const id = requestAnimationFrame(() => app.resize());
    return () => cancelAnimationFrame(id);
  }, [showDebug]);

  // editor: click-to-select. While in the editor the portal nav is muted (clicks
  // pick a being instead), the inspector ticks for live values, and a pointerdown
  // on the canvas selects the topmost being under the cursor (empty space clears).
  useEffect(() => {
    showDebugRef.current = showDebug;
    const app = appRef.current;
    if (portalRef.current) portalRef.current.container.eventMode = showDebug ? "none" : "static";
    if (!app || !showDebug) {
      select(null);
      return;
    }
    const canvas = app.canvas;
    const onDown = (e: PointerEvent) => {
      const hit = pickBeing(beingsRef.current, e.offsetX, e.offsetY, app.renderer);
      select(hit ? hit.container : null);
    };
    canvas.addEventListener("pointerdown", onDown);
    const tick = window.setInterval(() => setSelTick((n) => n + 1), 300);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      clearInterval(tick);
    };
  }, [showDebug]);

  return (
    <div className="mini-beings-root" data-debug={showDebug || undefined}>
      <div ref={hostRef} className="mini-beings-canvas" />
      {!showDebug && (
        <div className="mini-beings-hud">
          <div className="title">{roomName}</div>
          <div className="sub">{count} beings · press Tab for editor</div>
        </div>
      )}
      {!showDebug && <MusicPlayer />}
      {summonOn && !showDebug && (
        <SummonChrome
          onSummon={(p) => summonRef.current?.(p) ?? Promise.resolve({ ok: false })}
        />
      )}
      {showDebug && (
        <>
          <div className="dbg-bar">
            <span className="dot">●</span>
            <b>{roomName}</b>
            <span className="dot">{count} beings</span>
            <span className="spacer" />
            <span className="dot">Tab to exit</span>
          </div>
          <aside className="dbg-panel dbg-hierarchy">
            <div className="hd">Hierarchy</div>
            <Hierarchy
              getRoots={() => (appRef.current?.stage.children as Container[]) ?? []}
              selectedUid={selectedRef.current?.uid ?? null}
              onSelect={(c) => select(c)}
            />
          </aside>
          <aside className="dbg-panel dbg-inspector">
            <div className="hd">Inspector</div>
            {selectedRef.current ? (
              <div className="dbg-kv">
                <span>node</span><b>{selectedRef.current.label || selectedRef.current.constructor?.name || "Object"}</b>
                <span>x</span><b>{selectedRef.current.x | 0}</b>
                <span>y</span><b>{selectedRef.current.y | 0}</b>
                <span>α</span><b>{(selectedRef.current.alpha ?? 1).toFixed(2)}</b>
                <span>children</span><b>{(selectedRef.current.children as Container[]).length}</b>
              </div>
            ) : (
              <div className="dbg-kv">
                <span>room</span><b>{roomName}</b>
                <span>beings</span><b>{count}</b>
                <span>population</span><b>{cfg.population}</b>
                <span>height</span><b>{cfg.height}</b>
                <span>speed</span><b>{cfg.speed}</b>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);

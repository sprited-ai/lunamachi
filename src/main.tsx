// mini-beings — a soft white room (atmosphere from anima/v34) crowded with the
// generated characters as little autonomous beings. They wander a floor band,
// occasionally strike a static reference pose or greet, and greet on bump-ins.
// Press Tab for a debug HUD to tune size, perspective, floor, shadow, etc. live.

import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Application, Container } from "pixi.js";
import { Being } from "./being";
import { cfg } from "./config";
import { MusicPlayer } from "./player";
import { ROOMS, type Scene } from "./rooms";
import "./global.css";

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

function Room() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [count, setCount] = useState(0);
  const [, force] = useState(0);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const beingsRef = useRef<Being[]>([]);
  const metaRef = useRef<BeingMeta[]>([]);
  const roomIndexRef = useRef(0);
  const sceneRef = useRef<Scene | null>(null);
  const [roomName, setRoomName] = useState(ROOMS[0].name);

  const applyRoomBg = () => {
    document.body.style.background = ROOMS[roomIndexRef.current].background();
  };

  // nav: how to reflect the room in the URL — 'push' (user click, new history
  // entry), 'replace' (canonicalize on load), 'none' (already navigated, e.g. back).
  function enterRoom(i: number, nav: "push" | "replace" | "none" = "push") {
    roomIndexRef.current = i;
    const room = ROOMS[i];
    Object.assign(cfg, room.tuning); // never includes population — crowd persists
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
    const path = `/${room.id}`;
    if (nav === "push" && window.location.pathname !== path) history.pushState({}, "", path);
    else if (nav === "replace") history.replaceState({}, "", path);
    setRoomName(room.name);
    document.title = `${room.name} · lunamachi`;
    force((n) => n + 1);
  }

  async function respawn() {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) return;
    for (const b of beingsRef.current) b.container.destroy({ children: true });
    world.removeChildren();

    const meta = metaRef.current;
    const created = await Promise.all(
      Array.from({ length: cfg.population }, (_, i) => {
        const m = meta[i % meta.length];
        return Being.create(ASSETS, m.id, { hasRef: !!m.ref }).catch((e) => {
          console.warn(`[mini-beings] load ${m.id} failed:`, e);
          return null;
        });
      }),
    );
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

      const app = new Application();
      await app.init({ backgroundAlpha: 0, resizeTo: window, antialias: false });
      if (disposed) return app.destroy(true);
      host.appendChild(app.canvas);
      appRef.current = app;

      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      worldRef.current = world;

      await respawn();
      enterRoom(roomIndexRef.current, "replace"); // mount scene + canonicalize the URL

      app.ticker.add((ticker) => {
        const beings = beingsRef.current;
        const w = app.renderer.width;
        const h = app.renderer.height;
        const dt = ticker.deltaMS;
        sceneRef.current?.update(dt, w, h);
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

  return (
    <div className="mini-beings-root">
      <div ref={hostRef} className="mini-beings-canvas" />
      <div className="room-switch">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            className={r.name === roomName ? "active" : ""}
            onClick={() => enterRoom(ROOMS.indexOf(r))}
          >
            {r.name}
          </button>
        ))}
      </div>
      {!showDebug && (
        <div className="mini-beings-hud">
          <div className="title">{roomName}</div>
          <div className="sub">{count} beings · press Tab to tune</div>
        </div>
      )}
      <MusicPlayer />
      {showDebug && (
        <DebugPanel
          count={count}
          rerender={() => force((n) => n + 1)}
          onRespawn={respawn}
          onGradient={applyRoomBg}
        />
      )}
    </div>
  );
}

function DebugPanel({
  count,
  rerender,
  onRespawn,
  onGradient,
}: {
  count: number;
  rerender: () => void;
  onRespawn: () => void;
  onGradient: () => void;
}) {
  const set = (patch: Partial<typeof cfg>, opts?: { gradient?: boolean }) => {
    Object.assign(cfg, patch);
    if (opts?.gradient) onGradient();
    rerender();
  };

  const Slider = ({
    label, value, min, max, step, on,
  }: { label: string; value: number; min: number; max: number; step: number; on: (v: number) => void }) => (
    <label className="row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => on(Number(e.target.value))} />
      <b>{Number.isInteger(step) ? value : value.toFixed(2)}</b>
    </label>
  );

  return (
    <div className="mini-beings-debug">
      <div className="hd">mini-beings · debug <span>{count} beings</span></div>

      <label className="row check">
        <input type="checkbox" checked={cfg.uniformSize}
          onChange={(e) => set({ uniformSize: e.target.checked })} />
        <span>uniform size (ignore perspective)</span>
      </label>

      {cfg.uniformSize ? (
        <Slider label="height" value={cfg.height} min={30} max={260} step={1} on={(v) => set({ height: v })} />
      ) : (
        <>
          <Slider label="min height" value={cfg.minHeight} min={20} max={200} step={1} on={(v) => set({ minHeight: v })} />
          <Slider label="max height" value={cfg.maxHeight} min={40} max={320} step={1} on={(v) => set({ maxHeight: v })} />
        </>
      )}

      <Slider label="horizon ↕" value={cfg.horizon} min={0.3} max={0.85} step={0.01}
        on={(v) => set({ horizon: v, floorTop: v }, { gradient: true })} />
      <Slider label="floor bottom" value={cfg.floorBottom} min={0.6} max={1} step={0.01} on={(v) => set({ floorBottom: v })} />
      <Slider label="shadow" value={cfg.shadow} min={0} max={1.4} step={0.05} on={(v) => set({ shadow: v })} />
      <Slider label="speed" value={cfg.speed} min={10} max={200} step={5} on={(v) => set({ speed: v })} />
      <Slider label="pose %" value={cfg.poseChance} min={0} max={0.8} step={0.02} on={(v) => set({ poseChance: v })} />
      <Slider label="greet %" value={cfg.greetChance} min={0} max={0.6} step={0.02} on={(v) => set({ greetChance: v })} />

      <Slider label="population" value={cfg.population} min={1} max={320} step={1} on={(v) => set({ population: v })} />
      <div className="btns">
        <button type="button" onClick={onRespawn}>respawn {cfg.population}</button>
      </div>
      <div className="ft">Tab to close</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);

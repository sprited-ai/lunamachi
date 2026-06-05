// ⚠️ PROTOTYPE — throwaway. Delete or fold the winner into the real code.
//
// Question this answers: when you summon a being into lunamachi, how should it
// ARRIVE so the moment feels magical? Three radically different manifestations,
// switchable live via ?variant=A|B|C and a floating bottom bar — now with a clear
// LOADING state (spotlight dim + progress) and a punchy ARRIVAL (flash + scale-pop
// + a "this one's yours" ring + a toast).
//
// The backend goes through the real CONTRACT (sprite-dx-client.ts) but behind a
// MOCK client (createMockClient below): a summon waits ~2s (evoking the real
// FAL→RunPod 1-3min) and resolves to a being that already exists in the roster.
// Swapping to real generation is one line in main.tsx — mock → createRemoteClient.
// We're testing the *feel* of summoning into the world, not the GPU pipeline.
// Type "fail" in the prompt to exercise the failure UI (the mock never errors).
//
// Dev-only: gated behind import.meta.env.DEV at the call site in main.tsx.

import { useEffect, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { Being } from "./being";
import { cfg } from "./config";
import type { CharacterAsset, SpriteDxClient, GenerationJob } from "./sprite-dx-client";

export type SummonVariant = "A" | "B" | "C";

export const SUMMON_VARIANTS: Record<SummonVariant, { name: string; accent: number }> = {
  A: { name: "Portal Birth", accent: 0x9fd0ff },
  B: { name: "Seed Hatch", accent: 0xffd27a },
  C: { name: "Materialize", accent: 0xb6a8ff },
};

export interface SummonResult { ok: boolean; id?: string }

// --- tiny tween/timing helpers (rAF-based, prototype-grade) -----------------

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Drive a 0→1 progress value over `ms`, calling fn each frame. Resolves at end. */
function tween(ms: number, fn: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// --- the floor effects layer ------------------------------------------------

/** A self-animating Graphics added on top of the stage. Call stop() to remove. */
interface Fx {
  draw(fn: (g: Graphics, elapsedMs: number) => void): void;
  burst(): void; // one-shot arrival flash — big and bright
  fail(): void; // one-shot failure mark
  stop(): void;
}

function makeFx(app: Application, accent: number, spot: { x: number; y: number }): Fx {
  const g = new Graphics();
  g.x = spot.x;
  g.y = spot.y;
  app.stage.addChild(g); // top of everything
  let elapsed = 0;
  let drawFn: ((g: Graphics, e: number) => void) | null = null;
  let burstAt = -1;
  let failAt = -1;

  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS;
    g.clear();
    if (drawFn && failAt < 0) drawFn(g, elapsed);

    if (burstAt >= 0) {
      const bt = (elapsed - burstAt) / 540;
      if (bt <= 1) {
        const e2 = easeOut(bt);
        const fade = 1 - bt;
        g.circle(0, 0, e2 * 50).fill({ color: 0xffffff, alpha: 0.3 * fade }); // core flash
        g.circle(0, 0, 8 + e2 * 100).stroke({ width: 4 * fade, color: 0xffffff, alpha: 0.85 * fade });
        g.circle(0, 0, 20 + e2 * 180).stroke({ width: 6 * fade, color: accent, alpha: 0.95 * fade });
      }
    }

    if (failAt >= 0) {
      const ft = (elapsed - failAt) / 520;
      if (ft <= 1) {
        const fade = 1 - ft;
        g.circle(0, 0, 70 * (1 - easeOut(ft))).stroke({ width: 3, color: 0xff6b6b, alpha: 0.8 * fade });
        const s = 11;
        g.moveTo(-s, -s).lineTo(s, s).moveTo(s, -s).lineTo(-s, s)
          .stroke({ width: 3, color: 0xff6b6b, alpha: 0.9 * fade });
      }
    }
  };
  app.ticker.add(tick);

  return {
    draw: (fn) => { drawFn = fn; },
    burst: () => { burstAt = elapsed; },
    fail: () => { failAt = elapsed; },
    stop: () => { app.ticker.remove(tick); g.destroy(); },
  };
}

/** A short-lived "this one's yours" ring that rides along on the new being. */
function markNew(being: Being) {
  const ring = new Graphics();
  being.container.addChild(ring);
  const start = performance.now();
  const LIFE = 4500;
  const step = (now: number) => {
    if (ring.destroyed) return;
    const t = (now - start) / LIFE;
    if (t >= 1) { ring.destroy(); return; }
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    const r = 50 + pulse * 10;
    const a = (1 - t) * 0.9;
    ring.clear();
    ring.circle(0, -46, r).stroke({ width: 3, color: 0xfff1a8, alpha: a });
    ring.circle(0, -46, r * 0.66).stroke({ width: 1.5, color: 0xfff1a8, alpha: a * 0.5 });
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function floorSpot(app: Application): { x: number; y: number } {
  const W = app.renderer.width;
  const H = app.renderer.height;
  const m = 80;
  const x = m + Math.random() * (W - 2 * m);
  const y = H * (cfg.floorTop + Math.random() * (cfg.floorBottom - cfg.floorTop));
  return { x, y };
}

// Each variant: where the being lands, and how the "charging" effect looks while
// generation is pending. burst() + the being's pop-in are shared at arrival.
const MANIFEST: Record<
  SummonVariant,
  { spot(app: Application): { x: number; y: number }; charge(fx: Fx, accent: number): void }
> = {
  // A — emerges from the existing magic portal, then walks off into the room.
  A: {
    spot: (app) => ({ x: app.renderer.width * 0.5, y: app.renderer.height * 0.75 }),
    charge: (fx, accent) =>
      fx.draw((g, e) => {
        const pulse = 0.5 + 0.5 * Math.sin(e * 0.008);
        g.ellipse(0, -50 - pulse * 36, 12 + pulse * 8, 80 + pulse * 40).fill({ color: accent, alpha: 0.12 + 0.12 * pulse });
        g.circle(0, 0, 34 + pulse * 10).stroke({ width: 2.5, color: accent, alpha: 0.6 });
        g.circle(0, 0, 22 + pulse * 6).stroke({ width: 1.5, color: accent, alpha: 0.4 });
      }),
  },
  // B — a glowing seed drops on the floor and pulses, then cracks into the being.
  B: {
    spot: floorSpot,
    charge: (fx, accent) =>
      fx.draw((g, e) => {
        const pulse = 0.5 + 0.5 * Math.sin(e * 0.012);
        const rise = Math.max(0, 16 - e * 0.04);
        g.ellipse(0, 4, 14, 5).fill({ color: 0x000000, alpha: 0.1 });
        g.circle(0, -6 - rise, 7 + pulse * 3).fill({ color: accent, alpha: 0.9 });
        g.circle(0, -6 - rise, 13 + pulse * 5).stroke({ width: 1.5, color: accent, alpha: 0.4 + 0.3 * pulse });
      }),
  },
  // C — shimmers into existence: stacked rings rippling outward at the spot.
  C: {
    spot: floorSpot,
    charge: (fx, accent) =>
      fx.draw((g, e) => {
        for (let i = 0; i < 3; i++) {
          const phase = (e * 0.0016 + i / 3) % 1;
          g.circle(0, 0, phase * 74).stroke({ width: 2, color: accent, alpha: 0.5 * (1 - phase) });
        }
      }),
  },
};

// --- the public summon entry point (called from main.tsx) -------------------

export interface SummonDeps {
  app: Application;
  world: Container;
  variant(): SummonVariant;
  client: SpriteDxClient; // the contract — mock now, gen.sprited.ai later
  onLive(b: Being): void; // register into the live beings array so the ticker drives it
}

/** Run one summon: charge effect runs while the client generates → being pops in. */
export async function runSummon(prompt: string, deps: SummonDeps): Promise<SummonResult> {
  const { app, world } = deps;
  const variant = deps.variant();
  const accent = SUMMON_VARIANTS[variant].accent;
  const manifest = MANIFEST[variant];
  const spot = manifest.spot(app);

  const fx = makeFx(app, accent, spot);
  manifest.charge(fx, accent);

  // the charge effect runs for as long as generation actually takes (~2s mock,
  // ~1-3min real). One await — the client hides the job/poll behind the contract.
  let asset: CharacterAsset;
  try {
    asset = await deps.client.generateAndWait(prompt);
  } catch {
    fx.fail();
    await delay(560);
    fx.stop();
    return { ok: false };
  }

  const being = await Being.create(asset.assetBase, asset.id, { hasRef: asset.hasRef });
  being.x = spot.x;
  being.y = spot.y;
  being.update(0, app.renderer.width, app.renderer.height); // sets depth-correct scale
  const facing = Math.sign(being.container.scale.x) || 1;
  const tsx = Math.abs(being.container.scale.x);
  const tsy = being.container.scale.y;
  being.container.alpha = 0;
  world.addChild(being.container);

  fx.burst();
  // pop-in: fade + scale overshoot (0 → 1.14 → 1.0), landing exactly on the depth scale
  await tween(440, (t) => {
    being.container.alpha = Math.min(1, t * 1.6);
    const pop = t < 0.68 ? (t / 0.68) * 1.14 : 1.14 - ((t - 0.68) / 0.32) * 0.14;
    being.container.scale.set(tsx * pop * facing, tsy * pop);
  });
  being.container.scale.set(tsx * facing, tsy);
  fx.stop();
  markNew(being);
  deps.onLive(being); // now it joins the wandering crowd

  return { ok: true, id: being.id };
}

// --- mock client (throwaway) ------------------------------------------------
// Implements the real SpriteDxClient contract, but "generation" just waits ~2s
// and resolves to an existing roster character. Honors the job/poll shape so the
// swap to createRemoteClient(spritedx.com) is a one-liner. "fail" → failure.

export function createMockClient(opts: {
  assetBase: string;
  pickLocal: () => { id: string; ref?: boolean } | undefined;
}): SpriteDxClient {
  const jobs = new Map<string, GenerationJob>();
  let n = 0;

  const start = (prompt: string): string => {
    const id = `mock-${++n}`;
    jobs.set(id, { id, status: "running" });
    setTimeout(() => {
      if (/fail/i.test(prompt)) { jobs.set(id, { id, status: "failed", error: "generation failed" }); return; }
      const m = opts.pickLocal();
      if (!m) { jobs.set(id, { id, status: "failed", error: "empty roster" }); return; }
      const character: CharacterAsset = { id: m.id, assetBase: opts.assetBase, hasRef: !!m.ref };
      jobs.set(id, { id, status: "done", character });
    }, 1400 + Math.random() * 900);
    return id;
  };

  const generate: SpriteDxClient["generate"] = async (prompt) => ({ id: start(prompt) });
  const getStatus: SpriteDxClient["getStatus"] = async (id) =>
    jobs.get(id) ?? { id, status: "failed", error: "unknown job" };
  const generateAndWait: SpriteDxClient["generateAndWait"] = async (prompt) => {
    const { id } = await generate(prompt);
    for (;;) {
      const job = jobs.get(id)!;
      if (job.status === "done" && job.character) return job.character;
      if (job.status === "failed") throw new Error(job.error ?? "generation failed");
      await delay(120);
    }
  };

  return { generate, getStatus, generateAndWait };
}

// --- React chrome: loading state, arrival toast, variant switcher -----------

export function SummonChrome({
  onSummon,
}: {
  onSummon(prompt: string): Promise<SummonResult>;
}) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "summoning" | "arrived" | "failed">("idle");
  const [secs, setSecs] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const busy = status === "summoning";

  // elapsed-seconds counter while summoning
  useEffect(() => {
    if (status !== "summoning") return;
    setSecs(0);
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = prompt.trim() || "a tiny wandering being";
    setStatus("summoning");
    setToast(null);
    const res = await onSummon(name);
    if (res.ok) {
      setToast({ kind: "ok", text: `✨ ‘${name}’ arrived` });
      setPrompt("");
    } else {
      setToast({ kind: "err", text: `✕ summon failed — try again` });
    }
    setStatus("idle");
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <>
      {/* spotlight dim — focuses attention on the summon while it's working */}
      <div className="summon-dim" data-on={busy} />

      {toast && <div className="summon-toast" data-kind={toast.kind}>{toast.text}</div>}

      <div className="summon-proto">
        <form className="summon-box" data-busy={busy} onSubmit={submit}>
          {busy ? (
            <div className="summon-loading">
              <span className="spinner" />
              <span className="lbl">summoning<span className="dots" /></span>
              <span className="secs">{secs}s</span>
              <span className="bar" />
            </div>
          ) : (
            <>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="summon a being…"
              />
              <button type="submit">summon</button>
            </>
          )}
        </form>
      </div>
    </>
  );
}

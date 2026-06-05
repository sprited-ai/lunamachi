# Summon prototype — notes

**Status:** ⚠️ throwaway. Validates *feel*, not the real pipeline.

## Question
When you summon a being into lunamachi, how should it **arrive** so the moment
feels magical? (And, more basically: does bolting a summon onto the world feel
right at all?)

## What's real vs faked
- **Real:** the in-world arrival — a being is built with `Being.create()`, fades
  in, and joins the wandering crowd driven by the existing ticker.
- **Real:** the *contract*. `runSummon()` calls `client.generateAndWait(prompt)`
  against `SpriteDxClient` (`src/sprite-dx-client.ts`) — the same typed surface the
  live API uses (job + poll: `POST /api/characters` → `GET /api/characters/:id`).
  "summon" is lunamachi's concept; sprite-dx only knows generic generation.
- **Faked:** only the client implementation. `createMockClient` (in
  summon-prototype.tsx) waits ~1.4–2.3s and resolves to a being that already
  exists in the roster. No GPU, no auth, no cost, prompt only used to trigger the
  `fail` demo path.

## The seam (mock → real is one line)
`src/sprite-dx-client.ts` is lunamachi-dep-free on purpose — it's the future
open-source `sprite-dx-client` repo. It already ships `createRemoteClient({
baseUrl: "https://spritedx.com", apiKey })`. To go live, swap the
`createMockClient(...)` in `main.tsx` for `createRemoteClient(...)` — nothing else
in lunamachi changes. The being's assets are addressed `${assetBase}/${id}/...`,
which matches both the local roster (mock) and sprite-dx's `/p/:id/...` serving.

## How to run
```
npm run dev
```
Summon is **opt-in** — off by default (it isn't a real feature yet, so the ambient
room stays clean). Open the printed URL with **`?summon`** to reveal it
(`?summon=0` forces it off). Type anything → "summon".

Manifestation is **locked to Seed Hatch** (the winner — see Verdict). The A/B/C
switcher is gone; the other two (`MANIFEST.A`/`.C` in summon-prototype.tsx) are
kept only so we can revisit, not wired to any UI.

Feedback baked in (per "티도 안 나" / "로딩·arrival 확나게"):
- **Loading:** screen dims to a spotlight, the box turns into a spinner +
  "summoning Ns" + sweeping progress bar.
- **Arrival:** big flash + the being pops in (scale overshoot) + a gold ring
  rides its head for ~4.5s so you can find it in the crowd + a "✨ arrived" toast.
- **Failure:** type `fail` in the prompt → red mark + "✕ summon failed" toast,
  no being added (the stub never errors on its own; this is the demo hook).

Dev-only: gated behind `import.meta.env.DEV` **and** the `?summon` URL flag, so it's
off by default and can't ship.

Gotcha: if you started `npm run dev` *before* the `src/rooms/` file→dir refactor
settled, Vite caches a stale `components.ts` path and the page goes blank
(404 on `/src/rooms/components.ts`). Fix = restart the dev server. Not a summon bug.

## Files (delete all of this when folding the winner in)
- `src/summon-prototype.tsx` — effects + React chrome + `runSummon()`
- `src/main.tsx` — search for `PROTOTYPE:` (3 spots) + the `import.meta.env.DEV` block
- `src/global.css` — the `⚠️ PROTOTYPE` block at the end

## Verdict
**Seed Hatch (B) won** (user call, 2026-06-04). The glowing-seed-drops-then-cracks
landing felt the most magical of the three. Locked in; switcher removed.

## Going real
The plan settled on a **generic sprite-dx API + an SDK**, not a lunamachi-specific
`/api/summon` (that would plant lunamachi's "summon" concept into sprite-dx):
1. sprite-dx exposes generic generation `POST /api/characters` (server-driven,
   reusing the headless `batch-generate-characters.ts` orchestration). _[next]_
2. Auth via a sprite-dx **api-key** — UI for issuing keys is built (sprite-dx
   `UserMenu` → API Keys). The key is the billing identity; lunamachi holds it
   server-side.
3. The contract lives in its own open-source repo **`sprite-dx-client`**
   (`/Users/jin/dev/sprite-dx-client`, generic `generate`/`generateAndWait`).
4. lunamachi swaps `createMockClient(...)` → `createClient({ baseUrl:
   "https://spritedx.com", apiKey })` — the one-line flip. The arrival animation
   (this prototype's keeper) stays.

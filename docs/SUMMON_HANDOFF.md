# Summon × sprite-dx — handoff

Connect sprite-dx's animated-character generation into lunamachi: a visitor types
a prompt and a freshly-generated being walks into the world. Built end-to-end this
session; summon is wired and **verified working**, but left **OFF** (kill switch).

## What works (verified live, 2026-06-05)

Full chain, tested both directly and through lunamachi's proxy:

```
lunamachi browser (thin client, NO key)
  → lunamachi Worker (injects api-key, kill-switch, moderation, rate-limit)
  → sprite-dx  POST /api/characters {prompt}      (api-key OR JWT)  → { id }
       (server-side, polling-driven KV state machine — no DO/Queue/waitUntil)
       generate → animate → editing  (3 RunPod GPU stages, async /run)
       manifest (TS-ported, no QuickJS) → R2
  → GET /api/characters/:id  →  { status, character:{ id, assetBase:"/p" } }
  → assets served at /p/:id/{entity_pixel.json, spritesheet_pixel.png}
       (lunamachi proxies /p same-origin → no CORS)
  → Being.create(assetBase, id) renders it (Seed Hatch arrival — see prototype)
```

A real run produced a valid `entity_pixel.json` (greet/idle/run, 128px frames) +
`spritesheet_pixel.png` (~700-950KB). ~80s warm, ~4.5min cold.

## Deployment state (all live)

- **sprite-dx** — committed + pushed to `kndlt/sprite-dx` main, deployed. Adds:
  api-key system (account menu → API Keys), `/api/characters`, `/api/run` accepts
  `sk_` keys. RunPod/comfy image **unchanged** (no redeploy needed).
- **lunamachi** — Worker deployed (was static-only). Holds `SPRITEDX_API_KEY`
  secret. **`SUMMON_ENABLED` secret = "0" (OFF)**. KV `SUMMON_KV` for rate-limit.
  Vars `SUMMON_IP_CAP=5`, `SUMMON_DAILY_CAP=100`.
- **sprite-dx-client** — new repo at `/Users/jin/dev/sprite-dx-client` (generic
  typed SDK, MIT, committed). Open-source-ready; lunamachi has a local copy.

## To turn summon ON

1. (optional) live-test once: `curl -XPOST https://spritedx.com/api/characters -H
   "authorization: Bearer <your sk_ key>" -d '{"prompt":"..."}'` → poll `/:id`.
2. `cd lunamachi && printf "1" | npx wrangler secret put SUMMON_ENABLED`
3. **The summon UI is dev-gated** (`import.meta.env.DEV` in main.tsx) — prod has no
   summon button yet. To let visitors summon in the browser, ungate it (make summon
   a real feature). Until then the endpoint is API-only.

Safety already in place (anonymous + free): prompt moderation (denylist + length),
per-IP (5/day) + global (100/day = cost ceiling) caps, kill switch.

## Repo states / drift

- **sprite-dx**: clean, pushed. ✅
- **lunamachi**: **uncommitted** — my summon work (`worker.ts`, `sprite-dx-client.ts`,
  `summon-prototype.tsx`, this doc, `wrangler.jsonc`) is intermixed in the working
  tree with your editor work (`debug-hierarchy.tsx`, `scene-tree`, etc.). `main.tsx`
  + `global.css` are shared (both authors), so I didn't commit. Builds + typechecks
  clean. **You'll want to commit lunamachi yourself** (or tell me which files).

## Key design decisions (why it's built this way)

- **Server-side generation, thin clients** — any client (lunamachi, sprite-dx
  landing) just POSTs + polls. "summon" is lunamachi's concept; sprite-dx only knows
  generic `/api/characters`.
- **No self-fetch** — the worker can't fetch its own zone (Cloudflare 522), so the
  pipeline/workflow JSON are bundled and the template PNG is embedded; RunPod is
  called directly (`worker/lib/runpod.ts`).
- **Polling-driven KV stepper, not waitUntil/DO/Queue** — `waitUntil` is cancelled
  after ~30s, so a multi-minute run can't complete in one invocation. Each request
  (POST or GET poll) does one short RunPod call and advances the KV state machine.
  (Details: `sprite-dx/ui/worker/characters.README.md`.)

## Remaining gaps / next steps

1. **Permanent & shared roster** (the chosen vision): summoned beings land in R2 but
   nothing records them into a roster lunamachi loads on startup, so a being is
   session-only today. Next: a `generated_characters` record + `GET /api/characters`
   (list recent) on sprite-dx, and load it as roster in lunamachi (`main.tsx`). Needs
   a prod DB migration + a call on moderating permanent public content.
2. **Ungate the summon UI** (drop `import.meta.env.DEV`) to ship it to visitors.
3. **animate retryPolicy** (confidence ≥ 0.9, 3 attempts) — defined in the pipeline,
   not implemented; the stage runs once.
4. **Image moderation / admin hide** — prompt moderation only covers text.
5. Verify the existing logged-in browser generation still works (I refactored
   `/api/run`; the client reads body fields not HTTP status, so it should be fine).

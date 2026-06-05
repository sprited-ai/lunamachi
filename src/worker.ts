// lunamachi worker — thin proxy that turns the static site into a Worker holding
// the sprite-dx api-key server-side. The browser calls these same-origin /api
// routes (with NO key); the worker injects the key and fronts sprite-dx's generic
// generation API. Generation is opt-in behind a kill switch (SUMMON_ENABLED, OFF
// by default), with prompt moderation + per-IP/global daily caps (anonymous+free).

interface Fetcher {
  fetch(req: Request): Promise<Response>;
}
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  ASSETS: Fetcher;
  SPRITEDX_API_KEY: string; // secret — never sent to the browser
  SUMMON_ENABLED?: string; // kill switch: "1"/"true" enables (default: off)
  SPRITEDX_BASE?: string; // default "https://spritedx.com"
  SUMMON_KV: KV; // rate-limit counters
  SUMMON_IP_CAP?: string; // per-IP summons/day (default 5)
  SUMMON_DAILY_CAP?: string; // global summons/day = cost ceiling (default 100)
}

const isEnabled = (env: Env) => {
  const v = (env.SUMMON_ENABLED ?? "").trim();
  return v === "1" || v === "true";
};
const baseOf = (env: Env) => (env.SPRITEDX_BASE || "https://spritedx.com").replace(/\/+$/, "");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function authHeaders(env: Env, extra?: Record<string, string>): Record<string, string> {
  return { ...extra, authorization: `Bearer ${env.SPRITEDX_API_KEY}` };
}

// Anonymous + free → prompts are lightly moderated and summons are capped.
const BANNED = [
  "nsfw", "nude", "naked", "porn", "sex", "xxx", "hentai", "rape", "incest",
  "child porn", "cp ", "loli", "shota", "bestiality", "gore", "nazi", "isis",
];
function moderate(prompt: string): { ok: boolean; reason?: string } {
  const p = prompt.trim();
  if (p.length > 200) return { ok: false, reason: "prompt too long (max 200 chars)" };
  const lower = ` ${p.toLowerCase()} `;
  if (BANNED.some((w) => lower.includes(w))) return { ok: false, reason: "that prompt isn't allowed" };
  return { ok: true };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Soft per-IP + global daily caps via KV counters. Race-tolerant (soft caps). */
async function rateLimit(env: Env, ip: string): Promise<{ ok: boolean; reason?: string }> {
  const ipCap = Number(env.SUMMON_IP_CAP ?? "5");
  const globalCap = Number(env.SUMMON_DAILY_CAP ?? "100");
  const d = today();
  const ipKey = `rl:ip:${ip}:${d}`;
  const gKey = `rl:global:${d}`;
  const [ipRaw, gRaw] = await Promise.all([env.SUMMON_KV.get(ipKey), env.SUMMON_KV.get(gKey)]);
  const ipN = Number(ipRaw ?? "0");
  const gN = Number(gRaw ?? "0");
  if (gN >= globalCap) return { ok: false, reason: "the world is resting — daily summon limit reached" };
  if (ipN >= ipCap) return { ok: false, reason: "you've summoned enough for today" };
  await Promise.all([
    env.SUMMON_KV.put(ipKey, String(ipN + 1), { expirationTtl: 172800 }),
    env.SUMMON_KV.put(gKey, String(gN + 1), { expirationTtl: 172800 }),
  ]);
  return { ok: true };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    // The client reads this to know whether to show the summon UI at all.
    if (p === "/api/summon/config") return json({ enabled: isEnabled(env) });

    // Create a generation job (browser → here → sprite-dx, key injected here).
    if (p === "/api/characters" && req.method === "POST") {
      if (!isEnabled(env)) return json({ error: "summon disabled" }, 503);
      const body = (await req.json().catch(() => ({}))) as { prompt?: string; seed?: number };
      const prompt = typeof body.prompt === "string" ? body.prompt : "";

      const mod = moderate(prompt);
      if (!mod.ok) return json({ error: mod.reason }, 400);

      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      const rl = await rateLimit(env, ip);
      if (!rl.ok) return json({ error: rl.reason }, 429);

      const r = await fetch(`${baseOf(env)}/api/characters`, {
        method: "POST",
        headers: authHeaders(env, { "content-type": "application/json" }),
        body: JSON.stringify({ prompt, seed: body.seed }),
      });
      return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
    }

    // List the shared roster (recent characters). Not gated by the kill switch —
    // you can see the world even when summoning is off. assetBase → same-origin /p.
    if (p === "/api/characters" && req.method === "GET") {
      const r = await fetch(`${baseOf(env)}/api/characters${url.search}`, { headers: authHeaders(env) });
      const data = (await r.json().catch(() => ({}))) as { characters?: { assetBase?: string }[] };
      for (const ch of data.characters ?? []) ch.assetBase = "/p";
      return json(data, r.status);
    }

    // Poll a job. Rewrite assetBase so the browser loads assets same-origin
    // (through the /p proxy below) — avoids cross-origin CORS on the sprites.
    const job = p.match(/^\/api\/characters\/([A-Za-z0-9_-]+)$/);
    if (job && req.method === "GET") {
      const r = await fetch(`${baseOf(env)}/api/characters/${job[1]}`, { headers: authHeaders(env) });
      const data = (await r.json().catch(() => ({}))) as { character?: { assetBase?: string } };
      if (data?.character) data.character.assetBase = "/p";
      return json(data, r.status);
    }

    // Serve generated assets same-origin: /p/:id/:file → sprite-dx.
    if (p.startsWith("/p/")) {
      const r = await fetch(`${baseOf(env)}${p}`, { headers: authHeaders(env) });
      return new Response(r.body, { status: r.status, headers: r.headers });
    }

    // Everything else is the static SPA.
    return env.ASSETS.fetch(req);
  },
};

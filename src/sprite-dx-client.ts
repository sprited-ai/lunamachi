// sprite-dx-client — the typed surface for sprite-dx character generation.
//
// This is the CONTRACT, nothing else: types + a thin HTTP client over the
// sprite-dx generation API. No secrets, no pipeline internals, no consumer-app
// concepts (lunamachi's "summon"/"being" stay on the lunamachi side). So it lifts
// into its own open-source repo (`sprite-dx-client`) unchanged. The real
// generation (FAL/BFL/RunPod/birefnet, prompts, workflows) lives behind the API;
// this just calls it with one sprite-dx api-key.
//
// Generation is async/job-shaped (a run takes ~1-3min):
//   POST /api/characters       { prompt, seed? }  -> { id }
//   GET  /api/characters/:id                        -> GenerationJob
// `generateAndWait` hides the polling so a consumer writes one line:
//   const character = await client.generateAndWait("a glowing fox spirit")

/** A finished character, addressed the way a sprite renderer consumes assets:
 *  fetch `${assetBase}/${id}/entity_pixel.json` + the spritesheet. The real API
 *  serves these at `/p/:id/...`. */
export interface CharacterAsset {
  id: string;
  assetBase: string;
  hasRef: boolean;
}

export type GenerationStatus = "running" | "done" | "failed";

export interface GenerationJob {
  id: string;
  status: GenerationStatus;
  character?: CharacterAsset; // present when status === "done"
  error?: string; // present when status === "failed"
}

export interface GenerateOpts {
  seed?: number;
  signal?: AbortSignal;
}

export interface SpriteDxClient {
  /** Kick off a generation. Returns immediately with a job id. */
  generate(prompt: string, opts?: GenerateOpts): Promise<{ id: string }>;
  /** Poll one job. */
  getStatus(id: string): Promise<GenerationJob>;
  /** Convenience: generate then poll to completion. Throws on failure/abort. */
  generateAndWait(prompt: string, opts?: GenerateOpts): Promise<CharacterAsset>;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RemoteConfig {
  baseUrl: string; // e.g. "https://spritedx.com"
  apiKey: string; // sprite-dx api-key — the identity that gets billed
  pollMs?: number;
}

/** The real client: one resource, bearer-keyed, job + poll. This is the piece the
 *  open-source SDK ships; a consumer just points it at the API. */
export function createRemoteClient(cfg: RemoteConfig): SpriteDxClient {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${cfg.apiKey}`,
  };

  const generate: SpriteDxClient["generate"] = async (prompt, opts) => {
    const res = await fetch(`${cfg.baseUrl}/api/characters`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, seed: opts?.seed }),
      signal: opts?.signal,
    });
    if (!res.ok) throw new Error(`generate failed: ${res.status}`);
    return (await res.json()) as { id: string };
  };

  const getStatus: SpriteDxClient["getStatus"] = async (id) => {
    const res = await fetch(`${cfg.baseUrl}/api/characters/${id}`, { headers });
    if (!res.ok) throw new Error(`status failed: ${res.status}`);
    return (await res.json()) as GenerationJob;
  };

  const generateAndWait: SpriteDxClient["generateAndWait"] = async (prompt, opts) => {
    const { id } = await generate(prompt, opts);
    const pollMs = cfg.pollMs ?? 2000;
    for (;;) {
      if (opts?.signal?.aborted) throw new Error("generation aborted");
      const job = await getStatus(id);
      if (job.status === "done" && job.character) return job.character;
      if (job.status === "failed") throw new Error(job.error ?? "generation failed");
      await delay(pollMs);
    }
  };

  return { generate, getStatus, generateAndWait };
}

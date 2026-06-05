// A small "fancy Winamp" music player for the mini-beings room: a dark glass
// panel with play/prev/next, volume, a track title, and a Web Audio frequency
// visualizer. Serves AI-generated lo-fi tracks from a playlist — music only, no
// ads, just the little beings to watch while it plays.
//
// Audio playback follows the anima radio's bgm.ts approach (an <audio> element,
// autoplay unlocked by the play gesture, volume persisted to localStorage),
// extended to a playlist + an AnalyserNode for the visualizer.

import { useCallback, useEffect, useRef, useState } from "react";

const MUSIC_URL = "/music";
const VOL_KEY = "mini-beings.music.volume";
const ON_KEY = "mini-beings.music.on"; // play intent, persisted across visits

interface Track { title: string; artist?: string; src: string }

export function MusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0.7;
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vizRef = useRef<HTMLCanvasElement>(null);

  // Cross-tab coordination so only ONE tab plays at a time (no doubled audio).
  const chRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef(`t${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const othersPlayingRef = useRef(false);

  useEffect(() => {
    fetch(`${MUSIC_URL}/playlist.json`)
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks ?? []))
      .catch((e) => console.warn("[mini-beings] playlist load failed:", e));
  }, []);

  // Web Audio graph is built lazily on the first play (needs a user gesture).
  const ensureGraph = useCallback(() => {
    if (ctxRef.current || !audioRef.current) return;
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  // Release the Web Audio graph on unmount — browsers cap concurrent
  // AudioContexts, so a remounted player must not leak the old one.
  useEffect(() => () => void ctxRef.current?.close().catch(() => {}), []);

  // Only one tab plays at a time: a tab announces "playing"/"stopped"; a playing
  // tab yields (pauses) when another starts, and a fresh tab polls on mount and
  // won't auto-start if another tab is already playing.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("mini-beings.music");
    chRef.current = ch;
    const me = tabIdRef.current;
    ch.onmessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; tab?: string } | null;
      if (!m || m.tab === me) return;
      if (m.type === "playing") {
        othersPlayingRef.current = true;
        const a = audioRef.current;
        if (a && !a.paused) { a.pause(); setPlaying(false); } // newest tab wins
      } else if (m.type === "stopped") {
        othersPlayingRef.current = false;
      } else if (m.type === "poll") {
        const a = audioRef.current;
        if (a && !a.paused) ch.postMessage({ type: "playing", tab: me });
      }
    };
    ch.postMessage({ type: "poll", tab: me }); // ask who's already playing
    const onHide = () => {
      if (audioRef.current && !audioRef.current.paused) ch.postMessage({ type: "stopped", tab: me });
    };
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); ch.close(); chRef.current = null; };
  }, []);

  const play = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    ensureGraph();
    await ctxRef.current?.resume();
    try {
      await a.play();
      setPlaying(true);
      localStorage.setItem(ON_KEY, "1");
      chRef.current?.postMessage({ type: "playing", tab: tabIdRef.current }); // others yield
    } catch (e) {
      console.warn("[mini-beings] play blocked:", e);
    }
  }, [ensureGraph]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    localStorage.setItem(ON_KEY, "0");
    chRef.current?.postMessage({ type: "stopped", tab: tabIdRef.current });
  }, []);

  const next = useCallback(() => setIndex((i) => (tracks.length ? (i + 1) % tracks.length : 0)), [tracks.length]);
  const prev = useCallback(() => setIndex((i) => (tracks.length ? (i - 1 + tracks.length) % tracks.length : 0)), [tracks.length]);

  // Load the current track; keep playing across track changes. With a single
  // track, loop it natively (seamless); with several, onEnded advances instead.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !tracks.length) return;
    a.loop = tracks.length <= 1;
    a.src = `${MUSIC_URL}/${tracks[index].src}`;
    if (playing) a.play().catch(() => { /* unlocked already */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tracks]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOL_KEY, String(volume));
  }, [volume]);

  // Play on arrival: default to on (it's a music site). Browsers block autoplay
  // until a gesture, so try immediately and otherwise start on the FIRST input —
  // exactly once, then drop the listeners so they never fight the play button.
  useEffect(() => {
    if (!tracks.length) return;
    if (localStorage.getItem(ON_KEY) === "0") return; // paused last visit — respect it
    if (othersPlayingRef.current) return; // another tab already plays — don't double up
    let started = false;
    const remove = () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    const start = () => {
      if (started) return;
      started = true;
      remove();
      void play();
    };
    // Try immediately (often blocked on a cold load); if it took, we're done.
    void play().then(() => {
      if (audioRef.current && !audioRef.current.paused) { started = true; remove(); }
    });
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    return remove;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  // Visualizer — frequency bars driven by the analyser.
  useEffect(() => {
    let raf = 0;
    let data: Uint8Array | null = null; // allocated once, not per frame
    const canvas = vizRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d")!;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      if (!analyser) return;
      const bins = analyser.frequencyBinCount;
      if (!data || data.length !== bins) data = new Uint8Array(bins);
      analyser.getByteFrequencyData(data);
      const n = Math.min(bins, 28);
      const gap = 2;
      const bw = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const v = data[i] / 255;
        const bh = Math.max(1, v * h);
        const x = i * (bw + gap);
        const grad = ctx2d.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, "#5ad0c0");
        grad.addColorStop(1, "#9b7cff");
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(x, h - bh, bw, bh);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const track = tracks[index];

  return (
    <div className="mb-player">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onEnded={next} crossOrigin="anonymous" preload="auto" />
      <canvas ref={vizRef} className="mb-viz" width={176} height={40} />
      <div className="mb-meta">
        <div className="mb-title">{track ? track.title : "—"}</div>
        <div className="mb-artist">{track?.artist ?? "music only · no ads"}</div>
      </div>
      <div className="mb-controls">
        <button type="button" onClick={prev} aria-label="Previous">⏮</button>
        <button type="button" className="mb-play" onClick={() => (playing ? pause() : play())} aria-label="Play/Pause">
          {playing ? "❚❚" : "►"}
        </button>
        <button type="button" onClick={next} aria-label="Next">⏭</button>
        <input
          className="mb-vol"
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}

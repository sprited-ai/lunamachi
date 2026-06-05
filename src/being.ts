// A single "mini-being": one generated character rendered as a sprite that
// wanders the white room's floor band. Loads the character's pixel spritesheet +
// manifest (the TexturePacker/Pixi entity_pixel.json the pipeline emits) and an
// optional alpha-cropped reference image used as a static "rest pose".
//
// Sprite loading mirrors the app's approach in src/playground.tsx (Spritesheet →
// per-frame-duration AnimatedSprite). The room logic is an idle/walk/greet/pose
// state machine plus optional pseudo-perspective. All tunables come from the
// shared `cfg` (the Tab debug panel mutates it) and are read live each frame.

import { AnimatedSprite, Assets, Container, Graphics, Sprite, Spritesheet, Texture, type Ticker } from "pixi.js";
import { cfg } from "./config";

interface SheetData {
  meta: { image: string; size: { w: number; h: number }; scale: string };
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; duration: number }>;
  animations: Record<string, string[]>;
}

type AnimName = "idle" | "run" | "greet";
type BeingState = "idle" | "walk" | "greet" | "pose";

// The character's feet sit above the cell's bottom edge (transparent padding).
const FOOT_ANCHOR = 0.88;
// The character fills ~0.67 of its cell height (and the reference is alpha-cropped
// to the character) — used to render the reference pose at the sprite's height.
const CELL_CHAR_FRAC = 0.672;

function framesWithDuration(textures: Texture[], sheet: SheetData, anim: string) {
  return sheet.animations[anim].map((name, i) => ({ texture: textures[i], time: sheet.frames[name].duration }));
}

function makeSprite(frames: Array<{ texture: Texture; time: number }>, loop: boolean) {
  // autoUpdate:false — we advance the visible sprite from the app ticker in
  // update(), so animations never depend on Pixi's separate Ticker.shared.
  const sprite = new AnimatedSprite({ textures: frames, autoUpdate: false });
  sprite.anchor.set(0.5, FOOT_ANCHOR);
  sprite.loop = loop;
  sprite.visible = false;
  return sprite;
}

export interface BeingOptions {
  hasRef?: boolean;
}

export class Being {
  readonly id: string;
  readonly container = new Container();
  x = 0;
  y = 0;

  private readonly sprites: Record<AnimName, AnimatedSprite>;
  private current!: AnimatedSprite;
  private ref: Sprite | null = null;
  private readonly shadow: Graphics;
  private state: BeingState = "idle";
  private facing: 1 | -1 = 1;
  private readonly frameH: number;

  private targetX = 0;
  private targetY = 0;
  private stateTimer = 0;
  private greetCooldown = 0;

  private constructor(
    id: string,
    sprites: Record<AnimName, AnimatedSprite>,
    ref: Sprite | null,
  ) {
    this.id = id;
    this.sprites = sprites;

    const frame = sprites.idle.texture;
    this.frameH = frame.height;

    // Base contact shadow at full size; scaled live by cfg.shadow each frame.
    this.shadow = new Graphics()
      .ellipse(0, -frame.height * 0.015, frame.width * 0.32, frame.width * 0.1)
      .fill({ color: 0x2a3344, alpha: 0.11 });
    this.container.addChild(this.shadow);
    for (const s of Object.values(sprites)) this.container.addChild(s);

    if (ref) {
      ref.anchor.set(0.5, 1);
      ref.scale.set((CELL_CHAR_FRAC * this.frameH) / ref.texture.height);
      ref.visible = false;
      this.container.addChild(ref);
      this.ref = ref;
    }

    this.showAnim("idle");
    this.enterRest();
  }

  static async create(baseUrl: string, id: string, opts: BeingOptions = {}): Promise<Being> {
    const manifest = await fetch(`${baseUrl}/${id}/entity_pixel.json`).then((r) => r.json());
    const sheetData: SheetData = manifest.textures[0];
    const texture: Texture = await Assets.load(`${baseUrl}/${id}/${sheetData.meta.image}`);
    texture.source.scaleMode = "nearest";

    const sheet = new Spritesheet(texture, sheetData as never);
    await sheet.parse();

    const sprites: Record<AnimName, AnimatedSprite> = {
      idle: makeSprite(framesWithDuration(sheet.animations.idle, sheetData, "idle"), true),
      run: makeSprite(framesWithDuration(sheet.animations.run, sheetData, "run"), true),
      greet: makeSprite(framesWithDuration(sheet.animations.greet, sheetData, "greet"), false),
    };
    sprites.greet.animationSpeed = 0.6; // the pixel greet is short — play it slower so the wave reads

    let ref: Sprite | null = null;
    if (opts.hasRef) {
      const refTex: Texture = await Assets.load(`${baseUrl}/${id}/reference.webp`);
      ref = new Sprite(refTex);
    }
    return new Being(id, sprites, ref);
  }

  /** Place within the floor band; call once before the first update. */
  spawn(roomW: number, roomH: number) {
    this.x = 40 + Math.random() * (roomW - 80);
    this.y = roomH * (cfg.floorTop + Math.random() * (cfg.floorBottom - cfg.floorTop));
  }

  // --- visuals -------------------------------------------------------------

  private hideAll() {
    if (this.current) {
      this.current.stop();
      this.current.visible = false;
    }
    if (this.ref) this.ref.visible = false;
  }

  private showAnim(name: AnimName) {
    if (this.current === this.sprites[name] && this.current.visible) return;
    this.hideAll();
    this.current = this.sprites[name];
    this.current.visible = true;
    this.current.gotoAndPlay(0);
  }

  private showRef() {
    this.hideAll();
    if (this.ref) this.ref.visible = true;
  }

  // --- state machine -------------------------------------------------------

  /** Pick a resting behaviour: mostly idle, occasionally a static pose or a greet. */
  private enterRest() {
    const r = Math.random();
    if (r < cfg.greetChance) {
      this.startGreet(() => this.restIdle());
    } else if (this.ref && r < cfg.greetChance + cfg.poseChance) {
      this.state = "pose";
      this.showRef();
      this.stateTimer = 1600 + Math.random() * 3600;
    } else {
      this.state = "idle";
      this.showAnim("idle");
      this.stateTimer = 700 + Math.random() * 3200;
    }
  }

  private beginWalk() {
    const room = this.lastRoom;
    const m = 40;
    this.targetX = m + Math.random() * (room.w - 2 * m);
    this.targetY = room.h * (cfg.floorTop + Math.random() * (cfg.floorBottom - cfg.floorTop));
    this.state = "walk";
    this.showAnim("run");
  }

  private startGreet(onDone: () => void) {
    this.state = "greet";
    this.greetCooldown = 7000;
    this.showAnim("greet");
    this.current.loop = false;
    this.current.onComplete = onDone;
  }

  /** One-shot greeting if resting and off cooldown (called on proximity). */
  greet() {
    if ((this.state !== "idle" && this.state !== "pose") || this.greetCooldown > 0) return;
    this.startGreet(() => this.restIdle());
  }

  /** Stand a beat (idle) after a greeting before wandering off. */
  private restIdle() {
    this.state = "idle";
    this.showAnim("idle");
    this.stateTimer = 600 + Math.random() * 1500;
  }

  private lastRoom = { w: 1, h: 1 };

  update(dtMs: number, roomW: number, roomH: number, ticker?: Ticker) {
    this.lastRoom = { w: roomW, h: roomH };
    const dt = dtMs / 1000;
    if (this.greetCooldown > 0) this.greetCooldown -= dtMs;

    // Advance the currently-visible animation off the app ticker.
    if (ticker && this.current && this.current.visible) this.current.update(ticker);

    if (this.state === "idle" || this.state === "pose") {
      this.stateTimer -= dtMs;
      if (this.stateTimer <= 0) this.beginWalk();
    } else if (this.state === "walk") {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        this.enterRest();
      } else {
        const depthSpeed = cfg.uniformSize ? 1 : 0.45 + 0.55 * this.depth(roomH);
        const step = Math.min(dist, cfg.speed * depthSpeed * dt);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        if (Math.abs(dx) > 0.4) this.facing = dx < 0 ? -1 : 1;
      }
    }

    // Safety: a looping anim (idle/run) should never be frozen — re-play if stopped.
    if ((this.state === "idle" || this.state === "walk") && this.current && !this.current.playing) {
      this.current.play();
    }

    const targetH = cfg.uniformSize
      ? cfg.height
      : cfg.minHeight + (cfg.maxHeight - cfg.minHeight) * this.depth(roomH);
    const scale = targetH / this.frameH;
    this.shadow.scale.set(cfg.shadow);
    this.container.x = this.x;
    this.container.y = this.y;
    this.container.scale.set(scale * this.facing, scale);
    this.container.zIndex = this.y; // lower in frame = drawn in front
  }

  /** 0 at the back of the floor band (vanishing line), 1 at the front. */
  private depth(roomH: number): number {
    const t = (this.y / roomH - cfg.floorTop) / (cfg.floorBottom - cfg.floorTop);
    return Math.max(0, Math.min(1, t));
  }
}

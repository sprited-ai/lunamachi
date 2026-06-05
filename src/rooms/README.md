# The room model

A little sibling of a *world model*: symbolic and deterministic, not neural. A
room is **authored as XML** (its source of truth), parsed into a typed `RoomSpec`
(the room's whole parameter space), and built into a live `Room`. Change the
spec → change the room. The seed lives in the deterministic engine layer, so a
room is reproducible from its spec.

```
*.room.xml  ──parseRoom──▶  RoomSpec  ──buildRoom──▶  Room  ──▶  main.tsx
 (authored)    (validate)    (data)      (render)     (live)
```

## Authoring a room

Drop a `<id>.room.xml` beside the others and add its id to
`rooms.manifest.json` (a plain list — also the order the portal cycles). No code
change: `index.ts` globs the folder and loads the rooms the manifest names.

Or generate one from a vibe — the existing rooms act as the style reference:

```
npm run gen:room -- "a rainy neon alley at midnight"
```

```xml
<Room id="moon" name="summer moon" accent="#b6a4ff" seed="7">
  <Vibe>watching a big beautiful moon together on a warm summer night</Vibe>
  <Palette skyTop="#070b1e" skyMid="#141b3c" horizon="#1d2550" ground="#14182f"/>
  <Background type="skyFloor"/>
  <Tuning population="70" speed="32" floorTop="0.62" height="120"/>

  <Moon at="0.72,0.2"/>
  <StarField count="110"/>
  <Fireflies count="16"/>
  <MagicCircle/>
</Room>
```

- **`<Room>`** — `id` (required), `name`, `accent` (portal/hint colour), `seed`
  (optional; omitted → derived from `id`).
- **`<Vibe>`** — the room's mood in words. The human source of truth; one day the
  room model generates the rest *from* this.
- **`<Palette>`** — `skyTop`, `horizon`, `ground` (required), `skyMid` (optional).
  The backdrop is generated from these colours — no images (see PRINCIPLES.md).
- **`<Background type="…"/>`** — a named generator: `skyFloor` | `gallery`.
- **`<Tuning …/>`** — any field of `Config` (population, speed, floorTop, …),
  applied to the live config on entry.
- **component tags** — the in-world props, composed JSX-style.

Malformed rooms throw a clear error at load (unknown tag, bad colour, missing
attribute) rather than failing silently.

## Components

Each component is **one self-contained file** under `components/`, like a React
component: it owns its PascalCase `tag`, how to `parse` its attributes into a
typed prop, and (for visual props) how to `mount` itself into the scene under the
room's seed. Every file there that default-exports a `RoomComponent` is
**auto-registered** (`components/index.ts` globs the folder) — so the vocabulary
is an *open set*. No shared list or union to edit; `Prop` is an open base type.

| tag            | attributes                                  | how it was made |
| -------------- | ------------------------------------------- | --------------- |
| `<MagicCircle>`| — (the portal; engine-placed)               | hand            |
| `<Moon>`       | `at="fx,fy"`                                | hand            |
| `<StarField>`  | `count`                                     | hand            |
| `<Fireflies>`  | `count`, `band="lo,hi"`, `glow`, `color`    | hand            |
| `<Aurora>`     | `bands`, `hue`, `hue2`, `height`            | gen (opus)      |
| `<FirstSnow>`  | `count`, `color`, `sway`                    | gen (opus)      |
| `<NightRain>`  | `count`, `tilt`, `color`                    | gen (opus)      |
| `<Particles>`  | `shape`, `motion`, `count`, `band`, `color`, `glow`, `size`, `length`, `tilt`, `sway`, `twinkle`, `depth` | data primitive |

(The gen ones carry a reproducible recipe header — prompt + model — in their file.)

**`<Particles>` is a data-driven primitive** — one component that expresses a
whole family of ambient props by attribute, so a new particle effect is *data,
not code*: `shape` ∈ dot/glow/line, `motion` ∈ fall/rise/drift/still. Snow, rain,
fireflies, stars, dust, and embers all reduce to a `<Particles>` config (see its
file header). This is the first step toward components-as-data; hand/gen code
components remain the escape hatch for shapes particles can't express.

**Adding a component by hand:** drop `components/<Tag>.ts` default-exporting a
`RoomComponent`. Draw with Pixi `Graphics`/`Container` or reuse the `shared.ts`
primitives; use `ctx.rng` for all randomness (so the layout is seed-reproducible).
It's usable in any room's XML immediately.

**Adding a component by prompt** — the same way you author a room:

```
npm run gen:component -- "북극광이 천천히 흐르는 오로라" --room moon
```

Claude authors the procedural component from the prompt, wires its `<Tag/>` into
the target room, and gates on a clean `npm run build`; on failure it feeds the
build errors back and retries, else reverts. Add `--commit` to push to `main`,
`--deploy` to ship. A reproducible recipe (prompt + model + date) is stamped into
the file header. Needs `ANTHROPIC_API_KEY` in `.dev.vars` (see `.dev.vars.example`).

**Two generation paths — code vs data:**

```
npm run gen:component -- "<vibe>" --room <id>   # code-gen: a new component .ts
npm run gen:particle  -- "<vibe>" --room <id>   # data-gen: a <Particles .../> config
```

`gen:component` writes a procedural **code** component (build-gated, can self-repair)
— the escape hatch for shapes a particle system can't express. `gen:particle` asks
the model for a `<Particles .../>` element (**data** conforming to the existing
component's schema) and injects it — no new file, no build gate, no self-repair,
because the engine already renders any valid config. Data-gen is safe and instant,
and the same call could run in-app (it never produces code to compile).

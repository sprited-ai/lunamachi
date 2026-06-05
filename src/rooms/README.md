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

Drop a `<id>.room.xml` beside the others and register it in `index.ts` (one
import + one array entry — that array is also the order the portal cycles).

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

Each component (`components.ts`) is self-contained, like a React component: it
owns its PascalCase `tag`, how to `parse` its attributes into a typed prop, and
(for visual props) how to `mount` itself into the scene under the room's seed.

| tag            | attributes                                  |
| -------------- | ------------------------------------------- |
| `<MagicCircle>`| — (the portal; engine-placed)               |
| `<Moon>`       | `at="fx,fy"`                                |
| `<StarField>`  | `count`                                     |
| `<Fireflies>`  | `count`, `band="lo,hi"`, `glow`, `color`    |

**Adding a component:** write a `RoomComponent` (`tag` / `type` / `parse` /
optional `mount`), add it to `COMPONENTS`, and add its prop shape to the `Prop`
union in `types.ts`. Rooms can use the new tag immediately. The drawing itself
goes in `shared.ts` (the no-asset primitives) and the component wraps it.

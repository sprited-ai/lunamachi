# Contributing to lunamachi

lunamachi rooms are built from an **open vocabulary of components** — little
procedural props (`<Moon/>`, `<Fireflies/>`, `<Aurora/>` …) composed into rooms
written in XML. You can grow that vocabulary. You **add to the vocabulary; you
don't change the schema.**

## Two ways a component is born

1. **In-app / automated** — easy props can be summoned from a prompt
   (`npm run gen:component`, or eventually in-app). Build-gated, lands directly.
2. **By you, in the repo** — anything richer: check the repo out and build it
   with your favourite tool (**Claude Code**, your editor, whatever), then open a
   **Pull Request**. This is the path for components the automated flow can't do.

## Adding a component (the contributor path)

```bash
git clone https://github.com/sprited-ai/lunamachi
cd lunamachi && npm install
```

1. Create `src/rooms/components/<YourTag>.ts` — one self-contained file that
   default-exports a `RoomComponent`. Draw it procedurally with Pixi
   `Graphics`/`Container` (or reuse `src/rooms/shared.ts`). **No image assets.**
   Use `ctx.rng` for all randomness so the layout is reproducible from the seed.
   See [`src/rooms/README.md`](src/rooms/README.md) for the full contract and
   `src/rooms/components/Fireflies.ts` for a worked example.
2. Use it: add your `<YourTag .../>` to a room's `*.room.xml` — or make a new room
   (drop `<id>.room.xml` and add its id to `src/rooms/rooms.manifest.json`).
3. `npm run build` must pass.
4. Open a PR.

Tip: in your clone, just point Claude Code at the repo —
"read `src/rooms/README.md` and add a `<Rain/>` component" — it has everything it
needs in `README.md`, `types.ts`, `shared.ts`, and the existing components.

## What's locked (and why)

The **schema and engine** are owner-reviewed (see `.github/CODEOWNERS`):
`types.ts`, `parse.ts`, `build.ts`, `coerce.ts`, `config.ts`, the registry, the
app shell, and build/deploy config. Components conform to that schema, so leaving
it fixed keeps every contribution safe and composable. PRs that only add a
component (and use it in a room) are the easy, fast path.

If you think the schema itself needs to change to express your prop, open an
issue first — that's a conversation, not a drive-by edit.

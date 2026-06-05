# Design principles

## No assets — every prop is procedurally generated

There are **no bundled art assets** for props, scenery, effects, or UI. Every
visual element of a room — the moon, stars, fireflies, the floor, a magic
circle, a railing, glows, the music player chrome — is **generated in code**
(Pixi geometry, gradients, math). No PNGs, SVGs, textures, icon files, or
pre-drawn images for any of it.

If you need a thing in a room, **draw it procedurally**. Want a lantern? Build it
from shapes. Want a portal? Compose rings, runes, and star polygons in code (see
`src/portal.ts`). Want a night sky? Place stars with a seeded RNG.

**Why:** rooms stay tiny to ship, infinitely tweakable (every parameter is a
number you can expose to the Tab debug HUD), and visually coherent. The world is
defined by code, not by an `assets/` folder someone has to maintain or license.

### The one exception: generated content (characters, music)

The little beings (`public/beings/`) and the lo-fi tracks (`public/music/`) are
files, not procedural code — they're the exception. But they **don't break the
spirit** of "no assets": they are themselves *generated* — the characters by the
sprite-dx AI pipeline, the music by AI — not hand-authored or licensed art. Treat
them as generated content that happens to be cached as files.

So the rule is really: **nothing hand-drawn or licensed. Props are procedural;
content is generated.**

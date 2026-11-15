# Maintaining

For people who review and merge changes to this repo. `CONTRIBUTING.md` covers how to send one.

## What lives where

| Part | Where | Notes |
|---|---|---|
| Engine | `core/` | Slide frame, steps, controls, the resolution preview and the plugin API |
| Components | `components/<name>/` | One folder each; `npm run build` bundles them |
| Patterns | `slides/` and `slides/index.json` | Each has a layout tag; the catalog shows them all |
| Templates | `templates/<name>/` | Tokens in `docs/styles.md` |
| Tools | `tools/` | `new`, `add`, `outline`, `export`, `upgrade`, `build`, `qa`, `lint`, `perf`, `inline`, `route`, `showcase` |
| Agent skills | `skills/` | Linked as `.claude/skills` and `.agents/skills`. `DECK_SKILLS` in `tools/lib.mjs` lists the ones that standalone decks get |
| Generated | `components/components.*`, `examples/catalog/`, `examples/index.html`, `docs/agent-index.md`, `docs/showcase/` | Never edit by hand |

## Review a change

- Run `npm run build -- --check`, `npm run qa` and `npm run lint`. QA must report no problems.
- Read the catalog screenshots of the slides that changed, in a light and a dark template, at 1920×1080 and 390×844.
- A new pattern needs a `data-layout` that matches `slides/index.json`, a row in `docs/slides.md` and the README pattern count.
- A new drawn component goes into the drawn lists in `tools/lint.mjs`, `tools/qa.mjs` and the docs. Search for `.composer` to find them.
- A change to `core/`, `tools/qa.mjs` or a standalone tool: make a deck with `npm run new` in a scratch folder, then run its `qa`, `lint`, `inline` and `route`.
- A change to the agent guide or a skill: read it as an agent would. Each skill points to the docs and does not copy them.
- For a large change, ask a reviewer, or a model from a different lab than the one that wrote it.

## Merge

- Squash-merge, with the PR number in the subject.
- Stacked PRs: merge in dependency order, and rebase each one onto `main` before you merge it.
- Conflicts in generated files: take `main`'s side, then run `npm run build`. Conflicts in the README pattern count or the pattern table: keep both rows and fix the count.
- A pattern from before the layout tags needs a `layout` in `slides/index.json` and the same `data-layout` on its `<section>`.

## Phones and browsers

Decks are opened on phones far more than you expect, from the QR code on the close slide.

- iOS Safari reports the zoomed, visible area in `innerWidth` and `innerHeight`. Measure the layout with `document.documentElement.clientWidth` and `clientHeight`.
- With `resolution` or `?res=`, the deck runs inside a frame on a host page. The frame cannot see the host's pinch zoom; it asks `Deck.previewZoomed()` on the host.
- Safari will not zoom out below 0.25×. A 1920-wide preview fits natively only on screens at least 480 points wide.
- The iOS simulator uses the Mac's graphics memory. A blank or black screen on a real phone may not show in the simulator, so test on a phone.
- Pinch-zoom and drag on slides with embeds, video and animation before a release.

## Performance

A deck runs for an hour on a laptop or a phone battery. Hidden slides pause their animations and stop painting. Run `npm run perf` on the examples after a change to `core/` or to a component that moves. `docs/performance.md` lists the usual causes.

## Standalone decks

`npm run new` and `npm run export` copy the library into `site/lib/`, the tools into `tools/`, the agent guide into `AGENTS.md`, and the deck skills into `skills/`. These copies do not change when this repo changes. `npm run upgrade -- <deck>` shows what a refresh would change, and `--write` applies it. It never touches the deck's `index.html`, `PRESENTER.md` or assets.

## Harvest from decks

Real talks build widgets and find bugs that the library does not have yet. After a talk, use the `deck-harvest` skill to bring the reusable parts back.

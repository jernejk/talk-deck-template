---
name: deck-slides
description: Add, change, reorder or remove slides in a talk deck from this repo. Use when the user asks to "add a slide", "turn this into a before-after slide", "change slide 7", "make this a chart", "pick a better layout" or "rewrite the titles". Covers how to pick a pattern, npm run add, the slide anatomy and the components.
---

# Add and change slides

Run the `npm run` commands from the template repo. `<deck>` is a deck folder in `examples/` or anywhere else. A standalone deck has only `npm run qa`.

## Read first

- `docs/agent-index.md`: one line for each pattern and component, grouped by layout. Pick from this file.
- `AGENTS.md`, sections "Rules" and "Slide anatomy". This is the markup and every `data-` attribute.
- Only the files of the pattern you pick: `slides/<name>.html`, and the rows of its components in `docs/components.md`.

To see a pattern, open `docs/showcase/README.md` or `examples/catalog/index.html`. Do not read all of `docs/slides.md` or `docs/components.md`.

## Steps

1. Find the slide and its neighbours in the deck's `index.html`. Look at their `data-layout`.
2. Pick a pattern from `docs/agent-index.md` whose layout differs from the slides before and after it.
3. Add it. Do not copy it by hand:
   - `npm run add -- <deck> <pattern>` puts it before the close slide.
   - `npm run add -- <deck> <pattern> --after <id>` or `--before <id>` puts it at a given position.
   - `add` keeps ids unique and copies the assets of the pattern.
4. Change the text. Replace each line of placeholder copy. Keep the anatomy:
   - an eyebrow, then a title of one or two lines with one `<em>` on the payoff;
   - curly quotes and apostrophes in slide text;
   - colours from `var(--a1)` to `var(--a6)` only. Fixed colours go only in drawn mock-ups.
5. Make a slide that needs a third title line into two slides.
6. Use `data-step` for reveals. Give elements that reveal together the same name.
7. Set the clock in the notes. Use `deck-notes` for the notes, and `deck-media` for screenshots and live demos.
8. Check the slides you changed: `npm run qa -- <deck> --slides <ids> --fast`, then read the screenshots in `qa/`.

To remove a slide, delete its `<section>`. To move a slide, move its `<section>`. Then run `npm run route -- <deck>` to refresh `PRESENTER.md`.

## Done when

- `npm run lint -- <deck>` gives no new `one-em`, `curly-quotes`, `fixed-colour` or `layout-variety` warnings.
- `npm run qa -- <deck> --slides <ids>` reports no problems, and you read each screenshot.
- Before you call the deck done, use `deck-check`.

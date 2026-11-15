---
name: deck-plan
description: Plan a new talk deck and build its first draft in this talk-deck repo. Use when the user asks to "make a talk about…", "start a new deck", "plan an N-minute talk", "turn this outline into slides" or "scaffold a deck". Covers the outline, npm run outline or npm run new, the agenda and duration, layout variety, and a fan-out plan for long decks.
---

# Plan a deck

Use this skill to go from a topic to a deck with real titles, sections and clocks. Write the slide text after this, with `deck-slides` and `deck-notes`.

Run the `npm run` commands from the template repo. `<deck>` is a deck folder in `examples/` or anywhere else. A standalone deck has only `npm run qa`.

## Read first

- `docs/agent-index.md`: every pattern, grouped by layout. Pick patterns from this file. Do not read all of `docs/slides.md`.
- `docs/slides.md`, section "From an outline": the outline format.
- `AGENTS.md`, sections "Rules" and "Slide anatomy".

## Steps

1. Get the facts from the user: audience, duration, the parts of the talk, the template, and the demos. Ask when one is missing.
2. Write the outline as JSON. Give each slide a `pattern`, a `title` (`*…*` marks the `<em>`), a `section`, `minutes` and, if you need it, an `id`.
3. Use a different layout on neighbouring slides. `docs/agent-index.md` gives the layout of each pattern.
4. Make the deck folder. Use a temporary pattern list, because `outline` replaces it:
   - Standalone: `npm run new -- ~/talks/my-talk --template paper --title "My talk" --speaker "Name" --url https://my-talk.example.com`
   - In this repo: `npm run new -- examples/my-talk --template paper --title "My talk"`
   - `--url` sets the close link and `CNAME`. It also makes the QR code, but only on macOS. On other systems, `new` removes the sample QR and exits with code 1. QA then fails until you add `assets/qr-slides.png` (`deck-publish`).
5. Preview the plan: `npm run outline -- ~/talks/my-talk outline.json --dry-run`. Fix each warning about layouts that repeat, clocks past `duration` and ids that are taken.
6. Write the slides: `npm run outline -- ~/talks/my-talk outline.json --force`. This sets ids, titles, sections, clocks, `duration` and the agenda (with `"agenda": true`).
7. Check that `#deck-config` has the `agenda` and `duration` you need. `AGENTS.md` lists the keys.
8. Paste the route table that `outline` prints into `PRESENTER.md`, or run `npm run route -- ~/talks/my-talk`.

For a short deck with no outline, use `npm run new -- <dir> --title "…" --slides cover,agenda,statement,takeaways,close`. Use `npm run add -- --list` to see every pattern name.

## Long decks

For more than about 12 slides, fix the shared inputs first, then give one agent each section of 3 to 6 slides. Read `fanout.md` in this folder.

## Done when

- `npm run outline -- <deck> outline.json --dry-run` gives no warnings that you did not accept.
- Each slide has a title, a section and a clock, and the clocks fit `duration`.
- `npm run lint -- <deck>` shows no `layout-variety` warnings.
- Then use `deck-slides` for the slide text, and `deck-check` before you call the deck done.

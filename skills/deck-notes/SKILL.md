---
name: deck-notes
description: Write speaker notes, clocks, presenter extras and PRESENTER.md for a talk deck from this repo. Use when the user asks to "draft the notes", "fix the timings", "add clocks", "prepare for questions", "add an extra slide for Q&A", "help me rehearse" or "update PRESENTER.md". Covers clocks in talk order, p.live and p.src, data-hidden extras, npm run route and the honesty ledger.
---

# Notes, timings and PRESENTER.md

Run the `npm run` commands from the template repo. `<deck>` is a deck folder in `examples/` or anywhere else. A standalone deck has only `npm run qa`.

## Read first

- `AGENTS.md`, section "Rules": the notes, extras and numbers rules.
- The deck's `PRESENTER.md`. Its template is `docs/presenter.md`.

## Steps

1. Open each note with the clock of the slide, then the line to say: `<p><b>2:20–3:20.</b> “The line to say.”</p>`.
2. Keep the clocks in talk order. Each clock starts at or after the end of the clock before it. The rehearsal timer (T) and `npm run lint` read the first `m:ss–m:ss` in a `<b>`.
3. Make the last clock fit `duration` in `#deck-config`.
4. Use `<p class="live">` for a live cue, with the 20-second cap. Use `<p class="src">` to tell where the content came from.
5. Write only what you can show on a slide. The notes ship in the public HTML. Do not write private links, IDs, emails, `localhost` or tokens.
6. Quote only numbers that someone measured. Mark each gag as a gag.
7. Add a presenter extra for each question that you expect:
   - `npm run add -- <deck> x-cost` (or another `x-` pattern from `docs/agent-index.md`);
   - the extra has `data-hidden` and no clock;
   - H shows the extras, and O lets you pick one.
8. Refresh the tables: `npm run route -- <deck>`. This keeps the cues that you wrote by hand. `npm run route -- <deck> --check` only reports if the tables are stale.
9. Fill in `PRESENTER.md` by hand: the time budget, "What's real" (real runs, drawn cards, gags), the extras ("Use when"), the reset steps for each live demo, and the privacy notes.

## Rehearse

Open the deck and press T. The timer compares your pace with each clock and with `duration`. Move the clocks to match how you really talk, then run step 8 again.

## Done when

- `npm run lint -- <deck>` gives no `clock-order`, `live-cap` or `private-data` warnings.
- `npm run route -- <deck> --check` says that `PRESENTER.md` is up to date.
- You read the notes as a stranger: nothing private, and each drawn illustration has a disclosure.

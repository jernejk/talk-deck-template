---
name: deck-check
description: Check a talk deck from this repo before you call it done. Use when the user asks to "run QA", "check the deck", "is it ready", "is it done", "lint the slides" or "show me the screenshots". Covers npm run qa with --slides, --fast, --jobs and --theme, the contact sheets, npm run lint and its check ids, the screenshot review and the done gate in AGENTS.md.
---

# Check a deck

In the template repo, run the `npm run` commands from the repo root. `<deck>` is a deck folder in `examples/` or anywhere else. In a standalone deck, run them in the deck folder and leave out `<deck>`: it has `qa`, `perf`, `lint`, `inline` and `route`. `add`, `new`, `outline` and `export` need the template repo.

## Read first

- `AGENTS.md`, section "Before calling a deck done". This is the gate.
- `tiers.md` in this folder: which checks to run now, which can wait until the batch is done, and the pending record that keeps track of them.
- README, sections "Check it" and "Content lint": the QA flags and the lint check ids. Read them only when a result is not clear.

## While you work

Check only the slides that you changed. This is fast:

```sh
npm run qa -- <deck> --slides cover,3-5 --fast
npm run lint -- <deck>
```

- `--slides` takes ids or numbers. Normal runs keep full-deck `file://` and keyboard checks; `--fast` defers both with explicit pending rows.
- `--fast` checks only the first size, defers offline/keyboard gates, and writes no normal screenshots (QR is the exception). It cannot clear final acceptance; its receipt names the pending gates.
- `npm run lint` takes about a second and makes no screenshots.

## Before you finish

1. Run QA on the full deck: `npm run qa -- <deck>`. In a standalone deck, run `npm run qa` in the deck folder. In this repo, `npm run qa` with no deck checks every example, the catalog in every template and the build.
2. Add `--theme <name>` to check the deck in a different template. Add `--sizes 1280x720,430x932` for other sizes. Add `--jobs 1` if the machine is slow.
3. Fix each item under `problems` in the JSON output. QA fails on overflow, broken media, failed requests and console errors.
4. Read each item under `warnings`. Fix it, or know why it stays. The check ids are `clock-order`, `live-cap`, `one-em`, `curly-quotes`, `private-data`, `drawn-disclosure`, `fixed-colour` and `layout-variety`.
5. Read only the current receipt’s `artifactRoot` and listed artifact paths for each slide you changed, in every shipped template. Each invocation has a fresh `qa/runs/<run-id>/` directory; its contact sheets sit beside its template folders. Do not glob historical `qa/` images. `npm run qa -- <deck> --status --out <same root>` checks current full evidence without launching browsers.
6. QA finds layout bugs, not ugly slides. In each screenshot, look for:
   - text that is too small for the back row, or a title on three lines;
   - content cut off at an edge, or too close to the footer;
   - items that do not line up;
   - two neighbouring slides that look the same;
   - a logo that is wrong, out of date, or clashes with its background;
   - a photo or drawing of a person that they would not like;
   - a caption without a label, or a crop that shows something private;
   - colours that are hard to read.
   Fix these before the presenter sees the deck. They must not be the first to find them.
7. Fix, then run step 1 again.

## Done when

All the steps in `AGENTS.md` "Before calling a deck done" are true:

- `npm run qa` reports no problems, and you read the warnings.
- You read the screenshots of each slide that you changed, from a full run.
- Every check you put off has passed, with its evidence in `PENDING.json`, or is listed as outstanding (`tiers.md`).
- If the URL changed, the QR, `.qr-url` and `CNAME` match it (`deck-publish`).
- The notes have nothing private, and each drawn illustration has a disclosure.
- `PRESENTER.md` is current: route, timings, what is real and the extras (`deck-notes`).

---
name: deck-perf
description: Find and fix what makes a talk deck run hot, drain a phone's battery, stutter or lag. Use when the user says "my phone gets hot on the slides", "the deck is laggy", "check deck performance", "why is the fan spinning", or before publishing a deck with animations, embeds or video. Covers npm run perf, its flags, the usual causes in docs/performance.md and a real-device check.
---

# Diagnose deck performance

In the template repo, run the `npm run` commands from the repo root. `<deck>` is a deck folder in `examples/` or anywhere else. In a standalone deck, run them in the deck folder and leave out `<deck>`: it has `qa`, `perf`, `lint`, `inline` and `route`. `add`, `new`, `outline` and `export` need the template repo.

## Read first

- `docs/performance.md`: what the columns mean, when a slide is flagged, and the common causes and fixes.

## Steps

1. Measure: `npm run perf -- <deck>`. Add `--size 390x844` for a phone viewport, and `--slide <id or number>` to look at one slide. Run it alone: QA, demo checks or other browsers at the same time make the numbers noise.
2. Fix anything flagged as running off-slide first. Every slide pays for it.
3. Then fix `repaints:` lines over a large share of the screen: a looping animation of anything but `transform` or `opacity`. Draw the effect once on its own element and move that element instead, as the core glow and the close slide's QR ring do. `steps()` is not a fix: it still recalculates style every frame and looks choppy.
4. Then look at slides over the `main%` or `all%` limits, or flagged for style recalcs, and decide whether that cost is the point of the slide (a live graph, a playing replay) or a leak. Name a running animation in the browser console on that slide: `document.getAnimations().filter(a => a.playState === "running").map(a => [a.animationName, a.effect.target])`.
5. Fix it in the deck. If every deck would hit it, fix it in `core/` or `components/`, then run `npm run build`.
6. Run `npm run perf -- <deck>` again and compare the slides you touched. Then run `deck-check`.

## Done

- No slide is flagged for off-slide work or a large repainting loop. Every other flag has a reason you can name.
- Long idle is covered by the core's idle rest (looping motion pauses after 90 s without input); script-driven loops honour `.is-resting` on the root.
- Tell the user the before and after numbers for each slide you changed. Say they come from desktop Chromium. Phone heat and pinch-zoom need a real phone: Safari's Develop menu, then a Timelines recording.

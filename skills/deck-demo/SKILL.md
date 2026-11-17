---
name: deck-demo
description: Plan and build the demo beats of a talk deck so that they always work. Use when the user says "add a demo", "simulate the app", "show how it works without a live demo", "animate the agent run", "embed the site", "add the video", "replay the run", "what if the wifi dies", or when a live beat needs a fallback. Covers live demos, recorded clips, replays, drawn mock-ups and animated simulations, with their fallbacks, disclosures and performance.
---

# Demos that always work

A demo proves the talk's idea. It must work on a bad network, on a strange laptop and on a phone.

## Read first

- `AGENTS.md`, section "Rules": live beats, captions and drawn illustrations.
- `docs/agent-index.md`: the patterns that hold a demo.
- `docs/motion.md` if the demo moves.

## Pick the kind

| Kind | Use it when | How |
|---|---|---|
| Live | the room must see it is real, and you can reset it | `live-demo` or `try-it` (`embed`), `data-live`, a screenshot fallback and a 20-second cap |
| Recorded clip | the real thing is slow, unreliable or needs sound | `video` or `player`, a poster frame, a **Real run** caption |
| Replay | a long run, shown in a minute | an HTML page in the deck that plays the run on a clock, shown with `embed` |
| Drawn | the shape matters more than the pixels | `.threads`, `.mock`, `.composer`, `.cli`, with a **Drawn** caption |
| Animated simulation | a sequence: ask, wait, result | drawn components with `data-step`, or a small plugin (`docs/motion.md`) |

## Rules

1. Each live beat has its screenshot on the same slide, a 20-second cap in the notes and a reset step in `PRESENTER.md`.
2. A simulation says that it is one: "Demo · a simulated run" in the eyebrow, or **Drawn** in the caption. Put real words and real screenshots from the run inside it, where you have them.
3. Let Space drive each step, so that the speaker sets the pace. Do not use timers that run past the slide.
4. Start motion only when its slide and reveal step are visible. Stop it on `unstep` as well as `leave` (`Deck.use`); re-revealing a plain video restarts it. Hidden slides and reversed steps must not run media, timers or loops.
5. Do not ship secrets. Embedded pages and replays ship with the deck: no tokens, `localhost`, private IPs or private data.
6. Demo controls own their keys and touch gestures. For a custom editor or interactive region, put `data-deck-interactive` on its local container; the deck leaves keyboard and swipes there to the app. Do not put it on the whole slide. Click or Tab outside that region to hand slide keys (including PageDown/PageUp clickers) back to the deck.
7. Local video patterns use `preload="none"` and a poster. Choose eager loading only for an imminent clip after checking its network cost. Test a trimmed clip from a cold start, then reverse and revisit it. Plain clips still accept slide swipes; native/custom players keep their control gestures. If autoplay is refused, plain clips expose native play controls.
8. Keep fixed colours inside the drawn mock-up only. Use palette slots everywhere else.

## Build a simulated app

1. Start from a drawn component: `.threads` for an agent app, `.mock` for cards and tiles, `.composer` for a prompt, `.cli` for a terminal.
2. Write the beats as a list, one per Space. For example: the ask, the reply, the tool call, the result.
3. Put each beat in its own `data-step`. Give elements that appear together the same step name.
4. Use the real wording from the run.
5. Run `npm run qa -- <deck> --slides <id> --motion` and read the screenshots.
6. Run `npm run perf -- <deck> --slide <id>`, with nothing else running.

## Build a replay

1. Build the page with a script. Copy each page or data file it reads from outside the deck into the deck, record its hash, and refresh that copy only on purpose, after reading the diff. A timing edit must never pull in someone else's changes.
2. Give the builder a check that rebuilds in memory and compares with the built page. Never fix the built page by hand: change the builder, rebuild, and read the diff.
3. Give the replay a way to seek and to report its state (playing, how far, done), so checks wait for states instead of timers. Give each wait a limit that fails with a clear message.
4. Seeking proves a state, not smoothness. Keep one real-time pass for the motion, run alone.

## Test where it will run

- Open the deck at the projector size (`?res=1920x1080`). Expand each embed, and press each step.
- On a phone, pinch-zoom on the demo slide and drag around. The slide must not change and the screen must not go blank.
- Turn the network off, and check that each live beat falls back to its screenshot.

## Done when

- `npm run lint -- <deck>` gives no `live-cap`, `drawn-disclosure` or `private-data` warnings.
- `npm run qa -- <deck> --slides <ids>` reports no problems, and you read the screenshots.
- `npm run perf -- <deck>` flags no work on slides that are not showing.
- `PRESENTER.md` lists each demo, its fallback and its reset step.
- If you built the same kind of simulation twice, tell the user. It can go into the library (`deck-harvest`, in the template repo).

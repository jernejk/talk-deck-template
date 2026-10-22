# How the ledger works. One event at a time.: presenter guide

Target: not published yet; the QR and `.qr-url` still point at example.com/slides.

Architecture walkthrough · Team brown bag, Monday 7 December 2026. A fictional walkthrough of the append-only event ledger behind a pantry app, for teammates who use the app but have not read the ledger code.

Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

9 main slides plus 2 extras. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
| 1 | How the ledger works. One event at a time. | 0:00–0:20 | Slide | The app stores events, never stock |
| 2 | Three parts | 0:20–1:00 | Slide | Shape, reads, writes |
| 3 | Part two: the read path | 3:00–3:15 | Slide | Nothing in part two mutates |
| 4 | Planned events change nothing | 3:15–4:30 | Slide | Space ×2: Planned, then Consumed |
| 5 | The one function that matters | 4:30–5:30 | Slide | Read the highlighted line; Space → the rule |
| 6 | Four steps, no updates | 9:00–10:30 | Slide | Say the screens are drawn |
| 7 | Replay the whole log | 10:30–11:30 | Slide | Let it scroll; don’t narrate every line |
| 8 | What to remember on Monday | 11:30–12:30 | Slide | One row per breath |
| 9 | Thank you | 12:30–15:00 | Slide | Space → the stamp; leave up for questions |

Budget: the shape to 3:00, the read path to 9:00, the write path to 12:30, close by 15:00. Slides 2 and 3 cover the gap from 1:00 to 3:00 with talk, not slides. Skip slide 7 (replay) first if you run long.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

- **Real runs:** none. Every image in this deck is a sample illustration shipped with the template, and every caption says "Drawn".
- **Drawn illustrations:** the fan of three screens (slide 6), the scrolling replay log and its inset (slide 7), the planned-state screen (extra: honest limits). The code on slide 5 is trimmed from a fictional `fold.ts`; the notes say what was cut.
- **Gags, not measurements:** the ledger quantities on slide 4 and the incident times on the extra are made up for the story. Replace them with your own log before quoting any of them.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
| The bad compaction, replayed | “What happens when a projection is wrong?” |
| Honest limits | “Does it really work?” or any question about transactions, deletes or compaction |

## Controls

Arrow keys, Space or PageDown move forward, including step reveals. Left or PageUp goes back. N toggles notes, O opens the overview, H toggles extras, C jumps to the close, T opens the rehearsal timer, Home goes to the title and F requests fullscreen (use the browser menu if it's denied). Click any screenshot to enlarge it, and Esc to close. Each slide's footer shows "● Live: …" where a switch is possible.

## Before the talk

1. Open the live deck once so it's cached. It is self-contained and also runs offline from its `index.html`.
2. Reset every live demo to a known state, and write the reset command here.
3. Check the usage limits of anything you'll call live, and stop rehearsing it in the hour before your slot.
4. Turn on Do Not Disturb, check projector readability and keep the screenshots folder open.

## Privacy

Published images are copies in `assets/`, cropped from originals kept elsewhere. Record what each crop removes: tab strip and URL bar (IDs), sidebars (chat and project titles), avatars, emails and prices. Use clearly marked mock data for anything personal. Before publishing, search the notes and alt text for URLs, IDs, emails and street names.

## Verification

Run `npm install` once, then `npm run qa`. It renders every slide with all steps revealed at 1920×1080 and 1280×720. It checks for overflow past the footer or edges, broken images and videos, failed requests and console errors, opens the deck from `file://`, and exercises the keyboard controls. Screenshots land in `qa/`; look at the ones you changed.

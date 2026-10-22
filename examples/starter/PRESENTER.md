# Presenter guide: Big words. Real demos. Honest fallbacks.

Target: not published yet; the QR and `.qr-url` still point at example.com/slides.

Event name · Project showcase, Tuesday 20 October 2026. Write one line about the audience: who they are, what they already know, and what came before your slot.

Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

17 main slides plus 5 extras. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
| 1 | Big words. Real demos. Honest fallbacks. | 0:00–0:20 | Slide |  |
| 2 | Your Name | 0:20–0:40 | Slide |  |
| 3 | One idea per slide | 0:40–1:10 | Slide |  |
| 4 | Three parts | 1:10–2:00 | Slide |  |
| 5 | Here’s a real input | 2:00–2:20 | Slide |  |
| 6 | What did it actually say? | 2:20–3:20 | **Live:** Your app |  |
| 7 | Let the prompt type | 3:20–4:00 | Slide |  |
| 8 | Click once, watch it change | 4:00–5:00 | **Live:** Your app |  |
| 9 | Planning changes nothing | 5:00–5:40 | Slide |  |
| 10 | One evening | 5:40–6:20 | Slide |  |
| 11 | Real words beat paraphrase | 6:20–6:50 | Slide |  |
| 12 | One voice note, three mistakes | 6:50–7:20 | Slide |  |
| 13 | Four steps, no magic | 7:20–8:20 | Slide |  |
| 14 | Let long pages scroll themselves | 8:20–9:00 | Slide |  |
| 15 | Then you can push for more | 9:00–10:00 | Slide |  |
| 16 | Which one should you reach for? | 10:00–11:00 | Slide |  |
| 17 | Thank you | 11:00–15:00 | Slide |  |

Budget: write the time for each part here, and which slide you'll skip first if you run long. To rehearse, press T: the timer checks your pace against each slide's clock in the notes and the deck's `duration`.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

This sample deck has no real runs. Every image is a sample shipped with the template (`assets/sample/`), the cards are drawn, and every number is a placeholder. Replace them with your own, then fill in the list below.

- **Real runs:** which screenshots are real captures, the date they were taken and any timings.
- **Drawn illustrations:** which cards are drawn (`.mock`, `.composer`, `.memo`, `.cli`). Their captions and notes must say so.
- **Gags, not measurements:** anything played for a laugh, so you never quote it as data.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
| One evening, logged |  |
| Side by side |  |
| From just ask to real code |  |
| Honest limits |  |
| What it cost |  |

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

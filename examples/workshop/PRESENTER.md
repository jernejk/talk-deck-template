# Build a small agent. Tonight.: presenter guide

Target: not published yet; the QR and `.qr-url` still point at example.com/slides.

Event name · Developer walkthrough, Tuesday 20 October 2026. Write one line about the audience: who they are, what they already know, and what came before your slot.

Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

17 main slides plus 1 extra. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
| 1 | Build a small agent. Tonight. | 0:00–0:20 | Slide | Point at the list: five parts |
| 2 | Your Name | 0:20–0:40 | Slide | One breath, then the focus card |
| 3 | Tonight, in five parts | 0:40–1:00 | Slide | Part names, then how long it takes |
| 4 | Today | 1:00–1:20 | Slide | The lit block, then the one not to miss |
| 5 | One idea per slide | 1:20–2:00 | Slide | Pause after the line |
| 6 | Up next: the demo | 2:00–2:15 | Slide | Say where the code lives |
| 7 | One prompt, one run | 2:15–5:00 | **Live:** Your terminal | 20-second cap, then narrate the drawn run |
| 8 | A weak prompt and a useful one | 5:00–6:30 | Drawn prompts | Read the weak one aloud |
| 9 | Get the repo | 6:30–7:00 | Slide | Ten seconds on the QR, then say the path |
| 10 | Up next: how it works | 7:00–7:15 | Slide |  |
| 11 | The one line that matters | 7:15–8:00 | Slide | Read the lit line, then stop |
| 12 | An order moves through four stages | 8:00–9:00 | Slide | One sentence per Space |
| 13 | Then you can push for more | 9:00–10:00 | Sample images | Details live in the extras |
| 14 | Which one should you reach for? | 10:00–11:00 | Slide | One row per breath |
| 15 | Questions? | 11:00–14:00 | Slide | Ask the prompt question first |
| 16 | Follow along after tonight | 14:00–14:30 | Slide | One project, one number |
| 17 | Thank you | 14:30–15:00 | Slide | Space shows the sticker |

Budget: 15 minutes. The parts start at 1:20, 2:00, 7:00, 9:00 and 10:00, the same times as the `agenda` config, and questions get 11:00–14:00. If you run long, skip the stages slide first, then shorten questions. To rehearse, press T: the timer checks your pace against each slide's clock in the notes and the deck's `duration`.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

- **Real runs:** none. This is a template example, so nothing in it is a capture.
- **Drawn illustrations:** the terminal session, the two prompts, the code card and the speaker portrait are drawn, and the push-for-more screenshots are the template's sample images. The terminal caption says "Drawn".
- **Sample data:** the schedule, the follow-up numbers and every link are placeholders. Replace them before a real talk.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
| Side by side | Someone asks how the three approaches compare |

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

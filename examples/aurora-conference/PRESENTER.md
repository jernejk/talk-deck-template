# Presenter guide: Agents in production. What actually broke.

Target: not published yet; the QR and `.qr-url` still point at example.com/slides.

Conference talk · 25 minutes, Wednesday 2 December 2026. Audience: engineers and leads who already run coding agents on at least one repo, after a morning of vendor talks. A fictional sample deck: the payments team, the incident and the numbers are invented.

Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

9 main slides plus 1 extras. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
| 1 | Agents in production. What actually broke. | 0:00–0:30 | Slide |  |
| 2 | Your Name | 0:30–1:00 | Slide |  |
| 3 | Three parts | 1:00–3:00 | Slide | The setup lives in the narration |
| 4 | Part two: what broke | 3:00–3:10 | Slide |  |
| 5 | It passed the tests | 3:10–12:00 | **Live:** Your terminal | Optional; sandbox copy only |
| 6 | The one line we added | 12:00–15:00 | Slide | Space reveals the rule |
| 7 | Four gates, no heroics | 15:00–19:00 | Slide |  |
| 8 | What to change on Monday | 19:00–22:00 | Slide | Leave up for a count of five |
| 9 | Thank you | 22:00–25:00 | Slide | Space reveals the sticker |

Budget: the setup 3 minutes, what broke 9, what held 10, close 3. If you run long, skip the live run on slide 5 and narrate the drawn session.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

- **Real runs:** none in this sample deck. When you adapt it, list each capture, the date it was taken and its timings here.
- **Drawn illustrations:** the terminal session on slide 5 (`.cli`, reconstructed from a log) and the three fanned screens on slide 7 (sample SVGs standing in for a dashboard). Both captions say "Drawn".
- **Gags, not measurements:** the sticker on the close slide. The "about a third slower" figure in the extra is a sample; replace it with one you measured.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
| Autopilot, guarded, or manual | "Should we just turn autopilot off?" |

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

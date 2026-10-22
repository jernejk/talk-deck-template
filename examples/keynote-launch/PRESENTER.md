# Meet Pantry. Lunch, sorted.: presenter guide

Target: not published yet; the QR and `.qr-url` still point at example.com/slides.

Product launch · Keynote, Thursday 12 November 2026. A five-minute launch slot for Pantry, a fictional kitchen app. The audience has seen the teaser and nothing else.

Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

9 main slides plus 0 extras. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
| 1 | Meet Pantry. Lunch, sorted. | 0:00–0:20 | Slide | Say what ships today |
| 2 | Every fridge has a forgotten shelf | 0:20–0:50 | Illustration | Let it land, one line |
| 3 | Scan the shelf once | 0:50–1:20 | Slide | Space reveals the sub line |
| 4 | Part two: the product | 1:20–1:30 | Slide | A breath |
| 5 | Six weeks of beta | 1:30–2:10 | Illustration | Numbers count up |
| 6 | Real words from the beta | 2:10–2:40 | Drawn chat | Read the quote in their voice |
| 7 | Pick a plan | 2:40–3:20 | Illustration | No prices on stage |
| 8 | Three things to do tonight | 3:20–4:00 | Slide | One row per breath |
| 9 | Thank you | 4:00–5:00 | Slide | Space shows the label, then questions |

Budget: five minutes. If you run long, skip the plans slide first; the takeaway slide covers it.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

- **Real runs:** none. Pantry is a fictional product, so nothing in this deck is a capture.
- **Drawn illustrations:** the photo, the phone screen, both plan screens and the chat bubbles are the template's sample images. Their captions say "Illustration".
- **Sample data:** the four beta numbers and the tester quote are invented for the example. Replace them with measured figures and permitted quotes before a real talk.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
| None yet |  |

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

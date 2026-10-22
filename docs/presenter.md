# Presenter guide: {{title}}

Target: {{url}}

{{event}}, {{date}}. Write one line about the audience: who they are, what they already know, and what came before your slot.

Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

{{main}} main slides plus {{extraLine}}. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
{{route}}

Budget: write the time for each part here, and which slide you'll skip first if you run long. To rehearse, press T: the timer checks your pace against each slide's clock in the notes and the deck's `duration`.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

- **Real runs:** which screenshots are real captures, the date they were taken and any timings.
- **Drawn illustrations:** which cards are drawn (`.mock`, `.composer`, `.memo`, `.cli`). Their captions and notes must say so.
- **Gags, not measurements:** anything played for a laugh, so you never quote it as data.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
{{extras}}

## Controls

Arrow keys, Space or PageDown move forward, including step reveals. Left or PageUp goes back. N toggles notes, O opens the overview, H toggles extras, C jumps to the close, T opens the rehearsal timer, L takes a live-demo slide live and back, Home goes to the title and F requests fullscreen (use the browser menu if it's denied). Click any screenshot to enlarge it, and Esc to close. Each slide's footer shows "● Live: …" where a switch is possible.

## Before the talk

1. Open the live deck once so it's cached. It is self-contained and also runs offline from its `index.html`.
2. Reset every live demo to a known state, and write the reset command here.
3. Check the usage limits of anything you'll call live, and stop rehearsing it in the hour before your slot.
4. Turn on Do Not Disturb, check projector readability and keep the screenshots folder open.

## Privacy

Published images are copies in `assets/`, cropped from originals kept elsewhere. Record what each crop removes: tab strip and URL bar (IDs), sidebars (chat and project titles), avatars, emails and prices. Use clearly marked mock data for anything personal. Before publishing, search the notes and alt text for URLs, IDs, emails and street names.

## Verification

Run `npm install` once, then `npm run qa`. It renders every slide with all steps revealed at 1920×1080 and 1280×720. It checks for overflow past the footer or edges, broken images and videos, failed requests and console errors, opens the deck from `file://`, and exercises the keyboard controls. Screenshots land in `qa/`; look at the ones you changed.

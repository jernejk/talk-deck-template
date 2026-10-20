# {{title}}: presenter guide

Target: {{url}}

{{event}}, {{date}}. Write one line about the audience: who they are, what they already know, and what came before your slot.

`site/` is the only publish directory. `tools/` and `qa/` stay local. Speaker notes ship in the public HTML, so private links, IDs and anything you wouldn't show on a slide stay out of them. Keep those here or in a private notes file.

## Talk route

17 main slides plus 5 extras. Before a big rework, tag the current deck (`git tag pre-rework`) so you can roll back.

| # | Slide | Clock | Live or screenshot | Cue |
|---|---|---|---|---|
| 1 | Big words. Real demos. Honest fallbacks. | 0:00–0:20 | Slide | Mascots pop in |
| 2 | Your Name | 0:20–0:40 | Slide | One breath |
| 3 | One idea per slide | 0:40–1:10 | Slide | Space: the sub line |
| 4 | Three parts | 1:10–2:00 | Slide | Name the parts, move on |
| 5 | Here's a real input | 2:00–2:20 | Slide | Space: the sticker |
| 6 | What changed this week? | 2:20–3:20 | **Live, optional:** your app | Cap at 20 s; Space: the callout |
| 7 | Let the prompt type | 3:20–4:00 | Slide | The prompt types itself |
| 8 | Click once, watch it change | 4:00–5:00 | **Live:** your app | Space: after |
| 9 | Planning changes nothing | 5:00–5:40 | Slide | Space ×2 |
| 10 | One evening | 5:40–6:20 | Slide | Numbers count up |
| 11 | Real words beat paraphrase | 6:20–6:50 | Slide | Read the quote aloud |
| 12 | One voice note, three mistakes | 6:50–7:20 | Slide | Read the highlights |
| 13 | Four steps, no magic | 7:20–8:20 | Slide | Walk the steps |
| 14 | Let long pages scroll themselves | 8:20–9:00 | Slide | Let it scroll |
| 15 | Then you can push for more | 9:00–10:00 | Slide | Details in extras |
| 16 | Which one should you reach for? | 10:00–11:00 | Slide | One row per breath |
| 17 | Thank you | 11:00–15:00 | Slide | Space: the sticker. Leave up for questions |

Budget: hook 2:00 (slides 1–4), demo 8:00 (slides 5–15), takeaway and questions 5:00. If you're running long, skip slide 14 first, then slide 12.

Every live beat has its screenshot on the slide. If a live step hasn't answered in 20 seconds, come back and narrate the slide.

## What's real

List every claim the deck makes and where it came from. The audience can't tell a real capture from a mock, so this list is how you stay honest.

- **Real runs:** which screenshots are real captures, the date they were taken and any timings.
- **Drawn illustrations:** which cards are drawn (`.mock`, `.composer`, `.memo`). Their captions and notes must say so.
- **Gags, not measurements:** anything played for a laugh, so you never quote it as data.

## Extras (H to show, or pick from O)

| Extra | Use when |
|---|---|
| One evening, logged | "How long did it take?" |
| Side by side | Someone wants the comparison |
| From just ask to real code | Someone wants the whole map |
| Honest limits | "Does it really work?" |
| What it cost | "Did it cost money?" No dollar figure was recorded. |

## Controls

Arrow keys, Space or PageDown move forward, including step reveals. Left or PageUp goes back. N toggles notes, O opens the overview, H toggles extras, C jumps to the close, Home goes to the title and F requests fullscreen (use the browser menu if it's denied). Click any screenshot to enlarge it, and Esc to close. Each slide's footer shows "● Live: …" where a switch is possible.

## Before the talk

1. Open the live deck once so it's cached. It is self-contained and also runs offline from `site/index.html`.
2. Reset every live demo to a known state, and write the reset command here.
3. Check the usage limits of anything you'll call live, and stop rehearsing it in the hour before your slot.
4. Turn on Do Not Disturb, check projector readability and keep the screenshots folder open.

## Privacy

Published images are copies in `site/assets/`, cropped from originals kept outside `site/`. Record what each crop removes: tab strip and URL bar (IDs), sidebars (chat and project titles), avatars, emails and prices. Use clearly marked mock data for anything personal. Before publishing, search the notes and alt text for URLs, IDs, emails and street names.

## Verification

Run `npm install` once, then `npm run qa`. It renders every slide in every theme at 1920×1080 and 1280×720 with all steps revealed. It checks for overflow past the footer or edges, broken images, failed requests and console errors, opens the deck from `file://`, and exercises the keyboard controls. Screenshots land in `qa/`; look at the ones you changed.

---
name: deck-media
description: Put screenshots, photos, videos, generated images and live demos into a talk deck from this repo. Use when the user says "use these screenshots", "crop the URL bar", "add a live demo for localhost", "add a fallback screenshot", "generate a background" or "caption this image". Covers crops, caption labels, live beats with a 20-second cap, and generated images.
---

# Screenshots, images and live demos

Run the `npm run` commands from the template repo. `<deck>` is a deck folder in `examples/` or anywhere else. A standalone deck has only `npm run qa`.

## Read first

- `AGENTS.md`, section "Rules": captions, live beats and crops.
- `docs/images.md`: the caption labels, free sources and how to generate an image. Read only the section you need.

## Screenshots

1. Keep the originals outside the deck. Put only cropped copies in `<deck>/assets/` (in a standalone deck, `site/assets/`).
2. Crop out the tab strip and URL bar, sidebars with chat or project titles, avatars, emails, IDs and private prices.
3. Pick a pattern that holds a picture: the `media`, `gallery` and `full-bleed` layouts in `docs/agent-index.md`.
4. Give each picture a caption label from `docs/images.md`, for example `<figcaption><b>Real run</b>names hidden</figcaption>`.
5. Write alt text that says what the picture shows.

## Drawn illustrations

`.mock`, `.composer`, `.memo` and `.cli` are drawn. Put "drawn" or "illustration" in the caption or the notes. Fixed colours are permitted only inside these mock-ups.

## Live demos

1. Use a pattern from the "Live and interactive" part of the README, for example `live-demo` or `try-it`.
2. Set `data-live="App name"` on the `<section>`.
3. Put the screenshot of the demo on the same slide. This is the fallback.
4. In `live-demo`, set `data-src` to the app URL. The notes of the pattern tell how it works.
5. Add the cap to the notes, for example `<p class="live">LIVE → App name. Press L, cap it at 20 s, then L again for the screenshot.</p>`.
6. Do not put `localhost`, private IPs or tokens in the notes. The notes ship with the slides.

## Generated images

1. Use generated images only for backgrounds and illustrations. Never use them for screenshots, charts or results.
2. Ask for 16:9, with no text in the image. Save it as JPEG.
3. Caption it `<b>Generated</b> by <model>`, and put the prompt in the notes.

## Done when

- `npm run lint -- <deck>` gives no `live-cap`, `drawn-disclosure` or `private-data` warnings.
- `npm run qa -- <deck> --slides <ids>` reports no broken images or videos.
- You read the screenshot of each slide in `qa/`, and you see nothing private in it.
- `PRESENTER.md` "What's real" lists each real capture, drawn card and generated image.

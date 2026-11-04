---
name: deck-publish
description: Get a talk deck from this repo ready to share, and publish it only with the user's approval. Use when the user asks to "publish the deck", "deploy it", "make a share link", "export the deck", "make one HTML file", "put it on a USB stick" or "update the QR code". Covers npm run export, npm run inline, the QR code, .qr-url and CNAME, and a confirmation before any upload.
---

# Export and publish

Ask the user before you upload anything. A publish puts the slides and the notes on the public web. Get a clear "yes" for each upload. Get the host and the URL from the user.

Run the `npm run` commands from the template repo. `<deck>` is a deck folder in `examples/` or anywhere else. A standalone deck has only `npm run qa`.

## Read first

- `AGENTS.md`, section "Before calling a deck done", steps 4 and 5.

## Steps

1. Run `deck-check` first. QA must report no problems.
2. Read the notes as a stranger. The notes ship in the public HTML.
3. Make the folder to publish:
   - A standalone deck from `npm run new` already has `site/`. Publish `site/`.
   - A deck in `examples/`: `npm run export -- examples/my-talk ~/talks/my-talk`. The target must be an empty folder outside this repo.
4. If the slides URL changed:
   1. Make the QR again (macOS only): `swift tools/qr.swift <url> <deck folder>/assets/qr-slides.png`. The tool reads back the PNG and fails on a mismatch.
   2. Set the close slide's `a.close-qr` `href` and the `span.qr-url` text to the new URL.
   3. Write the host to `CNAME` beside `index.html`.
   4. On other systems, make the QR with a different QR tool, and scan it with a phone.
5. For one offline file, to send by email or to put on a USB stick: `npm run inline -- <deck>`. This writes `standalone.html` beside `index.html`. Use `npm run inline -- <deck> out.html` to choose the name. Make it again after each edit.
6. Run `npm run qa -- <deck>` again if you changed the deck.
7. Show the user the exact upload command, the folder and the URL. Wait for approval. An example: `npx surge ~/talks/my-talk/site my-talk.surge.sh`.

## Done when

- The user approved the upload, and the deck opens at the URL.
- The QR on the close slide goes to that URL. QA on macOS checks this.
- `PRESENTER.md` has the URL in "Target".

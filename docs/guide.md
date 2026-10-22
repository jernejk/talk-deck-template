# Using this template

## It's a blueprint

This repo is one way to build talks, not a framework you have to follow. Everything is plain HTML, CSS and a little JavaScript, with no dependencies at runtime and no build step to present. Take the whole thing, or one template, one slide, or one component; fork it and change anything. If you'd build it differently, do.

## Pick a starting point

| You want | Do this |
|---|---|
| A talk soon, in one of these styles | `npm run new -- ~/talks/my-talk --template paper --title "My talk"` (see the README). You get a self-contained folder; present from `site/index.html` |
| Your own house style for every talk | Click "Use this template" on GitHub, or fork it. Add a template for your style (`docs/styles.md`) and use it for every new deck |
| One idea from here | Copy it. A slide pattern is one `<section>` in `slides/`. A component is one folder in `components/`: CSS, plus a short `Deck.use` plugin for some |
| To see what's possible first | Open `examples/index.html`, or the pictures in `docs/showcase/` |

## A talk, start to finish

1. **Plan the parts.** List them in `#deck-config` as `agenda`, each with a start time, and set `duration`. Agenda slides and footer dots fill in from this list.
2. **Make the deck.** Run `npm run new` with `--slides` listing the patterns you need, in order. The README's table groups the patterns by part of the talk, and `docs/showcase/` shows each one.
3. **Write the slides.** Each slide has one idea: an eyebrow, then a title with one highlighted payoff. The placeholder copy says what goes where.
4. **Add images.** Use real screenshots where you can, cropped and captioned. `docs/images.md` lists free sources, how to generate an image, and how to caption each kind.
5. **Write the notes.** Start each with the slide's clock (`<b>2:00–2:40.</b>`), then the line you'll say. Notes are published with the slides, so nothing private goes in them.
6. **Prepare for questions.** Add presenter extras (`data-hidden`, the `x-` patterns) for the questions you expect.
7. **Rehearse.** Press T to start the timer, which compares your pace with each slide's clock. Move the clocks until they match how you actually talk.
8. **Check the deck.** Run `npm run qa`, then look at the screenshots in `qa/` for every slide you changed.
9. **Publish.** Upload `site/` to any static host: surge, GitHub Pages, Netlify or your own server. It also runs straight from disk, so a USB stick works.
10. **Fill in `PRESENTER.md`:** the route, timings, what's real, which demos are live, and the before-the-talk checklist.

## Working with a coding agent

The repo is written for agents as much as for people:

- `AGENTS.md` holds the rules and the slide anatomy (`CLAUDE.md` points to it).
- `docs/` describes every component, pattern and template token.
- `docs/showcase/` labels every picture with its pattern and template, so an agent can match what you point at to the markup that makes it.

Things to ask for:

- "Make a 20-minute talk about <topic> for <audience> in the paper template: an agenda, a hook, two demos using the screenshots in ~/shots, takeaways and questions. Draft the notes with clocks."
- "Add a colourway from our brand colours #0f6cbd and #e8a33d, based on keynote, and check the contrast."
- "Turn these two screenshots into a before-after slide and a zoom slide. Crop the URL bar."
- "Add a live-demo slide for http://localhost:5173, with this screenshot as the fallback and a 20-second cap."
- "Generate a background for the cover with Codex image_gen. No text in the image; caption it Generated."
- "Run QA, fix what it finds, then show me the screenshots of the slides you changed."

An agent following `AGENTS.md` will:

- run QA;
- keep private details out of the notes;
- label drawn and generated images;
- add a 20-second cap to every live demo;
- keep the notes' clocks in order.

## Make it yours

Start at the lowest level that gets you what you want:

| Level | What changes | Where |
|---|---|---|
| Content | Words, screenshots, notes | Your deck's `index.html` |
| Slides | Add, remove or reorder patterns | `npm run add`; `slides/` for your own patterns |
| Colour | A colourway: a few tokens over a template | `templates/<name>/theme.css`; the showcase has six to copy |
| Style | A whole template: type, surfaces, mascots, pet, motion | `docs/styles.md` |
| Behaviour | A component with its own CSS and plugin | `docs/components.md` |
| Engine | Keys, controls, navigation | `core/deck.js`. Try the plugin API first (`Deck.use`, `Deck.control`): most changes fit there |

## Removing what you don't need

- **In a standalone deck:** delete slides from `index.html`. The copied library in `site/lib/` is small: the engine and all components come to about 65 KB. Templates you don't use can go from `site/lib/templates/`. `community-codex` is the largest, at about 245 KB, because of an extra pet spritesheet.
- **In your fork of this repo:** to remove a pattern, delete its file, its entry in `slides/index.json` and its row in `docs/slides.md`. Remove a component once no slide uses it: delete its folder and its row in `docs/components.md`. Then run `npm run build`, which fails if anything is left half-removed.

## Keeping up

A fork is yours, and it's fine for it to drift. To take a later fix from here, cherry-pick the commit, or copy the changed component folder and run `npm run build`.

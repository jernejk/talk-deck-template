# Fan out a long deck

One agent that writes 20 slides in series is slow. Split the work by section, but only after the shared inputs are fixed. If two agents change a shared input at the same time, the deck loses its single look.

## 1. Fix the shared inputs (main agent)

Do these steps before you start a section agent:

1. **Design.** Choose the template, and the colourway if the deck has one (`deck-style`). The section agents do not change `templates/`, `components/` or `#deck-config`.
2. **Facts.** Write one file with each number, quote and source that the deck uses. Each fact has a source that someone measured. The section agents copy facts from this file. They do not find new facts.
3. **Outline.** Run the steps in `SKILL.md` up to `npm run outline -- <deck> outline.json --force`. The deck then has every slide, with its id, title, section, layout and clock.
4. **Media.** Put the cropped screenshots in `assets/` and give each one a caption label (`deck-media`).

## 2. Brief each section agent

Give one agent each section of 3 to 6 slides. Each brief contains:

- the deck path and the slide ids it owns. The agent changes only those `<section>` elements.
- the path of the facts file and the media it can use.
- the rules: `AGENTS.md` "Rules" and "Slide anatomy", and `docs/agent-index.md` to look up components.
- the check: `npm run qa -- <deck> --slides <its ids> --fast`, then `npm run lint -- <deck>`, with no new warnings on its slides.
- the result to report: the ids it changed, the facts it used, and any warning that it did not fix.

Use a model that is good at layout and text. Do not use the smallest model. `skills/deck-slides/delegate.md` has the brief, the checks you run yourself before you accept a result, and the limits: at most four results waiting for review, one retry, and when to stop fanning out.

When two agents edit the same `index.html` at the same time, their edits can conflict. To prevent this, let each agent write its slides to its own fragment file. Then the main agent pastes the fragments into `index.html` in outline order.

## 3. Join and check (main agent)

1. Put the sections in outline order. Keep the ids from the outline.
2. Run `npm run qa -- <deck>` once in full, and read the contact sheets listed in that run’s receipt. The section agents' `--fast` checks omitted normal screenshots, so this is the first look at their slides. Look for slides that look the same next to each other, and for a section that has a different style.
3. Run `npm run route -- <deck>` and finish `PRESENTER.md` (`deck-notes`).

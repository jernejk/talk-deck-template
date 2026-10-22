# Talk deck: agent guide

Talk decks in plain HTML and CSS with a small engine: no build step to present, no CDN, no web fonts. A deck is one `index.html` of `<section class="slide">` elements that loads the core, the components and one template; the engine adds the controls. `PRESENTER.md` beside a deck is its route, timings and honesty ledger.

In the template repo, `core/`, `components/`, `slides/` and `templates/` are the library, and decks live in `examples/`. In a standalone deck the library is copied into `site/lib/`, and `site/` is the folder you publish.

## Rules

- Keep decks self-contained: no external scripts, styles, fonts or images.
- Speaker notes (`aside.notes`) ship in the public HTML. Keep private links, IDs, emails and anything you wouldn't show on a slide out of them.
- One idea per slide: an eyebrow, then a title of one or two lines with a single `<em>` on the payoff. If it needs a third line, make two slides.
- Prefer real captures, and label them in the caption: `<figcaption><b>Real run</b>names hidden</figcaption>`. Drawn illustrations (`.mock`, `.composer`, `.memo`, `.cli`) are fine when the caption or notes say they're drawn. Generated images (`<b>Generated</b> by gpt-image-2`) are fine for backgrounds and illustrations, never for screenshots or results; keep the prompt in the notes. Sources and credits: `docs/images.md`.
- Every live beat gets `data-live="App name"`, its screenshot on the same slide, and a 20-second cap in the notes.
- Quote only numbers someone measured. Gags must read as gags, and PRESENTER.md lists which is which.
- Crop screenshots before they go into `assets/`: tab strip and URL bar, sidebars with chat or project titles, avatars, emails, IDs and private prices. Keep originals outside the deck.
- Notes open with the clock (`<b>2:20–3:20.</b>`), then the line to say. Use `p.live` for live cues and `p.src` for provenance. Keep the clocks in talk order, because the rehearsal timer (T) reads them; patterns arrive with sample clocks.
- Likely questions get a presenter extra (`data-hidden`) and a row in PRESENTER.md.
- Colour slides with palette slots (`var(--a1)` … `var(--a6)`) so every template can recolour them. Fixed colours belong only inside drawn mock-ups.
- Slide text uses curly quotes and apostrophes.
- Don't edit generated files (`components/components.css`, `components/components.js`, `examples/catalog/`, `examples/index.html`); run `npm run build`. `docs/showcase/` is generated too, by `npm run showcase`.

## Slide anatomy

```html
<section class="slide" id="real-answer" data-section="Demo" data-title="What changed this week?" data-live="Your app">
  <div class="eyebrow"><span class="n">02</span>Demo · real answer</div>
  <h2 class="title">Click once. <em>Watch it change.</em></h2>
  <p class="sub" data-step>Revealed on Space.</p>
  <aside class="notes"><p><b>4:00–5:00.</b> The line to say.</p></aside>
</section>
```

| Attribute | Effect |
|---|---|
| `data-section` | Footer label and colour slot (see the config block) |
| `data-title` | Overview, document title and screen readers |
| `data-live` | "● Live: …" in the footer and overview |
| `data-hidden` | Presenter extra: skipped until H, or picked from O |
| `data-chrome="off"` | No footer (cover, speaker, close) |
| `data-ghost="off"` | No faint background shape |
| `data-step`, `data-step="name"` | Reveal on Space; elements sharing a name reveal together |
| `data-count="83"` | Counts up from zero when the slide opens |
| `data-type="…"` | Types the text when shown (`data-delay` ms, `data-ph` placeholder) |
| `data-pose` on `.pet` | Which pet pose the template shows: `wave`, `coding`, `thinking`, `facepalm` |
| `data-agenda-current="Demo"` | Lights that agenda part on this slide, instead of the part its section belongs to |
| `style="--accent:var(--a3)"` | Overrides the slot colour for a slide or one element |

The `#deck-config` block in the head sets `title`, footer `brand` and `sections`, which map section names to slots 1–6 (0 is muted). Unlisted sections cycle through slots 1–5, the ones with a ghost shape. Optional keys: `agenda`, the parts (`section`, `title`, `note`, `time`) behind agenda lists and footer dots, which otherwise come from the sections in slide order; `"agendaDots": false` to hide the dots; `duration` (`"15:00"`) for the rehearsal timer; and `"petWalk": true` to walk the template's pet along the progress bar. The close slide's id must be `close`; C jumps to it.

Component classes and options are in `docs/components.md`, slide patterns in `docs/slides.md`, and template tokens in `docs/styles.md`. The catalog (`examples/catalog/index.html`) shows every pattern, and its notes say how each works. For pictures, open `docs/showcase/`: every pattern in a mix of templates, six example talks and six colourways, labelled pattern · template.

## Changing a deck

- Add a reusable slide with `npm run add -- <deck> <pattern>` from the template repo rather than hand-copying; it keeps ids unique and copies assets.
- After editing notes or timings, update the route table in PRESENTER.md.

## Changing the library

- **Component:** a folder in `components/`, root class named after it, theme tokens with fallbacks for anything new, `--rise:1` to enter with the slide, reduced-motion and portrait rules, behaviour through `Deck.use`. Use it in a slide pattern and add a row to `docs/components.md`.
- **Slide pattern:** `slides/<name>.html` plus an entry in `slides/index.json` and a row in `docs/slides.md`.
- **Template:** `templates/<name>/theme.css` and `template.json`; follow `docs/styles.md`.
- Run `npm run build`, then `npm run qa`, and look at the catalog screenshots in every template. If a pattern or template looks different, run `npm run showcase` too.

## Before calling a deck done

1. `npm run qa` reports no problems. In the template repo it covers every example, the catalog in every template and the build check; pass a deck path to check one.
2. Look at the `qa/` screenshots of every slide you touched, in each template you ship.
3. If the slides URL changed, regenerate the QR with `swift tools/qr.swift <url> <deck folder>/assets/qr-slides.png` (it decodes what it wrote and fails on a mismatch), then update `.qr-url` and `CNAME`.
4. Read the notes as a stranger would: nothing private, and every drawn illustration disclosed.
5. Update PRESENTER.md: route table, timings, what's real, extras.

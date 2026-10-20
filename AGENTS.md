# Talk deck: agent guide

A self-contained HTML deck. `site/index.html` holds the slides, `site/engine/` the behaviour and layout, `site/themes/` the look. There is no build step, no CDN and no web font, so the deck runs from `file://` and from any static host. `PRESENTER.md` is the talk's route, timings and honesty ledger.

## Rules

- `site/` is the only publish directory. Keep it self-contained: no external scripts, styles, fonts or images.
- Speaker notes (`aside.notes`) ship in the public HTML. Keep private links, IDs, emails and anything you wouldn't show on a slide out of them.
- One idea per slide: an eyebrow, then a title of one or two lines with a single `<em>` on the payoff. If it needs a third line, make two slides.
- Prefer real captures, and label them in the caption: `<figcaption><b>Real run</b>names hidden</figcaption>`. Drawn illustrations (`.mock`, `.composer`, `.memo`) are fine when the caption or notes say they're drawn.
- Every live beat gets `data-live="App name"`, its screenshot on the same slide, and a 20-second cap in the notes.
- Quote only numbers someone measured. Gags must read as gags, and PRESENTER.md lists which is which.
- Crop screenshots before they go into `site/assets/`: tab strip and URL bar, sidebars with chat or project titles, avatars, emails, IDs and private prices. Keep originals outside `site/`.
- Notes open with the clock (`<b>2:20–3:20.</b>`), then the line to say. Use `p.live` for live cues and `p.src` for provenance.
- Likely questions get a presenter extra (`data-hidden`) and a row in PRESENTER.md.
- Use palette slots (`var(--a1)` … `var(--a6)`) for colour in slides so every theme can recolour them. Fixed colours belong only inside drawn mock-ups.
- Slide text uses curly quotes and apostrophes.

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
| `style="--accent:var(--a3)"` | Overrides the slot colour for a slide or one element |

The `#deck-config` block in the head sets `title`, footer `brand` and `sections`, which map section names to slots 1–6 (0 is muted). Unlisted sections cycle through slots 1–5, the ones with a ghost shape. The close slide's id must be `close`; C jumps to it.

## Components

| Area | Classes |
|---|---|
| Type | `.eyebrow` (`.n` number), `.title` (`em`, `--wide`, `--small`), `.ask` (quoted question), `.sub`, `.lede`, `.hint` (`b` label), `.callout`, `.quote` (`cite`, `--small`) |
| Layout | `.split` (`--wide`, `--even`, `--hero`, `--auto`) with `.text` and media, `.cols` with `.card` (`--n`, `h3 b` badge), `.flow` with `.flow-arrow`, `.stage` |
| Media | `.shot` (`--h`; click to zoom), `.swap` (stacked shots swapped by a step), `.phone` (`--ph`), `.tilt` in `.cover-art` (`--rh`), `.fan` (`.f1`–`.f3`, `.fan-cap`), `.scrollshot` with `.scrollshot-view` and `.inset` |
| Numbers | `.stats` > `.stat` (`--n`, `--w`), `.counters`, `.pillars` > `.pillar` (`--c`), `.recipe` > `.recipe-row` (`--c`), `.ladder` (`--n`), `.timeline` (`--rows`) |
| Lists | `.pipe` (`--text`), `.facts`, `.tags`, `.chips`, `.legend` |
| Tables | `.ledger` (`--cols`; `.h`, `.item`, `.num`, `.is-hot`; columns reveal by named step), `.compare` (`.is-hero` column) |
| Drawn UI | `.composer` (`-box`, `-chips`, `-chip`, `-text`, `-bar`, `-label`, `-mode`), `.mock` with `.tiles` > `.tile` (`.is-hit`), `.memo` (`.label`, `.play`, `.wave data-n`, `mark` with an `i` note), `.bubbles` > `.bubble` (`--me`) |
| Personality | `.mascot` + `.m-pentagon`, `.m-octagon`, `.m-diamond`, `.m-hexagon` or `.m-triangle` (`--s` size, `--r` tilt, `--mc` colour), `.mascots` (cover cluster of five), `.mascot--corner`, `.mascot--top`, `.pet` (`--corner`, `--pw`), `.sticker` (`small`), `.fx` with `.orb` (`--c`, `--size`) and `.sparks data-n` |
| Slide types | `.slide--cover`, `.slide--opener`, `.slide--about` (`.about-*`), `.slide--close` (`.close-grid`, `.close-title`, `.close-socials`, `.close-qr`, `.qr-ring`, `.qr-card`, `.qr-label`, `.qr-url`, `.qm1`–`.qm5`, `.close-pet`) |

The sample deck in `site/index.html` shows the components in use, and its notes say how each one works.

## Themes

A theme is one CSS file in `site/themes/` that sets every token `community.css` sets, then overrides components below the tokens. `paper.css` shows a light theme with print shadows; `terminal.css` restyles mascots, ghosts, cursor and progress bar with CSS alone. Preview any theme with `index.html?theme=paper`. Composite tokens can't follow per-slide accents, so engine rules use `var(--accent)` directly; a theme that needs a different shape of shadow overrides the rule instead.

## Before calling a deck done

1. `npm run qa` reports no problems. It covers every theme in `site/themes/`; delete themes the talk won't use, or pass `--theme <name>`.
2. Look at the `qa/` screenshots of every slide you touched, in each theme you ship.
3. If the slides URL changed, regenerate the QR (`swift tools/qr.swift <url> site/assets/qr-slides.png`; it decodes what it wrote and fails on a mismatch) and update `.qr-url` and `site/CNAME`.
4. Read the notes as a stranger would: nothing private, every drawn illustration disclosed.
5. Update PRESENTER.md: route table, timings, what's real, extras.

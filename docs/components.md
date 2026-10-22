# Components

A component is a folder in `components/` holding `<name>.css`, plus `<name>.js` when it needs behaviour. `npm run build` adds it to `components/components.css` and `components/components.js`, which every deck loads. The build also checks that some slide in `slides/` uses it, so every component appears in the catalog.

The core (`core/deck.css`, `core/deck.js`) owns the slide frame, base type (`.eyebrow`, `.title`, `.sub`, `.lede`, `.hint`, `.ask`), layout (`.split`, `.cols` with `.card`, `.flow`, `.stage`), step reveals, the controls and the plugin API. Everything else is a component.

## Adding a component

1. Create `components/<name>/<name>.css` and name the root class after the folder (`.cli`, `.code`).
2. Style it with theme tokens (see docs/styles.md) and `var(--accent)` for the slide's colour. Give any new token a fallback, such as `var(--cli-bg,#0b0d10)`, so existing templates keep working. A token that derives from the slide's colour must be declared on the component root, as `.cli{--cli-accent:var(--accent)}` is, because on `:root` it would freeze. Scale accent glows from `--shot-glow` so a theme can turn them off. Hard-coded colours belong only in drawn mock-ups of real apps.
3. Set `--rise:1` on the root to make it fade up with the slide. Entrances are staggered in document order, and elements inside a step wait for their step.
4. Add a `@media (prefers-reduced-motion:reduce)` rule for every animation, and a `@media screen and (max-aspect-ratio:1/1)` rule if it must stack on a phone.
5. Put behaviour in `<name>.js`. The build wraps each file in its own scope:

   ```js
   Deck.use({
     name: "cli",
     init(slide, deck) {},             // once per slide, before the first render
     enter(slide, deck) {},            // the slide became active
     leave(slide, deck) {},            // it stopped being active
     step(elements, slide, deck) {},   // Space revealed a step group
     unstep(elements, slide, deck) {}  // going back hid it again
   });
   ```

   `deck` provides `config`, `slides()`, `current()`, `goTo(slide)`, `openDialog(dialog, invoker)`, `reducedMotion()` and `control({ label, key, action })`, which adds a button to the controls with a one-letter key (taken keys are refused with a warning). `components/rehearse/` uses it. A hook that throws logs an error without stopping the deck, and QA fails on the error.
6. Use it in a slide pattern, new or existing (see docs/slides.md).
7. Run `npm run build`, then `npm run qa`, and look at the catalog screenshots in every template.

`components/cli/` is a compact worked example: tokens with fallbacks, `--rise`, a reduced-motion rule, a portrait rule, and a four-line plugin that numbers the lines so CSS can stream them in.

## Reference

| Component | What it is | Markup and options | JS |
|---|---|---|---|
| `about` | Speaker slide layout | `.slide--about` with `.about-portrait`, `.about-panel`, `.about-logo`, `.about-name`, `.about-summary`, `.about-links`, `.about-pet` | |
| `agenda` | Numbered parts that fill from the config or the deck's sections, plus a dot per part in each footer | `ol.agenda[data-auto]` (`--side`; `li.is-done/.is-current`; `.agenda-num`, `.agenda-title`, `.agenda-note`, `.agenda-time`), `data-agenda-current`, `.agenda-part > .text + .agenda-aside`, `.agenda-where > b + code`, `.slide--cover-split > .cover-panel + .cover-side`, `.cover-facts`; config `agenda`, `agendaDots` | yes |
| `agents` | Agent cards with a pet each, whose state and pose change on Space | `ol.agents > li.agent` (`--accent`, `--n`) with `.agent-head > .agent-avatar > i.pet` + `.agent-name` + `.agent-model`, `p.agent-task`, `ol.agent-log > li[data-state]` (`queued`, `thinking`, `coding`, `blocked`, `done`; optional `data-pose`, `data-step`) | yes |
| `bleed` | Full-bleed image with the title on a scrim | `.slide--bleed`, `figure.bleed > img`, `.bleed-text`; pair with `data-ghost="off"` | |
| `bubbles` | Chat exchange | `.bubbles > .bubble` (`--me`, `small`) | |
| `callout` | Labelled aside with an accent rule | `.callout > b + p` | |
| `chapter` | Part divider with a huge outlined number | `.chapter > .chapter-num + .text` | |
| `cli` | Drawn terminal session whose lines stream in | `figure.cli > .cli-head + .cli-body > .cli-line` (`cli-user`, `cli-run`, `cli-out`, `cli-ok`, `cli-meta`; `code`, `ins`, `del`) | yes |
| `close` | Closing slide with links and a QR code | `.slide--close`, `.close-grid`, `.close-title`, `.close-socials`, `a.close-qr > .qr-ring > .qr-card`, `.qr-label`, `.qr-url`, `.qm1`–`.qm5`, `.close-pet`; the slide id must be `close` | |
| `code` | Code card with a highlighted line | `figure.code > figcaption + ol > li` (`.hl`, `.c`; tokens `.k` `.s` `.f` `.n`) | |
| `compare` | Comparison table | `table.compare`, `.is-hero` column | |
| `composer` | Drawn prompt box that types itself | `.composer > .composer-box > .composer-chips + .composer-text[data-type] + .composer-bar`; `.composer-mode`, `.composer-label` | |
| `count` | Numbers that count up when the slide opens | `[data-count="83"]` | yes |
| `cover` | Cover and section-opener layouts | `.slide--cover`, `.slide--opener`, `.cover-meta`, `data-fill` markers for `npm run new` | |
| `covers` | Cover variants: framed artwork, full-bleed photo, centred statement | `.cover--image` + `figure.cover-frame`, `.cover--photo` + `figure.cover-photo` + `.cover-links`, `.cover--center` + `.cover-rule` | |
| `diff` | Code diff with added and removed lines and folded context | `figure.diff > details.diff-file` (summary: `b` + `.diff-stat` with `ins`/`del`) `+ .diff-hunk + ol > li.add/.del/(plain)` with `data-o`/`data-n` line numbers and `code`; `li.diff-fold > details` for unchanged lines; `data-step` on `li.add`; `.k .s .f .n .c` tokens; `figcaption` | yes |
| `embed` | A live HTML page in a browser frame, or a screenshot that goes live on L with a countdown | `figure.embed > .embed-bar > .embed-url` + `.embed-view > iframe.embed-frame[data-src]` (+ `img.embed-shot` for the screenshot fallback) + `figcaption > b`; `data-cap="20"` countdown; `--h`, `--w`, `--ratio` | yes |
| `facts` | Numbered list with rules | `ul.facts > li` | |
| `fan` | Three screenshots fanned out | `.fan > .shot.f1/.f2/.f3 + .fan-cap` | |
| `findings` | Findings with a severity dot | `ul.findings > li.is-high/is-med/is-low/is-ok > strong (span.sev) + span`; `data-step` on `li` | |
| `fold` | Collapsible block for long output that opens on click or on Space | `.folds > details.fold > summary (b + span meta) + .fold-body` (`is-prose`; lines `is-ok`/`is-bad`/`is-dim`; `--fold-h`), `p.fold-cap`; `data-step` on the body or a child opens the fold on Space and closes it on the way back | yes |
| `fx` | Orbs and rising sparks | `.fx > .orb` (`--c`, `--size`), `.sparks[data-n]` | yes |
| `ghost` | Faint outline of the slide's slot shape | added to every slide; opt out with `data-ghost="off"` | yes |
| `kpis` | Boxed KPI cards | `.kpis > .kpi` (`strong` + `small` unit, `span` label, `em` note; `--n`, `--c`, `--w`); `.stats--cards > .stat` is an alias | |
| `ladder` | Approaches as columns | `ol.ladder > li` (`--c`; `b`, `strong`, `span`, `.tag`) | |
| `ledger` | Grid table whose columns reveal by step | `.ledger` (`--cols`) with `.h`, `.item`, `.num`, `.is-hot`, `data-step="name"` | |
| `log` | Timestamped event table with a bad row | `table.log` (thead, `tr[data-step]`, `tr.is-bad`) | |
| `mascots` | Five shapes with faces | `i.mascot.m-pentagon` (`m-octagon`, `m-diamond`, `m-hexagon`, `m-triangle`; `--s`, `--r`, `--mc`), `.mascots` cover cluster, `.mascot--corner`, `.mascot--top` | |
| `matrix` | Yes, no and partial cells for comparison tables | `table.compare.matrix`; `td.yes/.no/.part` with `span.sr` text, optional `small` | |
| `memo` | Transcript with annotated mistakes | `figure.memo > .label + .wave[data-n] + p > mark > i` | yes |
| `milestones` | Horizontal timeline of dots | `ol.milestones > li > time + strong + span` (`--n` columns, `--c` per item, `.is-now`, `data-step`) | |
| `mock` | Drawn app card with tiles | `.mock > .mock-title + .mock-sub + .tiles > .tile` (`--t`, `.is-hit`) | |
| `pet` | Pixel sprite in four poses; templates bring their own images, and the default is a drawn robot | `i.pet[data-pose="wave"]` (`coding`, `thinking`, `facepalm`), `.pet--corner`, `--pw`; `p.pet-say` speech bubble (`--tail`); `ol.pets > li > p.pet-say + i.pet + b + span` lineup; `"petWalk": true` in the config walks the pet along the progress bar | yes |
| `phone` | Phone frame | `figure.phone > img` (`--ph`) | |
| `pillars` | Numbered parts with colour rules | `.pillars > .pillar` (`--c`; `i`, `strong`, `span`) | |
| `pipe` | Numbered pills, the last one lit | `ol.pipe > li > b` (`--text` variant) | |
| `player` | Video with sound and controls, trimmed with `data-start`/`data-end`, or a YouTube video that loads only on play | `figure.player[data-start][data-end] > video[controls]` (`data-autoplay` and `--h` on the figure too); the JS builds `.player-stage`, `.player-big` and `.player-bar`. YouTube: `figure.player[data-youtube][data-start] > .player-stage > img.player-poster + .player-meta (b, span, .player-note) + button.player-big`, `figcaption a.player-link`; over `file://` it opens YouTube in a new tab | yes |
| `presenter` | Presenter layouts: card, banner, facts, team | `.slide--presenter` with `.presenter-panel`, `.presenter-name`, `.presenter-links`, `.presenter-tags`; `.presenter--card` (`.presenter-side`, `.presenter-portrait`, `.presenter-badge`, `.presenter-coins`, `.presenter-focus`); `.presenter--banner`; `.presenter--facts` (`.presenter-fact`); `.presenter-team > .presenter-card` (`--n`, `--c`) | |
| `qr` | Standalone QR block for mid-talk | `.qr > a.qr-link > .qr-card > img`, `.qr-label`, `.qr-url`, `.qr-path`; `.qr--sm`; QA decodes it against the link | |
| `quote` | Quote with an accent rule | `blockquote.quote > p + cite` (`--small`) | |
| `recipe` | Coloured takeaway rows | `.recipe > .recipe-row` (`--c`; `b`, `strong`, `span`) | |
| `rehearse` | Rehearsal timer on T: total, time on this slide, the planned window from the notes, and an on-time, behind or ahead status | no markup; optional config `duration`; adds a control through `Deck.control` | yes |
| `schedule` | Grid of event-day time blocks | `.schedule > .slot > time + strong + span` (`--n`, `--c`, `.is-now`) | |
| `scrollshot` | Tall capture that scrolls itself | `figure.scrollshot > .scrollshot-view > img` (`--vh`), inside `.stage` | |
| `shot` | Screenshot with caption; click to zoom | `figure.shot > img + figcaption > b` (`--h`), `.swap`, `.inset` | yes |
| `stages` | Stage cards with the current one lit | `ol.stages > li` (`strong`, `span`, `i.pin[aria-hidden]`); `li.is-current`, or with `data-step` the last revealed is current | |
| `stats` | Big numbers | `.stats > .stat` (`--n`, `--w`), `.counters` | |
| `sticker` | Tilted label | `.sticker` (`small`), often `data-step` | |
| `strip` | Three to five captioned images with a metric row | `.strip > figure > img + .strip-badge + figcaption > b` (`--n`, `--h`), `.strip-metrics > div > b + span` | |
| `tags` | Pills, ticks and colour legends | `.tags > span > b`, `.chips > span`, `.legend > span` (`--c`) | |
| `tilt` | Tilted paper or receipt | `.cover-art > figure.tilt > img` (`--rh`) | |
| `timeline` | Two-column timestamped log | `ol.timeline > li > time + span` (`--rows`) | |
| `timer` | Exercise countdown: a ring, big digits, Start/Pause, Reset and +1 min; keeps counting across slides and ends on “Time’s up” | `.timer[data-time="5:00"]` (empty; the JS builds the face and buttons; `data-autostart` starts it when the slide opens) | yes |
| `titles` | Title configurations for any slide: stacked, extra large, centred, kicker, numeral | `.title--stack`, `.title--xl`, `.title--center`, `.title--kicker > small`, `.title--number > b` | |
| `type` | Typing effect for any element | `[data-type="…"]` (`data-delay`, `data-ph`) | yes |
| `versus` | Two panels, such as a weak and a useful prompt | `.versus > .versus-panel × 2` (`.versus-chip`, `.versus-body` with `mark`, optional `.versus-verdict > b`) | |
| `video` | Muted clip that plays while its slide is open | `figure.video > video` (`--h`) | yes |
| `zoom` | Screenshot that zooms to regions on Space, with captions that light up | `figure.zoom > .zoom-frame > img` (`--ar` frame ratio, default 16/10; keep it equal to the image's) beside `ol.zoom-steps > li[data-step][data-zoom="x% y% scale"]`; one per slide | yes |

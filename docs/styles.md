# Making a style

A style is a template folder: `templates/<name>/theme.css`, a `template.json`, and optional `assets/`. A deck loads exactly one template through `<link … id="theme">`, and `?theme=<name>` on any deck's URL previews another one. Templates never touch markup, so every slide pattern works in every template.

```
templates/paper/
  theme.css        tokens first, then component overrides
  template.json    name, description, extends, default slides for npm run new
  assets/          optional: pet poses, fonts, textures
```

## Four levels of change

Start at the lowest level that gets you the look.

**1. Tweak a template.** Import it and override a few tokens. Good for a brand colour or font.

```css
@import url("../community/theme.css");
:root{
  --a1:#2b88d8; --m1:#2b88d8; --signal:#2b88d8; --sticker:#2b88d8; --on-sticker:#fff;
  --sans:"Avenir Next",system-ui,sans-serif;
}
.mascot,.ghost{display:none}
```

The `@import` does the inheriting. `"extends": "community"` in `template.json` records the base, and `npm run export` copies every template, so the import also works in a standalone deck. The [showcase](showcase/README.md#colourways) renders this tweak and five more colourways, each with its CSS.

**2. Re-skin.** Copy `community/theme.css`, which sets every token, and change the values. A light theme also needs `color-scheme:light`. `paper` started here.

**3. Re-style components.** Add rules below the tokens. Any component rule can be overridden; same-specificity rules in the theme win because it loads last. `paper` swaps glows for print shadows, and `terminal` replaces the mascots with ASCII faces, adds scanlines and segments the progress bar.

**4. Bring your own assets.** Mascot shapes, pet poses, fonts and textures. `community-codex` imports `community` and swaps in the Codex Community mascots.

## Tokens

| Tokens | Set |
|---|---|
| `--bg` `--panel` `--panel-2` `--ink` `--muted` `--rule` | Surfaces and text |
| `--a0` … `--a6` | Palette slots. Sections map to 1–6 in `#deck-config`, and 0 is the muted slot for extras. `--a6` is mostly a highlight: shimmer, sparks, QR ring |
| `--m1` … `--m5` | Mascot colours, one per shape |
| `--ok` `--signal` `--on-accent` `--sticker` `--on-sticker` | Ticks, the live and extras marker, text on colour, stickers |
| `--sans` `--display` `--mono` | Body, headline and code type |
| `--title-weight` `--title-leading` `--tight` `--em-style` | Headline weight, leading, tracking, and `normal` or `italic` for the accent |
| `--radius` `--shot-bg` `--shot-border` `--shot-glow` `--drop` | Screenshots and cards: corner, backing, border, accent glow strength, drop shadow |
| `--glow-1` `--glow-2` `--dots` `--ghost-ink` | Background glows, dot grid and ghost shape |
| `--ui-font` `--ui-bg` `--ui-ink` `--ui-muted` `--ui-border` `--ui-chip` `--ui-chip-ink` `--ui-send` | Drawn app UI: the composer, mock cards and tiles |
| `--cli-bg` `--cli-ink` `--cli-muted` `--cli-border` `--cli-bad` `--cli-radius` | Drawn terminal (optional; dark by default) |
| `--code-bg` `--code-ink` `--code-muted` `--code-border` `--code-radius` `--code-k` `--code-s` `--code-f` `--code-n` | Code card (optional; dark by default) |
| `--phone-caption` `--ui-send-ink` | Caption colour inside the phone bezel, and the glyph on the composer's send button (optional) |
| `--pet-ratio` `--ease` | Pet sprite aspect ratio and the shared easing curve |

`--shot-glow` sets the strength of every accent glow: under screenshots, drawn UI, terminal and code cards, the speaker portrait, the QR ring and legend dots. Components scale it, so `0%` turns all of them off.

`--accent` is not a theme token. The engine points it at the slide's slot colour, and components read it directly. Two tokens follow it per slide, so they are set on the component rather than on `:root`: `--cli-accent` and `--code-accent`. A light theme with dark accents needs lighter ones on the dark cards, for example `.cli{--cli-accent:color-mix(in srgb,var(--accent) 45%,#fff)}`.

## The background

Core draws two layers on every slide: `.slide::before` holds two radial glows in the slide's colour (`--glow-1`, `--glow-2`), drifting through the `--gx`/`--gy` positions, and `.slide::after` holds the dot grid (`--dots`). Set the tokens to `0%` and `transparent`, hide the layers with `display:none`, or override `background` and `animation` on them to draw your own; `aurora` replaces the glows with drifting aurora light. The dot grid is masked to one corner, so a full-stage pattern also resets `mask-image` on `::after`, as `blueprint` does for its drafting grid. Keep both layers inside the slide (`inset:0`), or every slide scrolls and QA fails. For a texture behind every slide, put it on `body`, as `paper` does with its grain.

## The personality layer

- **Mascots** are CSS masks. `--shape-<name>` and `--outline-<name>` hold the five shapes (pentagon, octagon, diamond, hexagon, triangle) and `--m1`–`--m5` colour them. Faces are holes, so they show whatever is behind. Replace a shape by setting its custom property to a data-URI SVG; hide them all with `.mascot{display:none}`; restyle them completely as `terminal` does.
- **Ghosts** are the faint outline in a slide corner, taking the outline of the slide's slot shape and the colour `--ghost-ink`. Hide them with `.ghost{display:none}` or restyle `.ghost`.
- **The cover cluster** keeps its column even when mascots are hidden, so a mascot-free theme should restyle `.mascots` (`keynote` turns it into quiet pastel shapes) or give `.slide--cover .split` one column.
- **The pet** is `<i class="pet" data-pose="wave">`. Its image is a background set in your theme: `.pet{background-image:url("assets/pet/wave.png")}` plus a rule per pose (`wave`, `coding`, `thinking`, `facepalm`). Set `--pet-ratio` to the sprite's width/height. Without one, templates show the drawn robot in its four poses. `?pet=<name>` in the URL sets `data-pet` on the root, so a template can keep an alternate pet behind `:root[data-pet="<name>"]`. For an animated pet, put the frames in one spritesheet and play them in CSS on `.pet::before`: reduced motion can then stop them, which it can't do for an animated GIF. The same pet appears in the `pets` lineup, the `agents` cards, `.pet-say` speech bubbles and, with `"petWalk": true`, walking along the progress bar.
- **Stickers, sparks and orbs** use `--sticker` and the palette, so they recolour with the theme.

## Rules that bite

- **Put `url()` in your own rules, not in tokens.** A relative `url()` stored in a custom property resolves against the stylesheet that uses it, which is a core or component file. So `.pet{background-image:url("assets/x.gif")}` in your theme works, but `--pet:url("assets/x.gif")` doesn't.
- **Masks must be data URIs.** Chrome blocks CSS masks loaded from files on `file://`. Images, backgrounds and `@font-face` files load fine offline.
- **Use `var(--accent)` in rules, not inside tokens.** A token like `--shadow: … var(--accent)` declared on `:root` freezes the root colour, so per-slide accents stop working. Declare such a token on the element that uses it instead, as `--cli-accent` is.
- **Keep `--panel` and `--panel-2` opaque.** They also back the notes panel, the overview and dialogs. For glass cards, use your own translucent fills in component overrides, as `aurora` does.
- **Contrast.** Eyebrows, footers and captions are small text: aim for 4.5:1 against `--bg` for `--a0`–`--a5`, `--muted` and `--signal`. Big titles need 3:1. `paper` darkened its vermilion and ochre to get there.
- **Keep the QR plain.** Dark modules on a white card, with no texture or overlay crossing it. `terminal` turns its scanlines off on the close slide. Scan your QA screenshot with a phone.
- **Every animation needs a reduced-motion rule.** Add `@media (prefers-reduced-motion:reduce){…}` for anything you animate.
- **No web-font CDNs.** Use system stacks, or put font files in `assets/fonts/` with `@font-face` in `theme.css`.
- **Fonts differ by machine.** `Iowan Old Style`, `Avenir Next` and `Avenir Next Condensed` are macOS fonts. Give every stack a fallback and accept a plainer look elsewhere. Avoid `DIN Condensed` for headlines: Chrome reports its advance widths about twice too wide, so highlights and underlines overshoot the text.
- **`--drop` must stay a valid shadow.** Components splice it into `box-shadow` lists, so `none` breaks the whole declaration. Turn it off with `0 0 0 0 transparent`.

## template.json

```json
{
  "name": "Paper",
  "description": "One line for the gallery.",
  "extends": null,
  "slides": ["cover", "speaker", "agenda", "chapter", "statement", "takeaways", "close"]
}
```

`slides` is the default list for `npm run new -- <dir> --template <name>`. Any name from `slides/index.json` works; see `npm run add -- --list`.

## Checking a style

1. `npm run qa -- examples/catalog --theme <name>` renders every slide pattern in your template at 1920×1080 and 1280×720 and fails on overflow, clipped code, broken media and console errors.
2. `npm run build` adds your template to the gallery in `examples/index.html`. QA doesn't need it, but the full `npm run qa` fails until you've run it.
3. Look at every screenshot in `qa/catalog/<name>/`. QA catches layout bugs, not ugly ones.
4. QA decodes the close slide's QR on macOS and fails if it doesn't match the link. Still scan it once with your phone from the screenshot.
5. Check `--motion` once: `npm run qa -- examples/catalog --theme <name> --motion --sizes 1280x720`.

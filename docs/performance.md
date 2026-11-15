# Performance

A deck sits idle on one slide for minutes at a time, often on a phone in someone's hand. Anything that keeps animating, repainting or running script while nobody is looking turns into heat and battery drain. `npm run perf` measures that.

## Measure

```sh
npm run perf                              # the catalog here, or site/ in a standalone deck
npm run perf -- examples/launch-night     # one deck
npm run perf -- <deck> --slide kickoff    # one slide, by id or number
npm run perf -- <deck> --size 390x844     # a phone-sized viewport
```

It opens each slide in headless Chromium, waits for the entrance to settle (`--settle`, 1500 ms), then records two seconds of idle (`--window`). Each row shows:

| Column | Meaning |
|---|---|
| `cpu%` | Main-thread time as a share of one core. An idle text slide sits around 1–3%. |
| `layout/s` | Layouts per second. Above zero at idle means something keeps changing size or position. |
| `style/s` | Style recalculations per second. 60 means something updates every frame. |
| `anims` | CSS and Web Animations running in the page. |

A slide is flagged when its CPU is over `--max-cpu` (5%), when animations run on a slide that isn't showing, when a hidden iframe keeps animating, or when an SVG with SMIL animation keeps running off-slide. Flags set exit code 1. A flag on a slide that animates on purpose, like a live graph, is fine once you've looked at it. Off-slide work never is.

Chromium on a desktop is a proxy. Phones have slower CPUs and less graphics memory, so treat any steady cost here as several times larger on a phone. To check a real iPhone, connect it to a Mac, open Safari's Develop menu, pick the page and record a Timelines run.

## Common causes and fixes

- **Animations on hidden slides.** The core pauses CSS animations on inactive slides and stops painting them once they fade out, so a deck gets this for free. Script-driven work doesn't: gate `requestAnimationFrame` loops, timers and canvas drawing on the slide's `is-active` class, or start and stop them from a `Deck.use` plugin.
- **SMIL inside SVG.** CSS can't pause it. Call `svg.pauseAnimations()` when the slide leaves and `unpauseAnimations()` when it returns.
- **Embedded pages.** An iframe keeps running its own animations whether or not its slide is showing. Load it when its slide opens, or have the embedded page pause itself when it isn't visible.
- **Full-screen effects that repaint every frame.** Animating a custom property, a gradient position, `filter` or `box-shadow` repaints the whole area each frame. Animate `transform` or `opacity` instead, or use `steps()` so it repaints a few times a second rather than sixty.
- **`backdrop-filter` over moving content.** The blur is recomputed every time anything behind it changes. Keep blurred panels over static backgrounds.
- **Big media on load.** `preload="auto"` on several videos downloads them all at once on a phone's connection. Keep it for the clip you play first, and give every video a `poster`.

## Phones and zoom

Phones get the native portrait layout by default; a deck's `resolution` applies only where there's a mouse or trackpad. A forced preview (`?res=1920x1080`) on a phone draws a full projector-size page and shrinks it to fit, so pinch-zooming into it makes the browser redraw that page at a much higher resolution. Keep forced previews for checking the layout, not for reading the deck on a phone.

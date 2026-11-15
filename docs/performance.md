# Performance

A deck sits idle on one slide for minutes at a time, often on a phone in someone's hand. Anything that keeps animating, repainting or running script while nobody is looking turns into heat and battery drain. `npm run perf` measures that.

## Measure

```sh
npm run perf                              # the catalog here, or site/ in a standalone deck
npm run perf -- examples/launch-night     # one deck
npm run perf -- <deck> --slide kickoff    # one slide, by id or number
npm run perf -- <deck> --size 390x844     # a phone-sized viewport
```

It opens each slide in headless Chromium with the GPU on, waits for the entrance to settle (`--settle`, 1500 ms), then records two seconds of idle (`--window`). Each row shows:

| Column | Meaning |
|---|---|
| `main%` | The page's main-thread time as a share of one core. An idle text slide sits near 0%. |
| `all%` | CPU across every browser process (renderer, GPU, browser), so compositing and raster work count. Any running animation costs about 4% here. |
| `layout/s` | Layouts per second. Above zero at idle means something keeps changing size or position. |
| `style/s` | Style recalculations per second. 60 means something updates every frame. |
| `anims` | CSS and Web Animations running in the page. |

Under each row, `repaints:` names any looping animation of a property other than `transform` or `opacity`, with the share of the screen it covers. Those repaint on every frame they change.

A slide is flagged when its main thread is over `--max-cpu` (5%), when all processes are over `--max-total` (25%), when style recalculates 30 or more times a second, when a looping animation repaints 10% of the screen or more, when animations run on a slide that isn't showing, when a hidden iframe keeps animating, or when an SVG with SMIL animation keeps running off-slide. Flags set exit code 1. A flag on a slide that animates on purpose, like a live graph, is fine once you've looked at it. Off-slide work never is. The summary converts the average into CPU-minutes an hour.

These are desktop Chromium numbers, and CPU time is not watts. A phone's cost differs by browser, screen and refresh rate rather than by a fixed factor. To check a real iPhone, connect it to a Mac, open Safari's Develop menu, pick the page and record a Timelines run. Without the GPU, headless Chromium composites in software and a full-screen glide looks ten times costlier than it is, which is why the tool asks for the GPU.

## Common causes and fixes

- **Animations on hidden slides.** The core pauses CSS animations on inactive slides and stops painting them once they fade out, so a deck gets this for free. Script-driven work doesn't: gate `requestAnimationFrame` loops, timers and canvas drawing on the slide's `is-active` class, or start and stop them from a `Deck.use` plugin.
- **SMIL inside SVG.** CSS can't pause it. Call `svg.pauseAnimations()` when the slide leaves and `unpauseAnimations()` when it returns.
- **Embedded pages.** An iframe keeps running its own animations whether or not its slide is showing. Load it when its slide opens, or have the embedded page pause itself when it isn't visible.
- **Full-screen effects that repaint every frame.** Animating a custom property, a gradient position or `box-shadow` repaints the whole area each frame. Draw the effect once on its own element and animate that element's `transform` or `opacity`, as the core's drifting glow does. `steps()` cuts repaints but not the per-frame style work, and it looks choppy.
- **`var()` inside keyframes.** Chrome runs a `transform` animation on the main thread when its keyframes read a custom property. Keep keyframe values literal and put per-element differences on a property the animation doesn't touch, such as `rotate`.
- **Long idle.** After 90 seconds without input the core pauses every looping animation on the active slide, and SMIL in its SVGs, until the next key, tap or mouse move. Set `"idle"` in the config block to change the seconds, or `0` to turn it off. Script-driven loops should check `document.documentElement.classList.contains("is-resting")`.
- **`backdrop-filter` over moving content.** The blur is recomputed every time anything behind it changes. Keep blurred panels over static backgrounds.
- **Big media on load.** `preload="auto"` on several videos downloads them all at once on a phone's connection. Keep it for the clip you play first, and give every video a `poster`.

## Phones and zoom

Phones get the native portrait layout by default; a deck's `resolution` applies only where there's a mouse or trackpad. A forced preview (`?res=1920x1080`) on a phone draws a full projector-size page and shrinks it to fit, so pinch-zooming into it makes the browser redraw that page at a much higher resolution. Keep forced previews for checking the layout, not for reading the deck on a phone.

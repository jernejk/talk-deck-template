# Motion for drawn diagrams

The `motion` component adds four opt-in helpers for SVG diagrams on a slide. They run only on the open slide and start again when you come back. With reduced motion, and so in QA screenshots, they show a still frame. Colour them with `--c`, for example `var(--a3)`. The default colour is the `--accent` of the slide.

| Class | What moves | Knobs |
|---|---|---|
| `.mx-draw` | A stroke draws itself in when the slide opens, or when Space shows its step. Give the shape `pathLength="1"`. | `--t` duration, `--d` delay |
| `.mx-pulse` | A node or dot breathes, on SVG or HTML. | `--t` period, `--d` delay, `--s` scale |
| `g.mx-orbit` | Its children circle the group's origin. Place the group with `transform="translate(x y)"`. | `--r` radius in px (user units), `--t` one lap, `--i` phase |
| `g.mx-travel` | Its dots move along the group's first `<path>`. | `--t` one trip, `--i` phase |

Orbit and travel dots spread out evenly. The plugin numbers them (`--i`) unless you set `--i` yourself. With reduced motion, each dot stops at its own place on the path or the circle. The still frame thus shows the flow.

Wrap the diagram in `figure.motion > svg + figcaption` and say in the caption that it is drawn. Inside the SVG, `.mx-node` is a card box, `.mx-hub` a lit node and `.mx-line` a quiet connector. Text is centred on its `x` and `y`. The type sizes suit a `viewBox` that is 1200 units wide. `slides/motion.html` uses all four helpers.

## Recipes

A connector that draws in on Space:

```html
<figure class="motion">
  <svg viewBox="0 0 1200 200" role="img" aria-label="Build feeds Deploy">
    <rect class="mx-node" x="40" y="60" width="240" height="80" rx="16"/><text x="160" y="100">Build</text>
    <g data-step>
      <path class="mx-draw" pathLength="1" d="M280 100 L 920 100"/>
      <rect class="mx-node" x="920" y="60" width="240" height="80" rx="16"/><text x="1040" y="100">Deploy</text>
    </g>
  </svg>
  <figcaption><b>Drawn</b>sample pipeline</figcaption>
</figure>
```

A live dot beside a heading, in plain HTML:

```html
<h3><span class="mx-pulse" style="display:inline-block;width:.6em;height:.6em;border-radius:50%;background:var(--ok)"></span> Running</h3>
```

Three tools circling a hub:

```html
<circle class="mx-hub" cx="600" cy="200" r="70"/><text x="600" y="200">Agent</text>
<g class="mx-orbit" transform="translate(600 200)" style="--r:110px;--t:12s;--c:var(--a3)" aria-hidden="true">
  <circle r="9"/><circle r="9"/><circle r="9"/>
</g>
```

Packets on a curved route, phase-shifted:

```html
<g class="mx-travel" style="--t:4s" aria-hidden="true">
  <path d="M100 200 C 400 60, 800 340, 1100 200"/>
  <circle r="8"/><circle r="8"/><circle r="8"/><circle r="8"/>
</g>
```

## Your own motion

For other motion, start a `requestAnimationFrame` loop on `enter` and stop it on `leave`. With reduced motion, draw the end state. Put this in a component's `<name>.js`, or in a `<script>` after `components.js`:

```js
Deck.use({
  name: "gauge",
  enter(slide, deck) {
    const el = slide.querySelector(".gauge");
    if (!el) return;
    if (deck.reducedMotion()) return el.style.setProperty("--v", 1);
    const t0 = performance.now();
    const tick = now => { el.style.setProperty("--v", Math.min(1, (now - t0) / 1500)); slide.raf = requestAnimationFrame(tick); };
    slide.raf = requestAnimationFrame(tick);
  },
  leave(slide) { cancelAnimationFrame(slide.raf); }
});
```

Then drive the look from CSS, for example `width:calc(var(--v,1) * 100%)`. QA renders with reduced motion, so the screenshots show the still frame. `npm run qa -- --motion` renders with motion on.

const frames = new Map();
const ms = v => (parseFloat(v) || 4) * (/ms$/.test(v.trim()) ? 1 : 1000);
const dotsOf = g => [...g.children].filter(el => el.localName !== "path");

Deck.use({
  name: "motion",
  init(slide) {
    slide.querySelectorAll(".mx-orbit, .mx-travel").forEach(g => {
      const dots = g.matches(".mx-travel") ? dotsOf(g) : [...g.children];
      g.style.setProperty("--n", dots.length);
      dots.forEach((dot, i) => { if (!dot.style.getPropertyValue("--i")) dot.style.setProperty("--i", i); });
    });
  },
  enter(slide, deck) {
    const plan = [...slide.querySelectorAll(".mx-travel")].map(g => {
      const path = g.querySelector(":scope > path");
      const dots = dotsOf(g);
      return { path, len: path.getTotalLength(), t: ms(getComputedStyle(g).getPropertyValue("--t")), dots: dots.map(d => [d, (Number(getComputedStyle(d).getPropertyValue("--i")) || 0) / dots.length]) };
    });
    if (!plan.length) return;
    // ponytail: reduced motion parks each dot at its share of the path, so the still frame shows the flow.
    const still = deck.reducedMotion();
    const t0 = performance.now();
    const tick = now => {
      plan.forEach(({ path, len, t, dots }) => dots.forEach(([dot, phase]) => {
        const p = still ? phase + .5 / dots.length : ((now - t0) / t + phase) % 1;
        const { x, y } = path.getPointAtLength(p * len);
        dot.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      }));
      if (!still) frames.set(slide, requestAnimationFrame(tick));
    };
    tick(t0);
  },
  leave(slide) {
    cancelAnimationFrame(frames.get(slide));
    frames.delete(slide);
  }
});

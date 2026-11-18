let travel;
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
  enter(slide) {
    const plan = [...slide.querySelectorAll(".mx-travel")].map(g => {
      const path = g.querySelector(":scope > path");
      const dots = dotsOf(g);
      return { path, len: path.getTotalLength(), t: ms(getComputedStyle(g).getPropertyValue("--t")), dots: dots.map(d => [d, (Number(getComputedStyle(d).getPropertyValue("--i")) || 0) / dots.length]) };
    });
    if (!plan.length) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = null, last = null, elapsed = 0;
    function paint(still) {
      plan.forEach(({ path, len, t, dots }) => dots.forEach(([dot, phase]) => {
        const p = still ? phase + .5 / dots.length : (elapsed / t + phase) % 1;
        const { x, y } = path.getPointAtLength(p * len);
        dot.setAttribute("transform", 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      }));
    }
    function tick(now) {
      if (last !== null) elapsed += now - last;
      last = now;
      paint(false);
      frame = requestAnimationFrame(tick);
    }
    function pause() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = last = null;
    }
    function resume() {
      if (media.matches || frame !== null || document.documentElement.classList.contains("is-resting")) return;
      frame = requestAnimationFrame(tick);
    }
    function changeMotion() {
      if (media.matches) { pause(); paint(true); }
      else { paint(false); resume(); }
    }
    media.addEventListener("change", changeMotion);
    travel = { pause, resume, dispose() { pause(); media.removeEventListener("change", changeMotion); } };
    changeMotion();
  },
  rest() { travel?.pause(); },
  wake() { travel?.resume(); },
  leave() {
    travel?.dispose();
    travel = undefined;
  }
});

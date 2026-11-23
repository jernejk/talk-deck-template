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
  enter(slide, deck) {
    if (slide !== deck.current()) return;
    travel?.dispose();
    travel = undefined;
    const plan = [...slide.querySelectorAll(".mx-travel")].map(g => {
      const path = g.querySelector(":scope > path");
      const dots = dotsOf(g);
      return { path, len: path.getTotalLength(), t: ms(getComputedStyle(g).getPropertyValue("--t")), dots: dots.map(d => [d, (Number(getComputedStyle(d).getPropertyValue("--i")) || 0) / dots.length]) };
    });
    if (!plan.length) return;
    let frame = null, last = null, elapsed = 0;
    function paint(still) {
      const positions = plan.flatMap(({ path, len, t, dots }) => dots.map(([dot, phase]) => {
        const p = still ? phase + .5 / dots.length : (elapsed / t + phase) % 1;
        const { x, y } = path.getPointAtLength(p * len);
        return [dot, x, y];
      }));
      positions.forEach(([dot, x, y]) => dot.setAttribute("transform", 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')'));
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
      if (deck.reducedMotion() || frame !== null || document.documentElement.classList.contains("is-resting")) return;
      frame = requestAnimationFrame(tick);
    }
    function changeMotion() {
      if (deck.reducedMotion()) { pause(); paint(true); }
      else { paint(false); resume(); }
    }
    travel = { slide, pause, resume, changeMotion, dispose: pause };
    changeMotion();
  },
  motion() { travel?.changeMotion(); },
  rest(slide) { if (travel?.slide === slide) travel.pause(); },
  wake(slide) { if (travel?.slide === slide) travel.resume(); },
  leave(slide) {
    if (travel?.slide !== slide) return;
    travel.dispose();
    travel = undefined;
  }
});

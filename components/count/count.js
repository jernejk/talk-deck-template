Deck.use({
  name: "count",
  enter(slide, deck) {
    slide.querySelectorAll("[data-count]").forEach(el => {
      const to = Number(el.dataset.count);
      if (deck.reducedMotion()) { el.textContent = to; return; }
      const start = performance.now() + 450;
      const tick = now => {
        const t = Math.min(1, Math.max(0, (now - start) / 1100));
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = 0;
      requestAnimationFrame(tick);
    });
  }
});

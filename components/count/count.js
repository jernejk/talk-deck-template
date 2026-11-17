const countsIn = root => root.matches?.("[data-count]") ? [root] : [...root.querySelectorAll("[data-count]")];

function countIn(root, deck) {
  countsIn(root).forEach(el => {
    cancelAnimationFrame(el._frame);
    if (el.closest("[data-step]:not(.is-shown)")) return;
    const to = Number(el.dataset.count);
    if (deck.reducedMotion()) { el.textContent = to; return; }
    const start = performance.now() + 450;
    const tick = now => {
      const t = Math.min(1, Math.max(0, (now - start) / 1100));
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) el._frame = requestAnimationFrame(tick);
    };
    el.textContent = 0;
    el._frame = requestAnimationFrame(tick);
  });
}

function stopCount(root) {
  countsIn(root).forEach(el => { cancelAnimationFrame(el._frame); el.textContent = el.dataset.count; });
}

Deck.use({
  name: "count",
  enter(slide, deck) { countIn(slide, deck); },
  step(els, slide, deck) { els.forEach(el => countIn(el, deck)); },
  unstep(els) { els.forEach(stopCount); },
  leave(slide) { stopCount(slide); }
});

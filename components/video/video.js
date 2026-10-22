function play(root, deck) {
  if (deck.reducedMotion()) return;
  root.querySelectorAll(".video video").forEach(v => {
    if (v.closest("[data-step]:not(.is-shown)")) return;
    v.muted = true;
    v.play().catch(e => { if (e.name !== "AbortError") console.error(`Video didn't start: ${e.message}`); });
  });
}

Deck.use({
  name: "video",
  enter(slide, deck) { play(slide, deck); },
  step(els, slide, deck) { els.forEach(el => play(el, deck)); },
  leave(slide) {
    slide.querySelectorAll(".video video").forEach(v => { v.pause(); v.currentTime = 0; });
  }
});

const videosIn = root => root.matches?.(".video video") ? [root] : [...root.querySelectorAll(".video video")];

function play(root, deck) {
  if (deck.reducedMotion()) return;
  videosIn(root).forEach(v => {
    if (v.closest("[data-step]:not(.is-shown)")) return;
    v.muted = true;
    v.play().catch(e => {
      if (e.name === "NotAllowedError") v.controls = true;
      else if (e.name !== "AbortError") console.error(`Video didn't start: ${e.message}`);
    });
  });
}

function stop(root) {
  videosIn(root).forEach(v => { v.pause(); v.currentTime = 0; });
}

Deck.use({
  name: "video",
  enter(slide, deck) { play(slide, deck); },
  step(els, slide, deck) { els.forEach(el => play(el, deck)); },
  unstep(els) { els.forEach(stop); },
  leave(slide) { stop(slide); }
});

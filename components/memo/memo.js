Deck.use({
  name: "memo",
  init(slide) {
    slide.querySelectorAll(".wave[data-n]").forEach(wave => {
      if (wave.childElementCount) return;
      for (let k = 0; k < Math.min(Number(wave.dataset.n) || 0, 120); k++) {
        const bar = document.createElement("i");
        bar.style.cssText = `--i:${k};--h:${Math.round(28 + Math.random() * 72)}`;
        wave.append(bar);
      }
    });
  }
});

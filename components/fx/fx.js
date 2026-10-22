Deck.use({
  name: "fx",
  init(slide) {
    const r = Math.random;
    slide.querySelectorAll(".sparks[data-n]").forEach(box => {
      if (box.childElementCount) return;
      for (let k = 0; k < Math.min(Number(box.dataset.n) || 0, 60); k++) {
        const spark = document.createElement("i");
        spark.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--c:var(--a${1 + Math.floor(r() * 6)});--t:${(9 + r() * 6).toFixed(1)}s;--dl:${(r() * 8).toFixed(1)}s;--z:${3 + Math.floor(r() * 4)}px;--dx:${Math.round(r() * 6 - 3)}vw`;
        box.append(spark);
      }
    });
  }
});

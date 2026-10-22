Deck.use({
  name: "diff",
  init(slide) {
    slide.querySelectorAll(".diff summary").forEach(summary => {
      summary.addEventListener("click", e => {
        if (e.detail > 0) slide.focus({ preventScroll: true });
      });
    });
  }
});

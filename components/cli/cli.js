Deck.use({
  name: "cli",
  init(slide) {
    slide.querySelectorAll(".cli").forEach(cli => {
      cli.querySelectorAll(".cli-line").forEach((line, i) => line.style.setProperty("--li", i));
    });
  }
});

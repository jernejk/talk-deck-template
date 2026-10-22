function update(slide, snap) {
  slide.querySelectorAll(".zoom").forEach(zoom => {
    const items = [...slide.querySelectorAll(".zoom-steps li[data-zoom]")];
    const shown = items.filter(li => li.classList.contains("is-shown"));
    const now = shown[shown.length - 1];
    items.forEach(li => li.classList.toggle("is-current", li === now));
    const [x = 50, y = 50, s = 1] = (now?.dataset.zoom || "").split(/\s+/).map(parseFloat).filter(Number.isFinite);
    if (snap) zoom.classList.add("is-snap");
    zoom.style.setProperty("--zx", x / 100);
    zoom.style.setProperty("--zy", y / 100);
    zoom.style.setProperty("--zs", Math.max(1, s));
    if (snap) {
      zoom.offsetWidth;
      zoom.classList.remove("is-snap");
    }
  });
}

Deck.use({
  name: "zoom",
  init: slide => update(slide, true),
  enter: slide => update(slide, true),
  step: (els, slide) => update(slide),
  unstep: (els, slide) => update(slide)
});

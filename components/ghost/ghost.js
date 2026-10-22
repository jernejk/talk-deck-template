Deck.use({
  name: "ghost",
  init(slide) {
    if (slide.dataset.ghost === "off" || slide.querySelector(".ghost")) return;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = `<i class="ghost"></i>`;
    slide.prepend(backdrop);
  }
});

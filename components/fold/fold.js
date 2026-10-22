const anyShown = fold => [...fold.querySelectorAll("[data-step]")].some(el => el.classList.contains("is-shown"));

Deck.use({
  name: "fold",
  init(slide) {
    slide.querySelectorAll(".fold").forEach(fold => {
      const steps = fold.querySelectorAll("[data-step]");
      fold.querySelector(":scope > summary").addEventListener("click", e => {
        if (e.detail > 0) slide.focus({ preventScroll: true });
      });
      if (!steps.length) return;
      fold.addEventListener("toggle", () => steps.forEach(el => {
        if (el.classList.contains("is-shown")) return;
        el.inert = !fold.open;
        el.setAttribute("aria-hidden", String(!fold.open));
      }));
    });
  },
  enter(slide) {
    slide.querySelectorAll(".fold").forEach(fold => {
      if (fold.querySelector("[data-step]")) fold.open = anyShown(fold);
    });
  },
  step(els) { els.forEach(el => { const f = el.closest(".fold"); if (f) f.open = true; }); },
  unstep(els) { els.forEach(el => { const f = el.closest(".fold"); if (f) f.open = anyShown(f); }); }
});

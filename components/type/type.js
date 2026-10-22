function typeIn(root, deck) {
  const targets = root.matches?.("[data-type]") ? [root] : root.querySelectorAll("[data-type]");
  targets.forEach(el => {
    const text = el.dataset.type;
    clearTimeout(el._timer);
    el.classList.remove("is-typed");
    if (el.closest("[data-step]:not(.is-shown)")) { el.textContent = ""; return; }
    if (deck.reducedMotion()) { el.textContent = text; el.classList.add("is-typed"); return; }
    el.textContent = "";
    el.classList.add("is-typing");
    let i = 0;
    const step = () => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) el._timer = setTimeout(step, 26 + Math.random() * 38);
      else { el.classList.remove("is-typing"); el.classList.add("is-typed"); }
    };
    el._timer = setTimeout(step, Number(el.dataset.delay || 700));
  });
}

Deck.use({
  name: "type",
  enter(slide, deck) { typeIn(slide, deck); },
  step(els, slide, deck) { els.forEach(el => typeIn(el, deck)); }
});

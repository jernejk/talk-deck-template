let walker = null;
let last = -1;
let timer = 0;

Deck.use({
  name: "pet-walk",
  enter(slide, deck) {
    if (!deck.config.petWalk) return;
    if (!walker) {
      walker = document.createElement("i");
      walker.className = "pet pet-walk";
      walker.setAttribute("aria-hidden", "true");
      document.body.append(walker);
    }
    const flow = deck.slides().filter(s => !s.classList.contains("is-excluded"));
    const i = flow.indexOf(slide);
    const share = (i + 1) / flow.length;
    walker.style.translate = `max(0px, calc(${share * 100}vw - 100%)) 0`;
    walker.classList.toggle("is-back", i < last);
    if (slide.id === "close") walker.dataset.pose = "wave";
    else delete walker.dataset.pose;
    if (last >= 0 && i !== last && !deck.reducedMotion()) {
      walker.classList.add("is-walking");
      clearTimeout(timer);
      timer = setTimeout(() => walker.classList.remove("is-walking"), 700);
    }
    last = i;
  }
});

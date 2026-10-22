let items = null;

function agendaItems(deck) {
  if (items) return items;
  const config = deck.config;
  const slides = deck.slides();
  const slotOf = section => {
    const slide = slides.find(s => (s.dataset.section || "") === section);
    return slide ? slide.dataset.slot : config.sections?.[section] ?? 1;
  };
  let list = Array.isArray(config.agenda) ? config.agenda : null;
  if (!list) {
    const seen = new Set();
    list = [];
    slides.forEach(s => {
      const section = s.dataset.section || "";
      if (!section || s.hasAttribute("data-hidden") || seen.has(section)) return;
      seen.add(section);
      if (section === "Welcome" || config.sections?.[section] === 0) return;
      list.push({ section });
    });
  }
  items = list.map(it => ({ ...it, title: it.title || it.section, slot: slotOf(it.section) }));
  return items;
}

function positionOf(slide, deck) {
  const list = agendaItems(deck);
  const find = section => list.findIndex(it => it.section === section);
  if (slide.dataset.agendaCurrent !== undefined) return find(slide.dataset.agendaCurrent);
  if (slide.classList.contains("slide--cover") || slide.classList.contains("slide--cover-split")) return -1;
  let pos = -1;
  for (const s of deck.slides()) {
    const i = find(s.dataset.section || "");
    if (i >= 0) pos = i;
    if (s === slide) break;
  }
  return pos;
}

const stateOf = (i, pos) => i < pos ? "is-done" : i === pos ? "is-current" : "is-upcoming";

function fillList(ol, list, pos) {
  ol.replaceChildren(...list.map((it, i) => {
    const li = document.createElement("li");
    li.className = stateOf(i, pos);
    li.style.setProperty("--c", `var(--a${it.slot})`);
    if (i === pos) li.setAttribute("aria-current", "step");
    const parts = [["b", "agenda-num", String(i + 1).padStart(2, "0")], ["strong", "agenda-title", it.title]];
    if (it.note) parts.push(["span", "agenda-note", it.note]);
    if (it.time) parts.push(["time", "agenda-time", it.time]);
    parts.forEach(([tag, cls, text]) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      li.append(el);
    });
    return li;
  }));
}

function addDots(slide, list, pos) {
  const foot = slide.querySelector(".slide-foot");
  if (!foot || foot.querySelector(".foot-agenda")) return;
  const dots = document.createElement("span");
  dots.className = "foot-agenda";
  dots.setAttribute("role", "img");
  dots.setAttribute("aria-label", pos >= 0 ? `Part ${pos + 1} of ${list.length}: ${list[pos].title}` : `${list.length} parts`);
  list.forEach((it, i) => {
    const dot = document.createElement("i");
    dot.className = stateOf(i, pos);
    dot.style.setProperty("--c", `var(--a${it.slot})`);
    dots.append(dot);
  });
  foot.insertBefore(dots, foot.querySelector(".foot-count"));
}

Deck.use({
  name: "agenda",
  init(slide, deck) {
    const list = agendaItems(deck);
    if (!list.length) return;
    const pos = positionOf(slide, deck);
    slide.querySelectorAll("ol.agenda[data-auto]").forEach(ol => fillList(ol, list, pos));
    if (deck.config.agendaDots !== false) addDots(slide, list, pos);
  }
});

const CONFIG = JSON.parse(document.getElementById("deck-config")?.textContent || "{}");
const DECK_TITLE = CONFIG.title || document.title;

const REVEAL = [
  ".eyebrow", ".title", ".sub", ".lede", ".quote", ".ask", ".shot", ".phone", ".tilt", ".card", ".stat", ".bubble",
  ".ladder li", ".memo", ".ledger", ".recipe", ".chips", ".tags", ".legend", ".hint", ".cover-meta", ".facts", ".callout",
  ".pillar", ".counters", ".scrollshot", ".flow", ".composer", ".mock", ".timeline", ".compare", ".sticker",
  ".about-logo", ".about-name", ".about-summary", ".about-links"
].join(",");

const $ = (sel, root = document) => root.querySelector(sel);

const deck = { all: [], visible: [], index: 0, showExtras: false };
const slots = new Map(Object.entries(CONFIG.sections || {}));
let autoSlot = 0;

function current() { return deck.visible[deck.index]; }

function slotFor(section) {
  if (!slots.has(section)) slots.set(section, autoSlot++ % 5 + 1);
  return slots.get(section);
}

function accentOf(slide) { return slide.style.getPropertyValue("--accent") || "var(--a1)"; }

function sprinkle(box) {
  const r = Math.random;
  for (let k = 0; k < Math.min(Number(box.dataset.n) || 0, 60); k++) {
    const spark = document.createElement("i");
    spark.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--c:var(--a${1 + Math.floor(r() * 6)});--t:${(9 + r() * 6).toFixed(1)}s;--dl:${(r() * 8).toFixed(1)}s;--z:${3 + Math.floor(r() * 4)}px;--dx:${Math.round(r() * 6 - 3)}vw`;
    box.append(spark);
  }
}

function waveform(box) {
  for (let k = 0; k < Math.min(Number(box.dataset.n) || 0, 120); k++) {
    const bar = document.createElement("i");
    bar.style.cssText = `--i:${k};--h:${Math.round(28 + Math.random() * 72)}`;
    box.append(bar);
  }
}

function decorate() {
  deck.all = Array.from(document.querySelectorAll("section.slide"));
  deck.all.forEach(slide => {
    slide.tabIndex = -1;
    setSteps(slide, "start");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", slide.dataset.title || "");
    const slot = slotFor(slide.dataset.section || "");
    slide.dataset.slot = slot;
    if (!slide.style.getPropertyValue("--accent")) slide.style.setProperty("--accent", `var(--a${slot})`);
    let i = 0;
    slide.querySelectorAll(REVEAL).forEach(el => {
      if (el.closest("[data-step]") || el.parentElement.closest("[data-r]")) return;
      el.dataset.r = "";
      el.style.setProperty("--i", Math.min(i++, 9));
    });
    slide.querySelectorAll(".sparks[data-n]").forEach(sprinkle);
    slide.querySelectorAll(".wave[data-n]").forEach(waveform);
    slide.querySelectorAll(".mascot, .pet, .fx, .wave").forEach(el => el.setAttribute("aria-hidden", "true"));
    if (slide.dataset.ghost !== "off" && !slide.querySelector(".ghost")) {
      const backdrop = document.createElement("div");
      backdrop.className = "backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.innerHTML = `<i class="ghost"></i>`;
      slide.prepend(backdrop);
    }
    if (!slide.querySelector(".slide-foot")) {
      const foot = document.createElement("div");
      foot.className = "slide-foot";
      foot.innerHTML = `<span class="foot-brand"></span><span><em></em><span class="foot-live"></span></span><span class="foot-count"></span>`;
      foot.querySelector(".foot-brand").textContent = CONFIG.brand || "";
      foot.querySelector("em").textContent = slide.dataset.section || "";
      if (slide.dataset.live) foot.querySelector(".foot-live").textContent = `Live: ${slide.dataset.live}`;
      slide.appendChild(foot);
    }
  });
}

function refreshVisible(keep, opts = {}) {
  deck.visible = deck.all.filter(s => deck.showExtras || !s.hasAttribute("data-hidden"));
  deck.all.forEach(s => {
    const inFlow = deck.visible.includes(s);
    s.classList.toggle("is-excluded", !inFlow);
    const count = s.querySelector(".foot-count");
    if (count && !inFlow) count.textContent = "presenter extra";
  });
  deck.visible.forEach((s, i) => {
    const count = s.querySelector(".foot-count");
    if (count) count.textContent = `${i + 1} / ${deck.visible.length}${s.hasAttribute("data-hidden") ? " · extra" : ""}`;
  });
  $("#badge").hidden = !deck.showExtras;
  $('[data-action="extras"]').setAttribute("aria-pressed", String(deck.showExtras));
  const at = keep ? deck.visible.indexOf(keep) : -1;
  show(at >= 0 ? at : Math.min(deck.index, deck.visible.length - 1), opts);
}

function setStepVisible(el, visible) {
  el.classList.toggle("is-shown", visible);
  el.inert = !visible;
  el.setAttribute("aria-hidden", String(!visible));
}

function stepGroups(slide) {
  const groups = [];
  const named = new Map();
  slide.querySelectorAll("[data-step]").forEach(el => {
    const key = el.dataset.step;
    if (key && named.has(key)) return named.get(key).push(el);
    const group = [el];
    if (key) named.set(key, group);
    groups.push(group);
  });
  return groups;
}

function setSteps(slide, mode) {
  const groups = stepGroups(slide);
  const shown = mode === "end" ? groups.length : 0;
  slide.dataset.shown = shown;
  groups.forEach((g, i) => g.forEach(el => setStepVisible(el, i < shown)));
}

function show(n, { updateHash = true, stepMode = "start" } = {}) {
  const before = current();
  deck.index = Math.max(0, Math.min(deck.visible.length - 1, n));
  const active = current();
  if (before !== active || stepMode === "end") setSteps(active, stepMode);
  deck.all.forEach(s => {
    const on = s === active;
    s.classList.toggle("is-active", on);
    s.inert = !on;
    s.setAttribute("aria-hidden", String(!on));
  });

  const bar = $("#progress");
  bar.style.width = `${(deck.index + 1) / deck.visible.length * 100}%`;
  bar.style.setProperty("--accent", accentOf(active));
  const name = active.dataset.title || "Slide";
  document.title = name === DECK_TITLE ? name : `${name} · ${DECK_TITLE}`;
  $("#sr-status").textContent = `Slide ${deck.index + 1} of ${deck.visible.length}: ${active.dataset.title || ""}`;
  renderNotes();
  if (before !== active) { countUp(active); typeOut(active); }
  if (updateHash && active.id) history.replaceState(null, "", "#" + active.id);
}

function countUp(slide) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  slide.querySelectorAll("[data-count]").forEach(el => {
    const to = Number(el.dataset.count);
    if (reduce) { el.textContent = to; return; }
    const start = performance.now() + 450;
    const tick = now => {
      const t = Math.min(1, Math.max(0, (now - start) / 1100));
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = 0;
    requestAnimationFrame(tick);
  });
}

function typeOut(root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = root.matches?.("[data-type]") ? [root] : root.querySelectorAll("[data-type]");
  targets.forEach(el => {
    const text = el.dataset.type;
    const pending = el.closest("[data-step]:not(.is-shown)");
    if (pending) { clearTimeout(el._timer); el.textContent = ""; return; }
    const box = el.closest(".composer");
    clearTimeout(el._timer);
    box?.classList.remove("is-done");
    if (reduce) { el.textContent = text; box?.classList.add("is-done"); return; }
    el.textContent = "";
    el.classList.add("is-typing");
    let i = 0;
    const step = () => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) el._timer = setTimeout(step, 26 + Math.random() * 38);
      else { el.classList.remove("is-typing"); box?.classList.add("is-done"); }
    };
    el._timer = setTimeout(step, Number(el.dataset.delay || 700));
  });
}

function next() {
  const slide = current();
  const groups = stepGroups(slide);
  const shown = Number(slide.dataset.shown) || 0;
  if (shown < groups.length) {
    groups[shown].forEach(el => { setStepVisible(el, true); typeOut(el); });
    slide.dataset.shown = shown + 1;
    return;
  }
  show(deck.index + 1);
}

function prev() {
  const slide = current();
  const groups = stepGroups(slide);
  const shown = Number(slide.dataset.shown) || 0;
  if (shown > 0) {
    groups[shown - 1].forEach(el => setStepVisible(el, false));
    slide.dataset.shown = shown - 1;
    return;
  }
  if (deck.index > 0) show(deck.index - 1, { stepMode: "end" });
}

function goTo(slide, opts = {}) {
  if (!slide) return;
  if (!deck.visible.includes(slide)) {
    deck.showExtras = true;
    refreshVisible(slide, opts);
  } else {
    show(deck.visible.indexOf(slide), opts);
  }
}

function toggleExtras() {
  const keep = current();
  deck.showExtras = !deck.showExtras;
  refreshVisible(keep);
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $("#sr-status").textContent = "Fullscreen was not granted. Use your browser's fullscreen menu.";
  }
}

function renderNotes() {
  const slide = current();
  const source = slide.querySelector("aside.notes");
  $("#notes-title").textContent = `${deck.index + 1} / ${deck.visible.length} · ${slide.dataset.title || ""}`;
  $("#notes-body").innerHTML = source ? source.innerHTML : "<p>No notes for this slide.</p>";
}

function toggleNotes(force) {
  const panel = $("#notes-panel");
  const open = force ?? !panel.classList.contains("is-open");
  panel.classList.toggle("is-open", open);
  panel.inert = !open;
  panel.setAttribute("aria-hidden", String(!open));
  $('[data-action="notes"]').setAttribute("aria-pressed", String(open));
}

function openDialog(dialog, invoker) {
  dialog.returnFocusTo = invoker instanceof Element ? invoker : document.activeElement;
  dialog.showModal();
}

document.querySelectorAll("dialog.overlay").forEach(dialog => {
  dialog.addEventListener("close", () => {
    const target = dialog.returnFocusTo;
    dialog.returnFocusTo = null;
    const usable = target instanceof Element && target !== document.body && target.isConnected && !target.closest(".is-excluded, [inert]");
    if (usable) target.focus();
    else focusDeck();
  });
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
});

function openOverview(invoker) {
  const list = $("#overview-list");
  list.replaceChildren();
  deck.all.forEach((slide, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.setProperty("--c", accentOf(slide));
    btn.innerHTML = `<span class="ov-num"></span><span class="ov-title"></span>`;
    btn.querySelector(".ov-num").textContent = String(i + 1).padStart(2, "0");
    btn.querySelector(".ov-title").textContent = slide.dataset.title || "";
    const tagText = slide.hasAttribute("data-hidden") ? "Presenter extra" : slide.dataset.live ? `Live: ${slide.dataset.live}` : "";
    if (tagText) {
      const tag = document.createElement("span");
      tag.className = "ov-tag";
      tag.textContent = tagText;
      btn.append(tag);
    }
    if (slide === current()) btn.setAttribute("aria-current", "true");
    btn.addEventListener("click", () => {
      const dialog = $("#overview");
      dialog.returnFocusTo = null;
      dialog.close();
      goTo(slide);
      focusDeck();
    });
    li.append(btn);
    list.append(li);
  });
  openDialog($("#overview"), invoker);
  const here = list.querySelector('[aria-current="true"]');
  if (here) here.focus();
}

function jumpToClose() {
  goTo($("#close"));
  focusDeck();
}

function focusDeck() {
  const slide = current();
  if (slide) slide.focus({ preventScroll: true });
}

const ACTIONS = {
  prev, next,
  overview: openOverview,
  notes: () => toggleNotes(),
  extras: toggleExtras,
  close: jumpToClose,
  fullscreen: toggleFullscreen
};

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (btn && ACTIONS[btn.dataset.action]) {
    e.preventDefault();
    ACTIONS[btn.dataset.action](btn);
  }
  const closer = e.target.closest("dialog [data-close]");
  if (closer) closer.closest("dialog").close();
});

function isOwnedByControl(target) {
  return target instanceof Element &&
    target.closest('input, textarea, select, video, audio, iframe, [contenteditable]:not([contenteditable="false"])');
}

document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector("dialog[open]")) return;
  const t = e.target;
  if (isOwnedByControl(t)) return;
  const k = e.key;
  if ((k === " " || k === "Enter") && t instanceof Element && t.closest("button, a, summary")) return;

  if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); next(); }
  else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); prev(); }
  else if (k === "Home") { e.preventDefault(); show(0); }
  else if (k === "End") { e.preventDefault(); show(deck.visible.length - 1, { stepMode: "end" }); }
  else if (k === "h" || k === "H") { e.preventDefault(); toggleExtras(); }
  else if (k === "f" || k === "F") { e.preventDefault(); toggleFullscreen(); }
  else if (k === "n" || k === "N") { e.preventDefault(); toggleNotes(); }
  else if (k === "o" || k === "O" || k === "g" || k === "G") { e.preventDefault(); openOverview(); }
  else if (k === "c" || k === "C") { e.preventDefault(); jumpToClose(); }
  else if (k === "Escape" && $("#notes-panel").classList.contains("is-open")) { toggleNotes(false); }
});

let touch = null;
document.addEventListener("touchstart", e => {
  const t = e.target;
  if (e.touches.length !== 1 || (t instanceof Element && t.closest("button, a, input, details, dialog, .notes-panel"))) { touch = null; return; }
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener("touchend", e => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
}, { passive: true });

function slideFromHash() {
  let h;
  try { h = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
  if (!h) return null;
  const byId = document.getElementById(h);
  if (byId && byId.matches("section.slide")) return byId;
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? deck.all[n - 1] || null : null;
}

document.querySelectorAll(".shot img").forEach(img => {
  const figure = img.closest(".shot");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "image-zoom";
  button.setAttribute("aria-label", "Enlarge: " + img.alt);
  img.before(button);
  button.append(img);
  button.addEventListener("click", () => {
    const large = $("#image-viewer-img");
    large.src = img.currentSrc || img.src;
    large.alt = img.alt;
    $("#image-viewer-caption").textContent = figure.querySelector("figcaption")?.textContent || img.alt;
    openDialog($("#image-viewer"), button);
  });
});

decorate();
toggleNotes(false);
refreshVisible(null, { updateHash: false });
const entry = slideFromHash();
if (entry) goTo(entry, { updateHash: false });

window.addEventListener("hashchange", () => {
  const target = slideFromHash();
  if (target && target !== current()) goTo(target, { updateHash: false });
});

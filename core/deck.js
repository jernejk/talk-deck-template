(() => {
  const CONFIG = JSON.parse(document.getElementById("deck-config")?.textContent || "{}");
  const DECK_TITLE = CONFIG.title || document.title;
  const plugins = [];
  const deck = { all: [], visible: [], index: 0, active: null, showExtras: false, started: false };
  const slots = new Map(Object.entries(CONFIG.sections || {}));
  let autoSlot = 0;
  const RESERVED_KEYS = "hfnogc";
  const controlKeys = new Map();
  const pendingControls = [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CONTROLS = `
<div id="sr-status" class="sr-only" aria-live="polite"></div>
<nav class="deck-nav" aria-label="Slide controls">
  <button type="button" class="nav-arrow" data-action="prev" aria-label="Previous slide">‹</button>
  <button type="button" class="nav-arrow" data-action="next" aria-label="Next slide">›</button>
  <button type="button" data-action="overview" aria-haspopup="dialog">Slides<kbd>O</kbd></button>
  <button type="button" data-action="notes" aria-controls="notes-panel" aria-pressed="false">Notes<kbd>N</kbd></button>
  <button type="button" data-action="extras" aria-pressed="false">Extras<kbd>H</kbd></button>
  <button type="button" data-action="close">To close<kbd>C</kbd></button>
  <button type="button" data-action="fullscreen">Full<kbd>F</kbd></button>
</nav>
<div id="badge" class="badge" hidden>Extras on</div>
<div id="progress" class="progress"></div>
<section id="notes-panel" class="notes-panel" aria-label="Speaker notes">
  <div class="notes-head"><span id="notes-title"></span><span>N to hide</span></div>
  <div id="notes-body" class="notes-body"></div>
</section>
<dialog id="overview" class="overlay" aria-labelledby="overview-title">
  <div class="dialog-head"><h2 id="overview-title">All slides</h2><button type="button" class="btn" data-close>Close</button></div>
  <p class="dialog-hint">Presenter extras are skipped in the main flow. Choosing one turns extras on. Esc closes.</p>
  <ol id="overview-list" class="overview-list"></ol>
</dialog>`;

  const api = {
    config: CONFIG,
    slides: () => deck.all,
    current: () => current(),
    goTo: (slide, opts) => goTo(slide, opts),
    openDialog: (dialog, invoker) => openDialog(dialog, invoker),
    control: opts => control(opts),
    reducedMotion
  };

  function emit(hook, ...args) {
    plugins.forEach(p => {
      try { p[hook]?.(...args, api); } catch (e) { console.error(`Deck plugin "${p.name || "?"}" failed in ${hook}:`, e); }
    });
  }

  function current() { return deck.visible[deck.index]; }

  function control({ label, key, action, pressed }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    if (pressed !== undefined) btn.setAttribute("aria-pressed", String(Boolean(pressed)));
    btn.addEventListener("click", e => { e.preventDefault(); action(btn); });
    const k = String(key || "").toLowerCase();
    if (k) {
      const kbd = document.createElement("kbd");
      kbd.textContent = k.toUpperCase();
      btn.append(kbd);
      if (k.length !== 1 || RESERVED_KEYS.includes(k) || controlKeys.has(k)) console.warn(`Deck control "${label}": key "${key}" is taken or not a single letter; not bound.`);
      else controlKeys.set(k, () => action(btn));
    }
    if (deck.started) mountControl(btn);
    else pendingControls.push(btn);
    return btn;
  }

  function mountControl(btn) {
    const nav = $(".deck-nav");
    if (!nav) return;
    nav.insertBefore(btn, nav.querySelector('[data-action="fullscreen"]'));
  }

  function slotFor(section) {
    if (!slots.has(section)) slots.set(section, autoSlot++ % 5 + 1);
    return slots.get(section);
  }

  function accentOf(slide) { return slide.style.getPropertyValue("--accent") || "var(--a1)"; }

  function rise(slide) {
    let i = 0;
    slide.querySelectorAll("*").forEach(el => {
      if (getComputedStyle(el).getPropertyValue("--rise").trim() !== "1") return;
      if (el.closest("[data-step]") || el.parentElement.closest("[data-r]")) return;
      el.dataset.r = "";
      el.style.setProperty("--i", Math.min(i++, 9));
    });
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
    const before = deck.active;
    deck.index = Math.max(0, Math.min(deck.visible.length - 1, n));
    const active = current();
    deck.active = active;
    if (before !== active) setSteps(active, stepMode);
    else if (stepMode === "end") {
      const was = Number(active.dataset.shown) || 0;
      setSteps(active, "end");
      stepGroups(active).slice(was).forEach(g => emit("step", g, active));
    }
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
    if (before !== active) {
      if (before) emit("leave", before);
      emit("enter", active);
    }
    if (updateHash && active.id) history.replaceState(null, "", "#" + active.id);
  }

  function next() {
    const slide = current();
    const groups = stepGroups(slide);
    const shown = Number(slide.dataset.shown) || 0;
    if (shown < groups.length) {
      groups[shown].forEach(el => setStepVisible(el, true));
      slide.dataset.shown = shown + 1;
      emit("step", groups[shown], slide);
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
      emit("unstep", groups[shown - 1], slide);
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
    if (!dialog.dataset.wired) {
      dialog.dataset.wired = "";
      dialog.addEventListener("close", () => {
        const target = dialog.returnFocusTo;
        dialog.returnFocusTo = null;
        const usable = target instanceof Element && target !== document.body && target.isConnected && !target.closest(".is-excluded, [inert], dialog");
        if (usable) target.focus();
        else focusDeck();
      });
      dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
    }
    dialog.returnFocusTo = invoker instanceof Element ? invoker : document.activeElement;
    dialog.showModal();
  }

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

  function isOwnedByControl(target) {
    return target instanceof Element &&
      target.closest('input, textarea, select, video, audio, iframe, [contenteditable]:not([contenteditable="false"])');
  }

  function slideFromHash() {
    let h;
    try { h = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
    if (!h) return null;
    const byId = document.getElementById(h);
    if (byId && byId.matches("section.slide")) return byId;
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? deck.all[n - 1] || null : null;
  }

  function wire() {
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-action]");
      if (btn && ACTIONS[btn.dataset.action]) {
        e.preventDefault();
        ACTIONS[btn.dataset.action](btn);
      }
      const closer = e.target.closest("dialog [data-close]");
      if (closer) closer.closest("dialog").close();
    });

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
      else if (controlKeys.has(k.toLowerCase())) { e.preventDefault(); controlKeys.get(k.toLowerCase())(); }
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

    window.addEventListener("hashchange", () => {
      const target = slideFromHash();
      if (target && target !== current()) goTo(target, { updateHash: false });
    });
  }

  function start() {
    if (deck.started) return;
    deck.started = true;
    if (!$(".deck-nav")) document.body.insertAdjacentHTML("beforeend", CONTROLS);
    pendingControls.splice(0).forEach(mountControl);
    decorate();
    deck.all.forEach(slide => emit("init", slide));
    deck.all.forEach(rise);
    wire();
    toggleNotes(false);
    refreshVisible(null, { updateHash: false });
    const entry = slideFromHash();
    if (entry) goTo(entry, { updateHash: false });
  }

  function use(plugin) {
    plugins.push(plugin);
    if (!deck.started) return;
    deck.all.forEach(slide => {
      try { plugin.init?.(slide, api); } catch (e) { console.error(e); }
    });
    deck.all.forEach(rise);
    try { plugin.enter?.(current(), api); } catch (e) { console.error(e); }
  }

  window.Deck = { use, start, goTo, next, prev, show, stepGroups, current, control, config: CONFIG };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else queueMicrotask(start);
})();

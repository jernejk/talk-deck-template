(() => {
  const CONFIG = JSON.parse(document.getElementById("deck-config")?.textContent || "{}");
  const DECK_TITLE = CONFIG.title || document.title;
  const plugins = [];
  const deck = { all: [], visible: [], index: 0, active: null, showExtras: false, started: false };
  const slots = new Map(Object.entries(CONFIG.sections || {}));
  let autoSlot = 0;
  const RESERVED_KEYS = "hfnogcr";
  const query = new URLSearchParams(location.search);
  const framed = query.get("framed") === "1";
  const parseSize = r => {
    const px = /^(\d{3,4})x(\d{3,4})$/.exec(r || ""), ratio = /^(\d{1,2}):(\d{1,2})$/.exec(r || "");
    if (px) return [+px[1], +px[2]];
    if (ratio) return [1920, Math.round(1920 * ratio[2] / ratio[1])];
    return null;
  };
  const sizeKey = size => size ? `${size[0]}x${size[1]}` : "auto";
  // Phones that scan a QR get the native layout; the projector preview is for desks.
  const touchOnly = matchMedia("(any-pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
  const defaultSize = sizeKey(touchOnly ? null : parseSize(CONFIG.resolution));
  const previewSize = parseSize(query.has("res") ? query.get("res") : defaultSize);
  const SIZES = [...new Set(["auto", "1920x1080", "1280x720", "1024x768", sizeKey(parseSize(CONFIG.resolution))])];
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
  <button type="button" data-action="options" aria-controls="deck-options" aria-expanded="false">Options</button>
  <button type="button" data-action="fullscreen">Full<kbd>F</kbd></button>
</nav>
<div id="deck-options" class="deck-options" role="group" aria-label="Deck options" hidden>
  <div class="opt-head">Size<kbd>R</kbd></div>
  <div class="opt-sizes" role="group" aria-label="Size"></div>
  <div class="opt-list">
    <button type="button" data-action="extras" aria-pressed="false">Extras<kbd>H</kbd></button>
    <button type="button" data-action="close">To close<kbd>C</kbd></button>
  </div>
</div>
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

  function control({ label, key, action, pressed, bar = false }) {
    const btn = document.createElement("button");
    btn.type = "button";
    if (bar) btn.dataset.place = "bar";
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
    if (btn.dataset.place === "bar") nav.insertBefore(btn, nav.querySelector('[data-action="options"]'));
    else $("#deck-options .opt-list").append(btn);
  }

  function toggleOptions(force) {
    const panel = $("#deck-options");
    const open = force ?? panel.hidden;
    panel.hidden = !open;
    $('[data-action="options"]').setAttribute("aria-expanded", String(open));
    $(".deck-nav").classList.toggle("is-open", open);
  }

  function sizeButtons() {
    const box = $("#deck-options .opt-sizes");
    SIZES.forEach(size => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = size === "auto" ? "Auto" : size.replace("x", "×");
      btn.setAttribute("aria-pressed", String(size === sizeKey(previewSize)));
      if (size === defaultSize) btn.title = "This deck's default";
      btn.addEventListener("click", () => setSize(size));
      box.append(btn);
    });
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
      if (!slide.querySelector(":scope > .slide-glow")) slide.insertAdjacentHTML("afterbegin", `<div class="slide-glow" aria-hidden="true"></div>`);
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
    wake();
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
    if (updateHash && active.id) {
      history.replaceState(null, "", "#" + active.id);
      // The preview host is the page a reload restores, so it carries the slide too.
      if (framed) try { if (window.parent.Deck) window.parent.history.replaceState(null, "", "#" + active.id); } catch {}
    }
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
      dialog.dataset.wired = "1";
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
    options: () => toggleOptions(),
    fullscreen: toggleFullscreen
  };

  function isOwnedByControl(target, touch = false) {
    const media = touch ? "video[controls], audio[controls], .player" : "video, audio";
    return target instanceof Element &&
      target.closest(`input, textarea, select, iframe, [role="slider"], [role="spinbutton"], [role="textbox"], [data-deck-interactive], [contenteditable]:not([contenteditable="false"]), ${media}`);
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
      const panel = $("#deck-options");
      if (!panel.hidden && (e.target.closest(".opt-list button") || !e.target.closest('#deck-options, [data-action="options"]'))) toggleOptions(false);
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
      else if (k === "Escape" && !$("#deck-options").hidden) { toggleOptions(false); }
      else if (k === "Escape" && $("#notes-panel").classList.contains("is-open")) { toggleNotes(false); }
      else if (k === "r" || k === "R") { e.preventDefault(); cycleSize(); }
      else if (controlKeys.has(k.toLowerCase())) { e.preventDefault(); controlKeys.get(k.toLowerCase())(); }
    });

    let touch = null;
    // A drag while pinch-zoomed is the reader looking around, not a swipe. In the preview the host page is the one zoomed.
    const hostZoomed = () => { if (!framed) return; try { return window.parent.Deck?.previewZoomed?.(); } catch {} };
    const zoomed = () => hostZoomed() ?? (window.visualViewport?.scale ?? 1) > 1.01;
    document.addEventListener("touchstart", e => {
      const t = e.target;
      if (e.defaultPrevented || e.touches.length !== 1 || zoomed() || isOwnedByControl(t, true) || (t instanceof Element && t.closest("button, a, input, details, dialog, .notes-panel"))) { touch = null; return; }
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    document.addEventListener("touchend", e => {
      if (!touch || e.defaultPrevented || e.touches.length || !e.changedTouches.length || zoomed()) { touch = null; return; }
      const dx = e.changedTouches[0].clientX - touch.x;
      const dy = e.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
    }, { passive: true });
    document.addEventListener("touchcancel", () => { touch = null; }, { passive: true });

    ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"].forEach(type => document.addEventListener(type, wake, { passive: true, capture: true }));
    if (IDLE_MS) setInterval(() => { if (!resting && Date.now() - lastInput > IDLE_MS) rest(); }, 5000);

    window.addEventListener("hashchange", () => {
      const target = slideFromHash();
      if (target && target !== current()) goTo(target, { updateHash: false });
    });
  }

  // Idle rest: with no input for a while, the active slide's looping motion pauses, so a deck left open drains nothing.
  const IDLE_MS = Math.max(0, Number(CONFIG.idle ?? 90)) * 1000;
  const restPaused = new Set();
  let lastInput = Date.now(), resting = false;
  function rest() {
    resting = true;
    document.documentElement.classList.add("is-resting");
    current()?.querySelectorAll("svg").forEach(svg => { if (svg.animationsPaused && !svg.animationsPaused()) { svg.pauseAnimations(); restPaused.add(svg); } });
  }
  function wake() {
    lastInput = Date.now();
    if (!resting) return;
    resting = false;
    document.documentElement.classList.remove("is-resting");
    restPaused.forEach(svg => svg.unpauseAnimations());
    restPaused.clear();
  }

  function touchHint() {
    if (!touchOnly || framed) return;
    try { if (localStorage.getItem("deck-hint-seen")) return; localStorage.setItem("deck-hint-seen", "1"); } catch { /* private mode still gets the hint once per load */ }
    const hint = document.createElement("div");
    hint.className = "deck-hint";
    hint.setAttribute("role", "status");
    hint.textContent = "Swipe for the next slide · Slides lists them all";
    document.body.append(hint);
    const gone = () => { hint.classList.add("is-gone"); setTimeout(() => hint.remove(), 400); };
    setTimeout(gone, 6000);
    document.addEventListener("touchstart", gone, { once: true, passive: true });
  }

  let hosting = false;
  const previewZoomed = () => hosting && (window.visualViewport?.width ?? Infinity) < document.documentElement.clientWidth * 0.99;

  // Reloads the deck in a frame of exactly w×h so vw and vh resolve as they would on the projector.
  function hostPreview([w, h]) {
    hosting = true;
    const url = new URL(location.href);
    url.searchParams.set("framed", "1");
    document.head.insertAdjacentHTML("beforeend", `<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}
      .res-frame{position:fixed;left:50%;top:50%;border:0;transform-origin:center;background:#000}</style>`);
    const frame = document.createElement("iframe");
    frame.className = "res-frame";
    frame.title = document.title;
    frame.width = w;
    frame.height = h;
    frame.allow = "fullscreen; autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.src = url.href;
    document.body.replaceChildren(frame);
    const root = document.documentElement;
    // A transform-scaled frame goes black or crashes the tab when pinch-zoomed on iOS, so touch browsers scale natively; an explicit minimum-scale passes Safari's 0.25× floor.
    const meta = matchMedia("(pointer: coarse)").matches && document.querySelector('meta[name="viewport"]');
    const setMeta = content => { if (meta.content !== content) meta.content = content; };
    const fit = () => {
      if (meta) {
        const vv = visualViewport;
        const width = Math.max(w, Math.ceil(h * vv.width / vv.height)), fitScale = Math.floor(vv.width * vv.scale / width * 1000) / 1000;
        setMeta(`width=${width},minimum-scale=${fitScale},initial-scale=${fitScale}`);
        frame.style.transform = "translate(-50%,-50%)";
        return;
      }
      frame.style.transform = `translate(-50%,-50%) scale(${Math.min(root.clientWidth / w, root.clientHeight / h)})`;
    };
    fit();
    addEventListener("resize", fit);
    addEventListener("hashchange", () => { try { frame.contentWindow.location.hash = location.hash; } catch {} });
    frame.addEventListener("load", () => frame.contentWindow?.focus());
    document.addEventListener("pointerdown", () => frame.contentWindow?.focus());
    addEventListener("keydown", e => { if (e.key.toLowerCase() === "r") cycleSize(); else frame.contentWindow?.focus(); });
  }

  function setSize(next) {
    const url = new URL(location.href);
    url.searchParams.delete("framed");
    if (next === defaultSize) url.searchParams.delete("res");
    else url.searchParams.set("res", next);
    try { (framed ? window.top : window).location.href = url.href; } catch { location.href = url.href; }
  }

  function cycleSize() { setSize(SIZES[(SIZES.indexOf(sizeKey(previewSize)) + 1) % SIZES.length]); }

  function start() {
    if (deck.started) return;
    deck.started = true;
    if (previewSize && !framed && window.top === window) { hostPreview(previewSize); return; }
    if (!$(".deck-nav")) document.body.insertAdjacentHTML("beforeend", CONTROLS);
    pendingControls.splice(0).forEach(mountControl);
    sizeButtons();
    decorate();
    deck.all.forEach(slide => emit("init", slide));
    deck.all.forEach(rise);
    wire();
    toggleNotes(false);
    refreshVisible(null, { updateHash: false });
    const entry = slideFromHash();
    if (entry) goTo(entry, { updateHash: false });
    touchHint();
  }

  function use(plugin) {
    plugins.push(plugin);
    if (!deck.started || hosting) return;
    deck.all.forEach(slide => {
      try { plugin.init?.(slide, api); } catch (e) { console.error(e); }
    });
    deck.all.forEach(rise);
    try { plugin.enter?.(current(), api); } catch (e) { console.error(e); }
  }

  window.Deck = { use, start, goTo, next, prev, show, stepGroups, current, control, previewZoomed, config: CONFIG };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else queueMicrotask(start);
})();

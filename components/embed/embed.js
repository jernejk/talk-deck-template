let liveControl = null;

const revealed = fig => !fig.closest("[data-step]:not(.is-shown)");
function fallbackIn(slide) {
  const ready = [...(slide?.querySelectorAll(".embed") || [])].filter(fig => fig.embedFallback && revealed(fig));
  return ready.find(fig => fig.classList.contains("is-live")) ?? ready[0];
}

function refreshLiveControl(slide) {
  if (!liveControl) return;
  const fig = fallbackIn(slide);
  liveControl.hidden = !fig;
  liveControl.setAttribute("aria-pressed", String(Boolean(fig?.classList.contains("is-live"))));
}

function load(frame) {
  clearTimeout(frame.unloadTimer);
  if (frame.dataset.state === "unload") { frame.dataset.state = "loading"; return; }
  frame.dataset.state = "loading";
  frame.src = frame.dataset.src;
}

// Blanking a frame mid-load aborts the request, so give it two seconds to finish first.
function unload(frame) {
  if (frame.dataset.state === "unload") return;
  if (frame.dataset.state === "loading") {
    frame.dataset.state = "unload";
    frame.unloadTimer = setTimeout(() => { if (frame.dataset.state === "unload") { frame.dataset.state = ""; frame.src = "about:blank"; } }, 2000);
    return;
  }
  if (frame.dataset.state === "on") frame.src = "about:blank";
  frame.dataset.state = "";
}

function area(fig) {
  const slide = fig.closest(".slide");
  const s = slide.getBoundingClientRect();
  const foot = slide.querySelector(".slide-foot");
  const footTop = foot && getComputedStyle(foot).position !== "static" && getComputedStyle(foot).display !== "none" ? foot.getBoundingClientRect().top : s.bottom;
  const root = document.documentElement, vw = root.clientWidth / 100, vh = root.clientHeight / 100;
  return { left: s.left + 4 * vw, right: s.right - 4 * vw, top: Math.max(s.top + 8 * vh, (document.querySelector(".deck-nav")?.getBoundingClientRect().bottom || 0) + 8), bottom: Math.min(footTop, s.bottom) - 2.4 * vh };
}

// data-logical renders the page that many CSS pixels wide and scales it in; two spare pixels hide the hairline a fractional scale leaves.
const fitter = typeof ResizeObserver === "function" ? new ResizeObserver(entries => entries.forEach(e => fitLogical(e.target.closest(".embed")))) : null;
function fitLogical(fig) {
  const lw = Number(fig?.dataset.logical), view = fig?.querySelector(".embed-view"), frame = fig?.querySelector(".embed-frame");
  if (!lw || !view || !frame) return;
  const { width, height } = view.getBoundingClientRect();
  if (!width) return;
  const z = width / lw;
  Object.assign(frame.style, { width: `${lw + 2}px`, height: `${Math.ceil(height / z) + 2}px`, transform: `scale(${z})`, transformOrigin: "0 0" });
}

function place(fig, r) {
  const op = fig.offsetParent || fig.closest(".slide");
  const o = op.getBoundingClientRect();
  fig.style.left = `${r.left - o.left - op.clientLeft + op.scrollLeft}px`;
  fig.style.top = `${r.top - o.top - op.clientTop + op.scrollTop}px`;
  fig.style.width = `${r.right - r.left}px`;
  fig.style.height = `${r.bottom - r.top}px`;
}

function stop(fig) { fig.embedStop?.(); }

function move(fig, to, deck, done) {
  stop(fig);
  if (deck.reducedMotion()) { place(fig, to); return done?.(); }
  const onEnd = e => { if (e.target === fig && e.propertyName === "height") { stop(fig); done?.(); } };
  const timer = setTimeout(() => { stop(fig); done?.(); }, 500);
  fig.embedStop = () => {
    clearTimeout(timer);
    fig.removeEventListener("transitionend", onEnd);
    fig.classList.remove("is-moving");
    fig.embedStop = null;
  };
  fig.classList.add("is-moving");
  fig.addEventListener("transitionend", onEnd);
  place(fig, to);
}

const scrollLocks = new WeakMap();
function lockSlide(fig) {
  const slide = fig.closest(".slide");
  let state = scrollLocks.get(slide);
  if (!state) {
    state = { owners: new Set(), top: slide.scrollTop, left: slide.scrollLeft, overflow: [...slide.style].filter(key => /^(overflow|overflow-x|overflow-y)$/.test(key)).map(key => [key, slide.style.getPropertyValue(key), slide.style.getPropertyPriority(key)]) };
    scrollLocks.set(slide, state);
    slide.style.setProperty("overflow", "hidden", "important");
  }
  state.owners.add(fig);
  fig.embedUnlock = () => {
    state.owners.delete(fig);
    if (!state.owners.size) {
      slide.style.removeProperty("overflow");
      for (const [key, value, priority] of state.overflow) slide.style.setProperty(key, value, priority);
      slide.scrollTop = state.top; slide.scrollLeft = state.left;
      scrollLocks.delete(slide);
    }
    fig.embedUnlock = null;
  };
}

function expand(fig, deck) {
  if (fig.embedOpen) return;
  fig.embedOpen = true;
  try {
  if (!fig.embedUnlock) lockSlide(fig);
  if (!fig.classList.contains("is-expanded")) {
    const r = fig.getBoundingClientRect();
    const spot = document.createElement("div");
    spot.className = "embed-spot";
    spot.style.width = `${r.width}px`;
    spot.style.height = `${r.height}px`;
    fig.before(spot);
    fig.embedSpot = spot;
    fig.embedStyles = ["left", "top", "width", "height"].map(key => [key, fig.style.getPropertyValue(key), fig.style.getPropertyPriority(key)]);
    fig.classList.add("is-expanded");
    place(fig, r);
    fig.offsetWidth;
  }
  move(fig, area(fig), deck);
  } catch (error) { collapse(fig, deck, false); throw error; }
}

function collapse(fig, deck, animate) {
  if (!fig.embedOpen) return;
  fig.embedOpen = false;
  const finish = () => {
    if (fig.embedOpen) return;
    fig.classList.remove("is-expanded", "is-moving");
    for (const [key, value, priority] of fig.embedStyles || []) {
      if (value) fig.style.setProperty(key, value, priority); else fig.style.removeProperty(key);
    }
    fig.embedStyles = null;
    fig.embedSpot?.remove();
    fig.embedSpot = null;
    fig.embedUnlock?.();
  };
  if (!animate) { stop(fig); return finish(); }
  move(fig, fig.embedSpot.getBoundingClientRect(), deck, finish);
}

function startCap(fig, deck) {
  const cap = Number(fig.dataset.cap);
  const el = fig.querySelector(".embed-cap");
  if (!cap || !el) return;
  const t0 = performance.now();
  el.hidden = false;
  const tick = () => {
    const left = Math.max(0, cap - (performance.now() - t0) / 1000);
    el.style.setProperty("--left", ((deck.reducedMotion() ? Math.ceil(left) : left) / cap).toFixed(3));
    el.textContent = `${Math.ceil(left)} s`;
    if (left > 0) return;
    el.textContent = `${cap} s up: back to the screenshot`;
    fig.classList.add("is-over");
    clearInterval(fig.embedCap);
  };
  tick();
  fig.embedCap = setInterval(tick, 200);
}

function stopCap(fig) {
  clearInterval(fig.embedCap);
  fig.classList.remove("is-over");
  const el = fig.querySelector(".embed-cap");
  if (el) el.hidden = true;
}

function sync(fig) {
  const live = fig.classList.contains("is-live");
  const toggle = fig.querySelector(".embed-toggle");
  const reload = fig.querySelector(".embed-reload");
  if (fig.embedFallback) {
    toggle.firstChild.textContent = live ? "Back" : "Go live";
    toggle.classList.toggle("embed-go", !live);
    toggle.setAttribute("aria-pressed", String(live));
    reload.hidden = !live;
    const slide = fig.closest(".slide");
    if (slide.classList.contains("is-active")) refreshLiveControl(slide);
  } else {
    toggle.firstChild.textContent = fig.embedOpen ? "Shrink" : "Expand";
    toggle.setAttribute("aria-pressed", String(Boolean(fig.embedOpen)));
  }
}

function goLive(fig, deck) {
  if (!revealed(fig) || fig.classList.contains("is-live")) return;
  fig.classList.add("is-live");
  load(fig.querySelector(".embed-frame"));
  expand(fig, deck);
  startCap(fig, deck);
  sync(fig);
}

function goBack(fig, deck, { animate = true, refocus = true } = {}) {
  if (!fig.classList.contains("is-live")) return;
  fig.classList.remove("is-live");
  stopCap(fig);
  unload(fig.querySelector(".embed-frame"));
  collapse(fig, deck, animate);
  sync(fig);
  if (refocus) fig.closest(".slide").focus({ preventScroll: true });
}

const toggleLive = (fig, deck) => fig.classList.contains("is-live") ? goBack(fig, deck) : goLive(fig, deck);

function button(bar, cls, label, key) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `embed-btn ${cls}`;
  b.append(label);
  if (key) b.insertAdjacentHTML("beforeend", `<kbd>${key}</kbd>`);
  bar.append(b);
  return b;
}

function setup(fig, slide, deck) {
  const bar = fig.querySelector(".embed-bar");
  const frame = fig.querySelector(".embed-frame");
  if (!bar || !frame || bar.querySelector(".embed-btn")) return;
  if (fig.dataset.logical) { fitter?.observe(fig.querySelector(".embed-view")); fitLogical(fig); }
  fig.embedFallback = Boolean(fig.querySelector(".embed-shot"));
  frame.addEventListener("load", () => {
    if (frame.dataset.state === "loading") frame.dataset.state = "on";
    else if (frame.dataset.state === "unload") { clearTimeout(frame.unloadTimer); frame.dataset.state = ""; frame.src = "about:blank"; }
  });
  const click = (b, fn) => b.addEventListener("click", e => {
    fn();
    if (e.detail > 0) slide.focus({ preventScroll: true });
  });
  if (fig.embedFallback && fig.dataset.cap) {
    const cap = document.createElement("span");
    cap.className = "embed-cap";
    cap.setAttribute("role", "timer");
    cap.hidden = true;
    bar.append(cap);
  }
  click(button(bar, "embed-reload", "Reload"), () => { if (frame.dataset.state) { frame.dataset.state = "loading"; frame.src = frame.dataset.src; } });
  if (fig.embedFallback) click(button(bar, "embed-toggle", "Go live", "L"), () => toggleLive(fig, deck));
  else click(button(bar, "embed-toggle", "Expand"), () => { fig.embedOpen ? collapse(fig, deck, true) : expand(fig, deck); sync(fig); });
  sync(fig);
}

const embedsIn = root => root.matches(".embed") ? [root] : [...root.querySelectorAll(".embed")];

function show(root) {
  embedsIn(root).forEach(fig => {
    if (fig.embedFallback || !revealed(fig)) return;
    load(fig.querySelector(".embed-frame"));
  });
}

function hide(root, deck) {
  embedsIn(root).forEach(fig => {
    if (fig.embedFallback) return goBack(fig, deck, { animate: false, refocus: false });
    unload(fig.querySelector(".embed-frame"));
    collapse(fig, deck, false);
    sync(fig);
  });
}

let resizing = false;

Deck.use({
  name: "embed",
  init(slide, deck) {
    slide.querySelectorAll(".embed").forEach(fig => setup(fig, slide, deck));
    if (!resizing && slide.querySelector(".embed")) {
      resizing = true;
      addEventListener("resize", () => deck.current()?.querySelectorAll(".embed.is-expanded").forEach(fig => { if (fig.embedOpen) place(fig, area(fig)); }));
    }
    if (liveControl || !slide.querySelector(".embed .embed-shot")) return;
    liveControl = deck.control({
      label: "Live", key: "l", pressed: false, bar: true,
      action() {
        const fig = fallbackIn(deck.current());
        if (!fig) return;
        toggleLive(fig, deck);
        deck.current().focus({ preventScroll: true });
      }
    });
    liveControl.hidden = true;
  },
  enter(slide) {
    refreshLiveControl(slide);
    show(slide);
  },
  leave(slide, deck) {
    hide(slide, deck);
    if (liveControl) liveControl.hidden = true;
  },
  step(els, slide) {
    els.forEach(show);
    refreshLiveControl(slide);
  },
  unstep(els, slide, deck) {
    els.forEach(el => hide(el, deck));
    refreshLiveControl(slide);
  }
});

let liveControl = null;

const fallbackIn = slide => [...(slide?.querySelectorAll(".embed") || [])].find(fig => fig.querySelector(".embed-shot"));

function load(frame) {
  clearTimeout(frame.unloadTimer);
  if (frame.dataset.state === "unload") { frame.dataset.state = "loading"; return; }
  frame.dataset.state = "loading";
  frame.src = frame.dataset.src;
}

// Blanking a frame mid-load aborts the request, so give it two seconds to finish first.
function unload(frame) {
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
  const footTop = foot && getComputedStyle(foot).display !== "none" ? foot.getBoundingClientRect().top : s.bottom;
  const vw = innerWidth / 100, vh = innerHeight / 100;
  return { left: s.left + 4 * vw, right: s.right - 4 * vw, top: s.top + 8 * vh, bottom: Math.min(footTop, s.bottom) - 2.4 * vh };
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

function expand(fig, deck) {
  if (fig.embedOpen) return;
  fig.embedOpen = true;
  if (!fig.classList.contains("is-expanded")) {
    const r = fig.getBoundingClientRect();
    const spot = document.createElement("div");
    spot.className = "embed-spot";
    spot.style.width = `${r.width}px`;
    spot.style.height = `${r.height}px`;
    fig.before(spot);
    fig.embedSpot = spot;
    fig.classList.add("is-expanded");
    place(fig, r);
    fig.offsetWidth;
  }
  move(fig, area(fig), deck);
}

function collapse(fig, deck, animate) {
  if (!fig.embedOpen) return;
  fig.embedOpen = false;
  const finish = () => {
    if (fig.embedOpen) return;
    fig.classList.remove("is-expanded", "is-moving");
    fig.style.left = fig.style.top = fig.style.width = fig.style.height = "";
    fig.embedSpot?.remove();
    fig.embedSpot = null;
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
    if (liveControl && fig === fallbackIn(fig.closest(".slide"))) liveControl.setAttribute("aria-pressed", String(live));
  } else {
    toggle.firstChild.textContent = fig.embedOpen ? "Shrink" : "Expand";
    toggle.setAttribute("aria-pressed", String(Boolean(fig.embedOpen)));
  }
}

function goLive(fig, deck) {
  if (fig.classList.contains("is-live")) return;
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
    if (fig.embedFallback || fig.closest("[data-step]:not(.is-shown)")) return;
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
    if (liveControl || !fallbackIn(slide)) return;
    liveControl = deck.control({
      label: "Live", key: "l", pressed: false,
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
    if (liveControl) {
      liveControl.hidden = !fallbackIn(slide);
      liveControl.setAttribute("aria-pressed", "false");
    }
    show(slide);
  },
  leave(slide, deck) {
    hide(slide, deck);
    if (liveControl) liveControl.hidden = true;
  },
  step(els) { els.forEach(show); },
  unstep(els, slide, deck) { els.forEach(el => hide(el, deck)); }
});

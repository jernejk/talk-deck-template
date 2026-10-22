const parse = v => {
  if (v == null || String(v).trim() === "") return null;
  const parts = String(v).trim().split(":");
  const n = parts.reduce((t, p) => t * 60 + parseFloat(p), 0);
  return Number.isFinite(n) ? n : null;
};
const fmt = (s, round = Math.floor) => {
  s = Math.max(0, round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const el = (tag, cls, attrs = {}) => Object.assign(document.createElement(tag), { className: cls }, attrs);
const button = (cls, label) => el("button", cls, { type: "button", ariaLabel: label });
const swallow = e => { if (e.name !== "AbortError" && e.name !== "NotAllowedError") console.error(`Video didn't start: ${e.message}`); };
const players = new WeakMap();
const within = root => root.matches(".player") ? [root] : [...root.querySelectorAll(".player")];

function buildVideo(fig, slide) {
  const v = fig.querySelector("video");
  const stage = el("div", "player-stage");
  v.before(stage);
  stage.append(v);
  v.controls = false;

  const start = parse(fig.dataset.start) ?? 0;
  const endAttr = parse(fig.dataset.end);
  const endAt = () => Math.min(endAttr ?? Infinity, Number.isFinite(v.duration) ? v.duration : Infinity);
  const span = () => Number.isFinite(endAt()) ? Math.max(0, endAt() - start) : 0;

  const big = button("player-big", "Play");
  const toggle = button("player-toggle", "Play");
  const seek = el("input", "player-seek", { type: "range", min: "0", max: "0", step: "0.01", value: "0", ariaLabel: "Seek" });
  const time = el("span", "player-time", { textContent: "0:00 / 0:00" });
  const mute = button("player-mute", "Mute");
  stage.append(big, el("div", "player-bar"));
  stage.lastChild.append(toggle, seek, time, mute);

  let started = false;
  let scrubbing = false;
  let raf = 0;

  function paint() {
    const total = span();
    const done = Math.min(Math.max(v.currentTime - start, 0), total);
    const ended = v.paused && started && v.currentTime >= endAt() - 0.05;
    fig.classList.toggle("is-fresh", !started);
    fig.classList.toggle("is-playing", !v.paused);
    fig.classList.toggle("is-ended", ended);
    fig.classList.toggle("is-muted", v.muted);
    toggle.ariaLabel = v.paused ? "Play" : "Pause";
    mute.ariaPressed = String(v.muted);
    time.textContent = `${fmt(done)} / ${fmt(total, Math.round)}`;
    if (scrubbing) return;
    seek.max = String(total);
    seek.value = String(done);
    seek.style.setProperty("--p", total ? `${done / total * 100}%` : "0%");
    seek.ariaValueText = time.textContent;
  }

  function finish() {
    v.pause();
    v.currentTime = endAt();
    paint();
  }

  function tick() {
    raf = 0;
    if (!v.paused && v.currentTime >= endAt() - 0.02) finish();
    paint();
    if (!v.paused) raf = requestAnimationFrame(tick);
  }

  function play() {
    if (v.currentTime >= endAt() - 0.05 || v.currentTime < start - 0.05) v.currentTime = start;
    v.play().catch(swallow);
  }

  const api = {
    play,
    pause: () => v.pause(),
    reset() {
      v.pause();
      started = false;
      v.currentTime = start;
      paint();
    }
  };
  players.set(fig, api);

  v.addEventListener("play", () => { started = true; if (!raf) raf = requestAnimationFrame(tick); paint(); });
  ["pause", "ended", "seeked", "volumechange", "durationchange"].forEach(t => v.addEventListener(t, paint));
  v.addEventListener("loadedmetadata", () => { if (!started) v.currentTime = start; paint(); });
  v.addEventListener("ended", finish);
  v.addEventListener("click", () => v.paused ? play() : v.pause());
  big.addEventListener("click", play);
  toggle.addEventListener("click", () => v.paused ? play() : v.pause());
  mute.addEventListener("click", () => { v.muted = !v.muted; });
  seek.addEventListener("input", () => { v.currentTime = start + Number(seek.value); paint(); });
  seek.addEventListener("pointerdown", () => {
    scrubbing = true;
    addEventListener("pointerup", () => { scrubbing = false; paint(); slide.focus({ preventScroll: true }); }, { once: true });
  });
  paint();
}

function buildYouTube(fig, slide) {
  const id = fig.dataset.youtube;
  const start = Math.floor(parse(fig.dataset.start) ?? 0);
  const stage = fig.querySelector(".player-stage");
  const note = fig.querySelector(".player-note");
  const link = fig.querySelector(".player-link");
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&t=${start}s`;
  const web = () => /^https?:$/.test(location.protocol);
  const embeddable = () => web() && navigator.onLine;
  if (link) link.href = watch;

  function sync() {
    if (!note) return;
    note.textContent = !web() ? "Opens in a new tab: YouTube won’t embed a file opened from disk."
      : !navigator.onLine ? "Offline: this will open YouTube in a new tab." : "";
    note.hidden = !note.textContent;
  }

  function restore() {
    stage.querySelector("iframe")?.remove();
    fig.classList.remove("is-embedded");
  }

  function play() {
    if (!embeddable()) { window.open(watch, "_blank", "noopener"); return; }
    if (stage.querySelector("iframe")) return;
    const frame = el("iframe", "", {
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&start=${start}&rel=0`,
      title: fig.querySelector(".player-meta b")?.textContent || "YouTube video player",
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      allowFullscreen: true,
      referrerPolicy: "strict-origin-when-cross-origin"
    });
    stage.append(frame);
    fig.classList.add("is-embedded");
  }

  fig.querySelector(".player-big")?.addEventListener("click", play);
  addEventListener("online", sync);
  addEventListener("offline", sync);
  sync();
  players.set(fig, { play, pause: restore, reset: restore });
}

Deck.use({
  name: "player",
  init(slide) {
    slide.querySelectorAll(".player").forEach(fig => {
      if (fig.dataset.youtube) buildYouTube(fig, slide);
      else if (fig.querySelector("video")) buildVideo(fig, slide);
      fig.addEventListener("click", e => {
        if (e.detail > 0 && e.target.closest("button, a, video")) slide.focus({ preventScroll: true });
      });
    });
  },
  enter(slide, deck) {
    slide.querySelectorAll(".player").forEach(fig => {
      const p = players.get(fig);
      p?.reset();
      if (p && fig.hasAttribute("data-autoplay") && !fig.dataset.youtube && !deck.reducedMotion() && !fig.closest("[data-step]:not(.is-shown)")) p.play();
    });
  },
  step(els, slide, deck) {
    els.flatMap(within).forEach(fig => {
      if (fig.hasAttribute("data-autoplay") && !fig.dataset.youtube && !deck.reducedMotion()) players.get(fig)?.play();
    });
  },
  unstep(els) {
    els.flatMap(within).forEach(fig => players.get(fig)?.pause());
  },
  leave(slide) {
    slide.querySelectorAll(".player").forEach(fig => players.get(fig)?.reset());
  }
});

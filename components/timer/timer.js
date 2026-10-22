const clock = text => {
  const m = String(text || "").trim().match(/^(\d+):(\d{2})$/);
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : 300000;
};
const format = ms => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function build(slide, el) {
  el.innerHTML = `
<div class="timer-ring"><div class="timer-face"><span class="timer-digits" role="timer"></span><span class="timer-label" aria-live="polite"></span></div></div>
<div class="timer-buttons"><button type="button" class="btn" data-timer="toggle">Start</button><button type="button" class="btn" data-timer="reset">Reset</button><button type="button" class="btn" data-timer="add">+1 min</button></div>`;
  const first = clock(el.dataset.time);
  const t = { el, slide, first, total: first, left: first, running: false, last: 0, id: 0 };
  const digits = el.querySelector(".timer-digits");
  const label = el.querySelector(".timer-label");
  const toggle = el.querySelector('[data-timer="toggle"]');

  const render = () => {
    const done = t.left <= 0;
    el.classList.toggle("is-running", t.running);
    el.classList.toggle("is-done", done);
    el.style.setProperty("--left", (t.left / t.total).toFixed(4));
    digits.textContent = format(t.left);
    label.textContent = done ? "Time’s up" : t.running ? "Running" : t.left < t.total ? "Paused" : "Ready";
    toggle.textContent = t.running ? "Pause" : "Start";
    toggle.disabled = done;
  };
  const tick = () => {
    clearTimeout(t.id);
    const now = performance.now();
    if (t.running) {
      t.left = Math.max(0, t.left - (now - t.last));
      t.last = now;
      if (t.left <= 0) t.running = false;
    }
    render();
    if (t.running) t.id = setTimeout(tick, t.left % 1000 || 1000);
  };
  t.sync = tick;
  t.start = () => {
    if (t.running || t.left <= 0) return;
    t.running = true;
    t.last = performance.now();
    tick();
  };
  t.pause = () => {
    tick();
    t.running = false;
    clearTimeout(t.id);
    render();
  };
  t.reset = () => {
    t.running = false;
    t.total = t.left = t.first;
    clearTimeout(t.id);
    render();
  };
  t.add = () => {
    tick();
    if (t.left <= 0) t.total = 0;
    t.total += 60000;
    t.left += 60000;
    render();
    clearTimeout(t.id);
    if (t.running) t.id = setTimeout(tick, t.left % 1000 || 1000);
  };
  t.pristine = () => !t.running && t.left === t.total && t.total === t.first;

  el.addEventListener("click", e => {
    const btn = e.target.closest("[data-timer]");
    if (!btn) return;
    const action = btn.dataset.timer;
    if (action === "toggle") (t.running ? t.pause : t.start)();
    else t[action]();
    if (e.detail > 0) slide.focus({ preventScroll: true });
  });
  render();
  return t;
}

Deck.use({
  name: "timer",
  init(slide) {
    slide.timers = [...slide.querySelectorAll(".timer")].map(el => build(slide, el));
  },
  enter(slide) {
    (slide.timers || []).forEach(t => {
      if (t.el.hasAttribute("data-autostart") && t.pristine()) t.start();
      else t.sync();
    });
  }
});

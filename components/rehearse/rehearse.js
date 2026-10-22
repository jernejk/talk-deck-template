const rehearsal = { acc: 0, t0: 0, running: false, slideFrom: 0, hud: null, timer: 0, slide: null };

const parseClock = text => {
  const m = String(text || "").trim().match(/^(\d+):(\d{2})$/);
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
};
const formatClock = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const rehearsalElapsed = () => rehearsal.acc + (rehearsal.running ? performance.now() - rehearsal.t0 : 0);

function plannedWindow(slide) {
  const re = /(\d+:\d{2})\s*[–—-]\s*(\d+:\d{2})/;
  const b = [...(slide?.querySelectorAll("aside.notes b") || [])].find(el => re.test(el.textContent));
  const m = b?.textContent.match(re);
  return m ? { from: parseClock(m[1]), to: parseClock(m[2]), label: `${m[1]}–${m[2]}` } : null;
}

function buildHud() {
  const hud = document.createElement("aside");
  hud.className = "rehearse";
  hud.setAttribute("aria-label", "Rehearsal timer");
  hud.hidden = true;
  hud.innerHTML = `
<div class="rehearse-row"><span class="rehearse-total">0:00</span><span class="rehearse-of"></span><span class="rehearse-status"></span></div>
<div class="rehearse-bar" aria-hidden="true"><i></i></div>
<dl class="rehearse-facts">
  <div><dt>This slide</dt><dd class="rehearse-slide">0:00</dd></div>
  <div><dt>Planned</dt><dd class="rehearse-plan">—</dd></div>
  <div><dt>Slide</dt><dd class="rehearse-count"></dd></div>
</dl>
<p class="rehearse-next"></p>
<div class="rehearse-buttons"><button type="button" class="btn" data-rehearse="toggle">Start</button><button type="button" class="btn" data-rehearse="reset">Reset</button></div>`;
  hud.addEventListener("click", e => {
    const btn = e.target.closest("[data-rehearse]");
    if (!btn) return;
    if (btn.dataset.rehearse === "toggle") setRunning(!rehearsal.running);
    else resetRehearsal();
    Deck.current()?.focus({ preventScroll: true });
  });
  document.body.append(hud);
  return hud;
}

function setRunning(on) {
  if (on === rehearsal.running) return;
  if (on) rehearsal.t0 = performance.now();
  else rehearsal.acc = rehearsalElapsed();
  rehearsal.running = on;
  renderHud();
}

function resetRehearsal() {
  rehearsal.acc = 0;
  rehearsal.t0 = performance.now();
  rehearsal.slideFrom = 0;
  renderHud();
}

function renderHud() {
  const hud = rehearsal.hud;
  if (!hud || hud.hidden) return;
  const q = sel => hud.querySelector(sel);
  const total = rehearsalElapsed();
  const duration = parseClock(Deck.config.duration);
  const plan = plannedWindow(rehearsal.slide);
  const tolerance = 15000;
  let status = "";
  if (duration && total > duration) status = "over";
  else if (plan && total > plan.to + tolerance) status = "behind";
  else if (plan && total < plan.from - tolerance) status = "ahead";
  else if (plan) status = "on time";
  q(".rehearse-total").textContent = formatClock(total);
  q(".rehearse-of").textContent = duration ? `of ${formatClock(duration)}` : "";
  q(".rehearse-status").textContent = status;
  hud.dataset.status = status.replace(" ", "-");
  hud.dataset.running = String(rehearsal.running);
  const bar = q(".rehearse-bar");
  bar.hidden = !duration;
  if (duration) bar.style.setProperty("--p", Math.min(1, total / duration));
  q(".rehearse-slide").textContent = formatClock(total - rehearsal.slideFrom);
  q(".rehearse-plan").textContent = plan ? plan.label : "—";
  const slides = [...document.querySelectorAll("section.slide:not(.is-excluded)")];
  const at = slides.indexOf(rehearsal.slide);
  q(".rehearse-count").textContent = at >= 0 ? `${at + 1} / ${slides.length}` : "extra";
  const next = slides[at + 1];
  q(".rehearse-next").textContent = next ? `Next: ${next.dataset.title || ""}` : "Last slide";
  q('[data-rehearse="toggle"]').textContent = rehearsal.running ? "Pause" : total ? "Resume" : "Start";
}

const rehearseButton = Deck.control({
  label: "Rehearse",
  key: "t",
  pressed: false,
  action() {
    rehearsal.hud ||= buildHud();
    const open = rehearsal.hud.hidden;
    rehearsal.hud.hidden = !open;
    rehearseButton.setAttribute("aria-pressed", String(open));
    clearInterval(rehearsal.timer);
    if (open) {
      rehearsal.slide = Deck.current();
      if (!rehearsalElapsed()) setRunning(true);
      rehearsal.timer = setInterval(renderHud, 250);
      renderHud();
    }
  }
});

Deck.use({
  name: "rehearse",
  enter(slide) {
    rehearsal.slide = slide;
    rehearsal.slideFrom = rehearsalElapsed();
    renderHud();
  }
});

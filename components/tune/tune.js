// Colourway tuner: only with ?tune in the URL. Without it, this file adds nothing.
const TUNE_SURFACES = ["--bg", "--panel", "--panel-2"];
const TUNE_TOKENS = [...TUNE_SURFACES, "--ink", "--muted", "--a0", "--a1", "--a2", "--a3", "--a4", "--a5", "--a6", "--signal"];
const tune = { panel: null, start: {}, now: {} };

// ponytail: reads rgb() as the browser computes it; alpha is ignored, because colour inputs have none.
function tuneHex(token, probe) {
  probe.style.color = `var(${token})`;
  const [r, g, b] = (getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function tuneLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function tuneRatio(a, b) {
  const [hi, lo] = [tuneLuminance(a), tuneLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function tuneCss() {
  const changed = TUNE_TOKENS.filter(t => tune.now[t] !== tune.start[t]);
  if (!changed.length) return "";
  const base = document.getElementById("theme")?.getAttribute("href").match(/templates\/([\w-]+)\//)?.[1] || "community";
  return `@import url("../${base}/theme.css");\n:root{\n  ${changed.map(t => `${t}:${tune.now[t]};`).join("")}\n}\n`;
}

function tuneRender() {
  const p = tune.panel;
  TUNE_TOKENS.forEach(t => {
    const row = p.querySelector(`[data-token="${t}"]`);
    // Surfaces show ink on them; every other colour shows itself on --bg.
    const [fg, bg] = TUNE_SURFACES.includes(t) ? [tune.now["--ink"], tune.now[t]] : [tune.now[t], tune.now["--bg"]];
    const r = tuneRatio(fg, bg);
    const level = r >= 4.5 ? "ok" : r >= 3 ? "large" : "low";
    row.dataset.level = level;
    row.querySelector(".tune-ratio").textContent = `${r.toFixed(2)}:1`;
    row.querySelector(".tune-level").textContent = level === "ok" ? "AA" : level === "large" ? "titles only" : "too low";
  });
  const css = tuneCss();
  p.querySelector(".tune-css").value = css || "Change a colour to get the CSS.";
  p.querySelector('[data-tune="copy"]').disabled = !css;
}

function tuneBuild() {
  const p = document.createElement("aside");
  p.className = "tune";
  p.setAttribute("aria-label", "Colourway tuner");
  p.hidden = true;
  p.innerHTML = `
<div class="tune-head"><b>Tune</b><span>Contrast on <code>--bg</code>: 4.5:1 for small text, 3:1 for titles</span></div>
<ul class="tune-list">${TUNE_TOKENS.map(t => `
  <li data-token="${t}"><input type="color" aria-label="${t}"><code>${t}</code><span class="tune-ratio"></span><span class="tune-level"></span></li>`).join("")}
</ul>
<textarea class="tune-css" readonly rows="5" aria-label="CSS for the changed tokens"></textarea>
<div class="tune-buttons"><button type="button" class="btn" data-tune="copy">Copy CSS</button><span class="tune-said" aria-live="polite"></span></div>`;
  document.body.append(p);
  const probe = document.createElement("i");
  p.append(probe);
  TUNE_TOKENS.forEach(t => {
    tune.start[t] = tune.now[t] = tuneHex(t, probe);
    p.querySelector(`[data-token="${t}"] input`).value = tune.start[t];
  });
  probe.remove();
  p.addEventListener("input", e => {
    const t = e.target.closest("[data-token]")?.dataset.token;
    if (!t) return;
    tune.now[t] = e.target.value;
    document.documentElement.style.setProperty(t, e.target.value);
    tuneRender();
  });
  p.querySelector('[data-tune="copy"]').addEventListener("click", async () => {
    const said = p.querySelector(".tune-said");
    try {
      await navigator.clipboard.writeText(tuneCss());
      said.textContent = "Copied.";
    } catch {
      p.querySelector(".tune-css").select();
      said.textContent = "Copy was blocked. The text is selected.";
    }
  });
  return p;
}

if (new URLSearchParams(location.search).has("tune")) {
  const tuneButton = Deck.control({
    label: "Tune",
    key: "p",
    pressed: false,
    action() {
      tune.panel ||= tuneBuild();
      const open = tune.panel.hidden;
      tune.panel.hidden = !open;
      tuneButton.setAttribute("aria-pressed", String(open));
      if (open) tuneRender();
    }
  });
}

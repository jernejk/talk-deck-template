import { chromium } from "playwright";
import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { acquireResourceLock } from "./qa-lock.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    size: { type: "string", default: "1920x1080" },
    settle: { type: "string", default: "1500" },
    window: { type: "string", default: "2000" },
    "max-cpu": { type: "string", default: "5" },
    "max-total": { type: "string", default: "25" },
    slide: { type: "string" },
    json: { type: "boolean", default: false }
  }
});

const exists = path => access(path).then(() => true, () => false);
const repoMode = await exists(join(ROOT, "examples")) && await exists(join(ROOT, "core/deck.js"));
const serveRoot = repoMode ? ROOT : join(ROOT, "site");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".gif": "image/gif", ".json": "application/json", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".ttf": "font/ttf" };

async function deckIndex(path) {
  const abs = resolve(path);
  if (abs.endsWith(".html")) return abs;
  for (const candidate of [join(abs, "index.html"), join(abs, "site/index.html")]) if (await exists(candidate)) return candidate;
  throw new Error(`No deck at ${path}: expected index.html or site/index.html.`);
}

const index = positionals[0] ? await deckIndex(positionals[0]) : join(serveRoot, repoMode ? "examples/catalog/index.html" : "index.html");
if (!index.startsWith(serveRoot + sep)) throw new Error(`${index} is outside ${serveRoot}.`);
const [width, height] = opt.size.split("x").map(Number);
const settle = +opt.settle, span = +opt.window, maxCpu = +opt["max-cpu"], maxTotal = +opt["max-total"];

const releaseResources = await acquireResourceLock({ kind: "perf" });
let measuredBrowser, measuredServer;
try {
const server = createServer(async (req, res) => {
  let path;
  try { path = resolve(serveRoot, "." + decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html")); }
  catch { res.writeHead(400).end(); return; }
  if (!path.startsWith(serveRoot + sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
measuredServer = server;
await new Promise(r => server.listen(0, "127.0.0.1", r));

// Headless Chromium composites on the CPU unless asked for the GPU, which makes any animation look far costlier than on a real laptop.
const gpu = ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
const browser = await chromium.launch({ args: gpu });
measuredBrowser = browser;
const page = await browser.newPage({ viewport: { width, height } });
// CPU seconds per browser process (browser, renderer, GPU, utilities), so compositing and raster work count too.
const browserCdp = await browser.newBrowserCDPSession();
const processes = async () => {
  try { return new Map((await browserCdp.send("SystemInfo.getProcessInfo")).processInfo.map(p => [p.id, p.cpuTime])); }
  catch { return null; }
};
const cpuBetween = (a, z) => a && z ? [...z].reduce((n, [id, t]) => n + Math.max(0, t - (a.get(id) ?? 0)), 0) : null;
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));

// ?res=auto measures the deck itself rather than the preview frame around it.
const url = `http://127.0.0.1:${server.address().port}/${relative(serveRoot, index).split(sep).join("/")}?res=auto`;
await page.goto(url);
await page.waitForFunction(() => window.Deck && document.querySelector(".slide.is-active"));

const ids = await page.evaluate(() => [...document.querySelectorAll(".slide")].map((s, i) => s.id || String(i + 1)));
const rows = [];
for (const [i, id] of ids.entries()) {
  if (opt.slide && opt.slide !== id && opt.slide !== String(i + 1)) continue;
  await page.evaluate(i => Deck.goTo(document.querySelectorAll(".slide")[i]), i);
  await page.waitForTimeout(settle);
  const a = await metrics(), ta = await processes(), wa = performance.now();
  await page.waitForTimeout(span);
  const z = await metrics(), tz = await processes(), wz = performance.now();
  const per = k => +((z[k] - a[k]) / (span / 1000)).toFixed(1);
  const anim = await page.evaluate(() => {
    const active = document.querySelector(".slide.is-active");
    const view = innerWidth * innerHeight;
    const CHEAP = new Set(["transform", "opacity", "translate", "rotate", "scale"]);
    const label = x => { const t = x.effect?.target; return `${x.animationName || x.constructor.name} on ${t?.tagName?.toLowerCase()}${t?.id ? "#" + t.id : ""}${typeof t?.className === "string" && t.className ? "." + t.className.trim().split(/\s+/)[0] : ""}${x.effect?.pseudoElement || ""}`; };
    const props = x => { try { return [...new Set(x.effect.getKeyframes().flatMap(k => Object.keys(k)))].filter(k => !["offset", "computedOffset", "easing", "composite"].includes(k)); } catch { return []; } };
    // A looping animation of anything but transform or opacity repaints its area on every frame it changes.
    const painters = doc => doc.getAnimations().filter(x => x.playState === "running" && x.effect?.getComputedTiming?.().iterations === Infinity)
      .map(x => ({ x, p: props(x) })).filter(({ p }) => p.some(k => !CHEAP.has(k)))
      .map(({ x, p }) => { const r = x.effect.target?.getBoundingClientRect?.(); return { name: label(x), props: p, area: r ? Math.round(r.width * r.height / view * 100) : 0, target: x.effect.target }; });
    const running = document.getAnimations().filter(x => x.playState === "running");
    const offSlide = running.filter(x => { const t = x.effect?.target; return t && !active.contains(t) && !t.closest?.(".deck-nav,.progress,.pet-walk"); });
    const repaint = painters(document).filter(p => active.contains(p.target)).map(({ target, ...p }) => p);
    const frames = [];
    for (const f of document.querySelectorAll("iframe")) {
      try {
        const doc = f.contentDocument;
        const n = doc?.getAnimations?.().filter(x => x.playState === "running").length ?? 0;
        if (n) frames.push({ src: (f.getAttribute("src") || "").slice(0, 60), running: n, repaint: painters(doc).length, onSlide: active.contains(f) });
      } catch { /* cross-origin frames can't be inspected */ }
    }
    const smil = svg => svg.querySelector("animate,animateTransform,animateMotion,set") && !svg.animationsPaused();
    const svgs = [...document.querySelectorAll("svg")].filter(smil);
    for (const s of svgs.filter(s => active.contains(s))) { const r = s.getBoundingClientRect(); repaint.push({ name: "SMIL on svg" + (s.classList[0] ? "." + s.classList[0] : ""), props: ["svg"], area: Math.round(r.width * r.height / view * 100) }); }
    return { running: running.length, offSlide: [...new Set(offSlide.map(label))].slice(0, 5), offSlideCount: offSlide.length, repaint, frames, smilOffSlide: svgs.filter(s => !active.contains(s)).length };
  });
  const cpu = +((z.TaskDuration - a.TaskDuration) / (span / 1000) * 100).toFixed(1);
  const busy = cpuBetween(ta, tz);
  const total = busy === null ? null : +(busy / ((wz - wa) / 1000) * 100).toFixed(1);
  const hiddenFrames = anim.frames.filter(f => !f.onSlide);
  const bigRepaints = anim.repaint.filter(r => r.area >= 10);
  const flags = [];
  if (cpu > maxCpu) flags.push(`main ${cpu}% > ${maxCpu}%`);
  if (total !== null && total > maxTotal) flags.push(`all ${total}% > ${maxTotal}%`);
  if (per("RecalcStyleCount") >= 30) flags.push(`${per("RecalcStyleCount")} style recalcs a second`);
  if (bigRepaints.length) flags.push(`${bigRepaints.length} looping animation(s) repaint ${Math.max(...bigRepaints.map(r => r.area))}% of the screen`);
  if (anim.offSlideCount) flags.push(`${anim.offSlideCount} animations running off-slide`);
  if (hiddenFrames.length) flags.push(`${hiddenFrames.length} hidden iframes animating`);
  if (anim.smilOffSlide) flags.push(`${anim.smilOffSlide} SMIL svgs animating off-slide`);
  rows.push({ n: i + 1, id, cpu, total, layouts: per("LayoutCount"), styles: per("RecalcStyleCount"), running: anim.running, repaint: anim.repaint, offSlide: anim.offSlide, frames: anim.frames, flags });
}

const avg = key => rows.length ? +(rows.reduce((s, r) => s + (r[key] ?? 0), 0) / rows.length).toFixed(1) : 0;
if (opt.json) console.log(JSON.stringify({ rows, averages: { main: avg("cpu"), all: rows.some(r => r.total === null) ? null : avg("total") } }, null, 1));
else {
  console.log(`${relative(process.cwd(), index)} at ${width}×${height}, ${span} ms idle per slide after ${settle} ms`);
  console.log("main = the page's main thread; all = every browser process, including compositing, raster and GPU work.\n");
  console.log(" #  main%   all%  layout/s  style/s  anims  slide");
  for (const r of rows) {
    console.log(`${String(r.n).padStart(2)} ${String(r.cpu).padStart(5)} ${String(r.total ?? "n/a").padStart(6)} ${String(r.layouts).padStart(9)} ${String(r.styles).padStart(8)} ${String(r.running).padStart(6)}  ${r.id}${r.flags.length ? "  ⚠ " + r.flags.join("; ") : ""}`);
    if (r.offSlide.length) console.log(`      off-slide: ${r.offSlide.join(", ")}`);
    for (const p of r.repaint) console.log(`      repaints: ${p.name} (${p.props.join(", ")}) over ${p.area}% of the screen`);
    for (const f of r.frames) console.log(`      iframe ${f.onSlide ? "on" : "OFF"} slide: ${f.src} (${f.running} running, ${f.repaint} repainting)`);
  }
  const flagged = rows.filter(r => r.flags.length);
  const all = avg("total");
  const hour = rows.some(r => r.total === null) ? "" : ` All processes average ${all}% of one core, about ${Math.round(all * 0.6)} CPU-minutes an hour.`;
  console.log(`\nMain thread averages ${avg("cpu")}% of one core.${hour} ${flagged.length ? `${flagged.length} slide(s) flagged.` : "Nothing flagged."}`);
}
if (rows.some(r => r.flags.length)) process.exitCode = 1;
} finally {
  await measuredBrowser?.close();
  measuredServer?.close();
  await releaseResources();
}

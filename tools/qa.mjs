import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({
  options: {
    site: { type: "string", default: "site" },
    out: { type: "string", default: "qa" },
    theme: { type: "string", default: "all" },
    sizes: { type: "string", default: "1920x1080,1280x720" },
    motion: { type: "boolean", default: false }
  }
});

const root = resolve(opt.site);
const themes = opt.theme === "all"
  ? (await readdir(join(root, "themes"))).filter(f => f.endsWith(".css")).map(f => f.slice(0, -4)).sort()
  : opt.theme.split(",");
const sizes = opt.sizes.split(",").map(s => s.split("x").map(Number));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".gif": "image/gif", ".json": "application/json" };
const CHECKED = ".title,.ask,.sub,.hint,.callout,.quote,.bubbles,.memo,.shot,.phone,.tilt,.fan,.stage,.flow,.composer,.mock,.pillars,.pipe,.facts,.tags,.chips,.legend,.stats,.counters,.recipe,.ladder,.timeline,.ledger,.compare,.cols,.sticker,.about-panel,.about-portrait,.close-text,.close-qr";

const server = createServer(async (req, res) => {
  let path;
  try {
    path = resolve(root, "." + decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const problems = [];

function watch(page, where) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", r => errors.push(`failed: ${r.url()}`));
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  return () => { if (errors.length) problems.push({ where, errors }); };
}

for (const theme of themes) {
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: opt.motion ? "no-preference" : "reduce" });
    const flush = watch(page, `${theme} ${w}x${h}`);
    await page.goto(`${base}index.html?theme=${theme}`, { waitUntil: "networkidle" });
    const loaded = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
    if (!loaded) problems.push({ where: `${theme} ${w}x${h}`, errors: [`theme "${theme}" did not load`] });
    const ids = await page.$$eval("section.slide", s => s.map(x => x.id));
    const dir = join(opt.out, theme, `${w}x${h}`);
    await mkdir(dir, { recursive: true });
    for (const [i, id] of ids.entries()) {
      await page.evaluate(id => goTo(document.getElementById(id), { stepMode: "end" }), id);
      await page.waitForTimeout(opt.motion ? 1700 : 120);
      const report = await page.evaluate(([id, checked]) => {
        const slide = document.getElementById(id);
        const vw = innerWidth, vh = innerHeight;
        const foot = slide.querySelector(".slide-foot");
        const footTop = foot && getComputedStyle(foot).display !== "none" ? foot.getBoundingClientRect().top : vh;
        const out = [];
        slide.querySelectorAll(checked).forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || el.closest(".fan .shot, .inset")) return;
          if (r.right > vw + 1 || r.left < -1 || r.bottom > footTop + 1 || r.top < -1)
            out.push(`${el.className.split(" ")[0]} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}] foot ${Math.round(footTop)}`);
        });
        const imgs = [...slide.querySelectorAll("img")].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
        const scroll = slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1;
        return { out, imgs, scroll };
      }, [id, CHECKED]);
      const scrolls = h > w;
      if ((!scrolls && (report.out.length || report.scroll)) || report.imgs.length) problems.push({ where: `${theme} ${w}x${h} #${id}`, ...report });
      await page.screenshot({ path: join(dir, `${String(i + 1).padStart(2, "0")}-${id}.png`) });
    }
    flush();
    await page.close();
  }
}

const offline = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const flushOffline = watch(offline, "file://");
await offline.goto(pathToFileURL(join(root, "index.html")).href, { waitUntil: "load" });
await offline.waitForTimeout(300);
flushOffline();
await offline.close();

const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
await page.goto(`${base}index.html?theme=${themes[0]}`, { waitUntil: "networkidle" });
const hash = () => page.evaluate(() => location.hash);
const presses = await page.evaluate(() => [...document.querySelectorAll("section.slide:not([data-hidden])")].reduce((n, s) => n + 1 + stepGroups(s).length, 0));
const seen = [];
for (let i = 0; i < presses + 2; i++) {
  seen.push((await hash()) || "#" + await page.evaluate(() => document.querySelector("section.slide").id));
  await page.keyboard.press("ArrowRight");
}
const mainOrder = [...new Set(seen)];
const expectedMain = await page.$$eval("section.slide:not([data-hidden])", s => s.map(x => "#" + x.id));
await page.keyboard.press("Home");
const home = await hash();
await page.keyboard.press("n");
const notesOpen = await page.evaluate(() => document.querySelector("#notes-panel").classList.contains("is-open"));
await page.keyboard.press("n");
await page.keyboard.press("o");
const overviewOpen = await page.evaluate(() => document.querySelector("#overview").open);
const overviewCount = await page.$$eval("#overview-list li", l => l.length);
await page.keyboard.press("Escape");
const overviewClosed = await page.evaluate(() => !document.querySelector("#overview").open);
await page.keyboard.press("h");
await page.keyboard.press("End");
const extrasLast = await hash();
await page.keyboard.press("h");
await page.keyboard.press("c");
const closeHash = await hash();
const keys = { mainOrder, home, notesOpen, overviewOpen, overviewCount, overviewClosed, extrasLast, closeHash };
const slideCount = await page.$$eval("section.slide", s => s.length);
const lastId = await page.$$eval("section.slide", s => "#" + s[s.length - 1].id);
const keyFailures = [
  mainOrder.join() !== expectedMain.join() && "ArrowRight did not visit every main slide in order",
  home !== expectedMain[0] && "Home did not return to the first slide",
  !notesOpen && "N did not open the notes",
  !(overviewOpen && overviewCount === slideCount && overviewClosed) && "O/Esc overview failed",
  extrasLast !== lastId && "H + End did not reach the last extra",
  closeHash !== "#close" && "C did not jump to #close"
].filter(Boolean);
if (keyFailures.length) problems.push({ where: "keyboard", errors: keyFailures });

await browser.close();
server.close();
console.log(JSON.stringify({ themes, sizes: opt.sizes, screenshots: opt.out, keys, problems }, null, 1));
process.exitCode = problems.length ? 1 : 0;

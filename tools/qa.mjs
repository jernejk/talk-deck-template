import { chromium } from "playwright";
import { createServer } from "node:http";
import { access, mkdir, readdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: join(ROOT, "qa") },
    theme: { type: "string" },
    sizes: { type: "string", default: "1920x1080,1280x720" },
    motion: { type: "boolean", default: false }
  }
});

const exists = path => access(path).then(() => true, () => false);
const repoMode = await exists(join(ROOT, "examples")) && await exists(join(ROOT, "core/deck.js"));
const serveRoot = repoMode ? ROOT : join(ROOT, "site");
const templatesDir = repoMode ? join(ROOT, "templates") : join(ROOT, "site/lib/templates");
const sizes = opt.sizes.split(",").map(s => s.split("x").map(Number));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".gif": "image/gif", ".json": "application/json", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const CHECKED = ".title,.ask,.sub,.hint,.callout,.quote,.bubbles,.memo,.shot,.phone,.tilt,.fan,.stage,.flow,.composer,.mock,.pillars,.pipe,.facts,.tags,.chips,.legend,.stats,.counters,.recipe,.ladder,.timeline,.ledger,.compare,.cols,.sticker,.about-panel,.about-portrait,.close-text,.close-qr,.cli,.code,.chapter,.bleed-text,.video,.agenda,.cover-panel,.cover-side,.cover-frame,.cover-links,.presenter-panel,.presenter-side,.presenter-team,.presenter-facts,.stages,.versus,.findings,.log,.kpis,.matrix,.milestones,.strip,.schedule,.qr,.pets,.pet-say,.agents,.embed,.fold,.player,.diff,.zoom,.timer";
const problems = [];
const qrShots = [];

async function allThemes() {
  const out = [];
  for (const t of (await readdir(templatesDir)).sort()) if (await exists(join(templatesDir, t, "theme.css"))) out.push(t);
  return out;
}

async function deckIndex(path) {
  const abs = resolve(path);
  if (abs.endsWith(".html")) return abs;
  for (const candidate of [join(abs, "index.html"), join(abs, "site/index.html")]) if (await exists(candidate)) return candidate;
  throw new Error(`No deck at ${path}: expected index.html or site/index.html.`);
}

async function decks() {
  const found = [];
  if (positionals.length) for (const p of positionals) found.push(await deckIndex(p));
  else if (repoMode) {
    for (const dir of (await readdir(join(ROOT, "examples"))).sort()) {
      if (await exists(join(ROOT, "examples", dir, "index.html"))) found.push(join(ROOT, "examples", dir, "index.html"));
    }
  } else found.push(join(ROOT, "site/index.html"));
  const out = [];
  for (const index of found) {
    if (index !== serveRoot && !index.startsWith(serveRoot + sep)) throw new Error(`${index} is outside ${serveRoot}.`);
    const html = await readFile(index, "utf8");
    const own = html.match(/templates\/([\w-]+)\/theme\.css" id="theme"/)?.[1];
    const isCatalog = basename(dirname(index)) === "catalog";
    const themes = opt.theme === "all" || (!opt.theme && isCatalog) ? await allThemes() : opt.theme ? opt.theme.split(",") : [own];
    const name = basename(dirname(index)) === "site" ? basename(dirname(dirname(index))) : basename(dirname(index));
    out.push({ index, name, path: relative(serveRoot, index).split(sep).join("/"), themes });
  }
  return out;
}

if (repoMode && !positionals.length) {
  try { execFileSync(process.execPath, [join(ROOT, "tools/build.mjs"), "--check"], { stdio: "pipe" }); }
  catch (e) { problems.push({ where: "build", errors: String(e.stderr || e.message).trim().split("\n") }); }
}

const server = createServer(async (req, res) => {
  let path;
  try {
    path = resolve(serveRoot, "." + decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (path !== serveRoot && !path.startsWith(serveRoot + sep)) { res.writeHead(403).end(); return; }
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

function watch(page, where) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", r => errors.push(`failed: ${r.url()}`));
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  return () => { if (errors.length) problems.push({ where, errors }); };
}

async function renderAll(deck) {
  for (const theme of deck.themes) {
    if (!theme || !await exists(join(templatesDir, theme, "theme.css"))) { problems.push({ where: deck.name, errors: [`template "${theme}" not found`] }); continue; }
    for (const [w, h] of sizes) {
      const where = `${deck.name} ${theme} ${w}x${h}`;
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: opt.motion ? "no-preference" : "reduce" });
      const flush = watch(page, where);
      await page.goto(`${base}${deck.path}?theme=${theme}`, { waitUntil: "networkidle" });
      const ids = await page.$$eval("section.slide", s => s.map(x => x.id));
      const dir = join(opt.out, deck.name, theme, `${w}x${h}`);
      await mkdir(dir, { recursive: true });
      for (const [i, id] of ids.entries()) {
        await page.evaluate(id => Deck.goTo(document.getElementById(id), { stepMode: "end" }), id);
        await page.waitForTimeout(opt.motion ? 1700 : 120);
        const report = await page.evaluate(([id, checked, motion]) => {
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
          slide.querySelectorAll(".code ol").forEach(ol => { if (ol.scrollWidth > ol.clientWidth + 1) out.push(`code line clipped by ${ol.scrollWidth - ol.clientWidth}px`); });
          const imgs = [...slide.querySelectorAll("img")].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
          const videos = [...slide.querySelectorAll("video")].filter(v => v.error || v.readyState < 1 || (motion && v.closest(".video") && (v.paused || v.currentTime === 0))).map(v => v.currentSrc || v.src);
          const scroll = slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1;
          return { out, imgs, videos, scroll };
        }, [id, CHECKED, opt.motion]);
        const scrolls = h > w;
        if ((!scrolls && (report.out.length || report.scroll)) || report.imgs.length || report.videos.length) problems.push({ where: `${where} #${id}`, ...report });
        const shot = join(dir, `${String(i + 1).padStart(2, "0")}-${id}.png`);
        await page.screenshot({ path: shot });
        const qrs = await page.evaluate(id => [...document.getElementById(id).querySelectorAll("a.close-qr, a.qr-link")].map(a => a.href), id);
        if (qrs.length) qrShots.push({ where: `${where} #${id}`, shot, expected: qrs });
      }
      flush();
      await page.close();
    }
  }
}

async function offline(deck) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const flush = watch(page, `${deck.name} file://`);
  await page.goto(pathToFileURL(deck.index).href, { waitUntil: "load" });
  await page.waitForTimeout(300);
  flush();
  await page.close();
}

async function keyboard(deck) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  await page.goto(`${base}${deck.path}`, { waitUntil: "networkidle" });
  const hash = () => page.evaluate(() => location.hash);
  const presses = await page.evaluate(() => [...document.querySelectorAll("section.slide:not([data-hidden])")].reduce((n, s) => n + 1 + Deck.stepGroups(s).length, 0));
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
  const slideCount = await page.$$eval("section.slide", s => s.length);
  const lastId = await page.$$eval("section.slide", s => "#" + s[s.length - 1].id);
  const hasClose = await page.$("#close") !== null;
  const failures = [
    mainOrder.join() !== expectedMain.join() && "ArrowRight did not visit every main slide in order",
    home !== expectedMain[0] && "Home did not return to the first slide",
    !notesOpen && "N did not open the notes",
    !(overviewOpen && overviewCount === slideCount && overviewClosed) && "O and Esc did not open and close the overview",
    extrasLast !== lastId && "H then End did not reach the last slide",
    hasClose && closeHash !== "#close" && "C did not jump to #close"
  ].filter(Boolean);
  if (failures.length) problems.push({ where: `${deck.name} keyboard`, errors: failures });
  await page.close();
  return { main: mainOrder.length, slides: slideCount };
}

const summary = {};
for (const deck of await decks()) {
  await renderAll(deck);
  await offline(deck);
  summary[deck.name] = { themes: deck.themes.join(" "), ...await keyboard(deck) };
}

async function checkQrs() {
  if (!qrShots.length) return "none";
  if (process.platform !== "darwin") return "skipped (needs macOS)";
  let lines;
  try { lines = execFileSync("swift", [join(ROOT, "tools/qr.swift"), "--read", ...qrShots.map(q => q.shot)], { encoding: "utf8" }).trim().split("\n"); }
  catch { return "skipped (swift unavailable)"; }
  const found = Object.fromEntries(lines.map(l => JSON.parse(l)).map(r => [r.file, r.found]));
  const norm = u => { try { return new URL(u).href; } catch { return u; } };
  for (const q of qrShots) {
    const got = (found[q.shot] || []).map(norm);
    for (const want of q.expected) {
      if (!got.includes(norm(want))) problems.push({ where: q.where, errors: [`QR code ${got.length ? `decodes to ${got.join(", ")}` : "doesn't decode"}; the link is ${want}`] });
    }
  }
  return `${qrShots.length} checked`;
}
const qrCheck = await checkQrs();

await browser.close();
server.close();
console.log(JSON.stringify({ decks: summary, sizes: opt.sizes, qr: qrCheck, screenshots: opt.out, problems }, null, 1));
process.exitCode = problems.length ? 1 : 0;

import { chromium, webkit } from "playwright";
import { createServer } from "node:http";
import { access, mkdir, readdir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { selectSlides, slideSections, inheritedTemplates } from "./qa-scope.mjs";
import { acquireOutputLock, acquireResourceLock, browserBudget } from "./qa-lock.mjs";
import { artifact, assertDeckInput, assertOutputBoundary, createRun, fingerprint, fingerprintPlan, qaStatus, QA_SCHEMA, writeReceipt } from "./qa-receipt.mjs";
import { checkFeatures, featureScope, inspectDeck, lateErrors, readySlide, watchPage } from "./qa-features.mjs";

const budget = browserBudget();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: join(ROOT, "qa") },
    theme: { type: "string" },
    sizes: { type: "string", default: "1920x1080,1280x720" },
    motion: { type: "boolean", default: false },
    titles: { type: "boolean", default: false },
    jobs: { type: "string", default: String(budget) },
    slides: { type: "string" },
    fast: { type: "boolean", default: false },
    changed: { type: "boolean", default: false },
    since: { type: "string" },
    status: { type: "boolean", default: false },
    "lint-baseline": { type: "string" },
    "lint-checks": { type: "string" }
  }
});
const jobs = Number(opt.jobs);
if (!Number.isInteger(jobs) || jobs < 1 || jobs > budget) throw new Error(`--jobs must be a whole number from 1 to ${budget} (this machine's browser budget; TALK_DECK_BROWSER_SLOTS sets it), not "${opt.jobs}".`);

const exists = path => access(path).then(() => true, () => false);
const repoMode = await exists(join(ROOT, "examples")) && await exists(join(ROOT, "core/deck.js"));
const changed = opt.changed || opt.since !== undefined;
if (changed && (positionals.length || opt.theme || opt.slides)) throw new Error("--changed picks the decks, templates and slides itself, so leave out deck paths, --theme and --slides.");
const serveRoot = repoMode ? ROOT : join(ROOT, "site");
const templatesDir = repoMode ? join(ROOT, "templates") : join(ROOT, "site/lib/templates");
const sizeList = opt.fast ? opt.sizes.split(",").slice(0, 1) : opt.sizes.split(",");
const sizes = sizeList.map(s => s.split("x").map(Number));
if (sizeList.some(s => !/^\d+x\d+$/.test(s)) || sizes.some(s => s.some(n => !Number.isInteger(n) || n < 100 || n > 10000)) || new Set(sizeList).size !== sizeList.length) throw new Error("--sizes needs unique WIDTHxHEIGHT pairs between 100 and 10000 pixels.");
const picks = opt.slides?.split(",").map(s => s.trim());
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".gif": "image/gif", ".json": "application/json", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const CHECKED = ".title,.ask,.sub,.hint,.callout,.quote,.bubbles,.memo,.shot,.phone,.tilt,.fan,.stage,.flow,.composer,.mock,.threads,.scores,.pillars,.pipe,.facts,.tags,.chips,.legend,.stats,.counters,.recipe,.ladder,.timeline,.ledger,.compare,.cols,.sticker,.about-panel,.about-portrait,.close-text,.close-qr,.cli,.code,.chapter,.bleed-text,.video,.agenda,.cover-panel,.cover-side,.cover-frame,.cover-links,.presenter-panel,.presenter-side,.presenter-team,.presenter-facts,.stages,.versus,.findings,.log,.kpis,.matrix,.milestones,.strip,.schedule,.qr,.pets,.pet-say,.agents,.embed,.fold,.player,.diff,.zoom,.timer";
const problems = [];
const warnings = [];
const note = msg => console.error(`qa --changed: ${msg}`);

// --changed: the smallest set of decks, templates and slides that covers what git says changed. null means a full run.
async function changedScope() {
  const { USED_BY, slideSections, templates } = await import("./lib.mjs");
  let files;
  try {
    const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: "pipe" }).split("\n").filter(Boolean);
    files = [...new Set([...git("ls-files", "--others", "--exclude-standard"), ...git("diff", "--name-only", "--no-renames", "--relative", "--merge-base", opt.since || "HEAD")])].filter(f => f.split("/")[0] !== "node_modules").sort();
  } catch (e) {
    note(`git failed (${String(e.stderr || e.message).trim().split("\n")[0]}), so this is a full run.`);
    return null;
  }
  note(`${files.length} file(s) changed against ${opt.since || "HEAD"}.`);
  const examples = [];
  for (const dir of (await readdir(join(ROOT, "examples"))).sort()) if (dir !== "catalog" && await exists(join(ROOT, "examples", dir, "index.html"))) examples.push(dir);
  // Deck folder → templates ("*" every template, "own" the deck's own) and slide ids (null means every slide).
  // ponytail: one slide list per deck, not per template, so mixed changes can shoot a few slides more than they need.
  const scope = new Map();
  const add = (deck, themes, slides = null) => {
    const s = scope.get(deck) ?? { themes: new Set(), slides: [] };
    for (const t of themes) s.themes.add(t);
    s.slides = s.slides && slides ? [...new Set([...s.slides, ...slides])] : null;
    scope.set(deck, s);
  };
  // The build writes components/components.* and examples/catalog/ from components/ and slides/, so they count only on their own.
  const sources = new Set(), generated = new Set();
  for (const f of files) {
    const [top, name = "", ...rest] = f.split("/");
    const why = msg => note(`  ${f} → ${msg}`);
    if (f.endsWith(".md") || top === "docs" || f === "examples/index.html") continue;
    if (top === "templates" && rest.length && await exists(join(ROOT, "templates", name, "theme.css"))) {
      const themes = inheritedTemplates([name], await templates(ROOT));
      add("catalog", themes);
      for (const deck of examples) add(deck, themes);
      why(`the catalog and every example, in ${name}`);
    } else if (top === "slides" && !rest.length && name.endsWith(".html") && await exists(join(ROOT, f))) {
      sources.add("slides");
      const ids = slideSections(await readFile(join(ROOT, f), "utf8")).map(s => s.id);
      add("catalog", ["*"], ids);
      why(`the catalog in every template, slides ${ids.join(",")}`);
    } else if (top === "slides") {
      sources.add("slides");
      add("catalog", ["*"]);
      why("the catalog in every template");
    } else if (top === "components" && /^components\.(css|js)$/.test(name)) {
      generated.add("components");
    } else if (top === "examples" && name === "catalog") {
      generated.add("slides");
    } else if (top === "components" && rest.length && await exists(join(ROOT, "components", name))) {
      sources.add("components");
      add("catalog", ["*"]);
      const uses = USED_BY[name] ?? new RegExp(`class="[^"]*\\b${name}\\b`);
      const users = [];
      for (const deck of examples) if (uses.test(await readFile(join(ROOT, "examples", deck, "index.html"), "utf8"))) { add(deck, ["own"]); users.push(deck); }
      why(`the catalog in every template${users.length ? `, and ${users.join(", ")}` : ""}`);
    } else if (top === "examples" && rest.length && await exists(join(ROOT, "examples", name, "index.html"))) {
      add(name, ["own"]);
      why(`${name} in its own template`);
    } else {
      why("can change any deck, so this is a full run");
      return null;
    }
  }
  if (generated.has("components") && !sources.has("components")) {
    note("  components/components.* changed without a component folder, so this is a full run.");
    return null;
  }
  if (generated.has("slides") && !sources.has("slides")) {
    add("catalog", ["*"]);
    note("  examples/catalog/ changed without slides/, so the catalog runs in every template.");
  }
  return scope;
}
const scope = changed && repoMode ? await changedScope() : null;
if (changed && !repoMode) note("it is a repo-only flag, so this checks the whole deck.");

async function allThemes() {
  const out = [];
  for (const t of (await readdir(templatesDir)).sort()) if (await exists(join(templatesDir, t, "theme.css"))) out.push(t);
  return out;
}

async function deckIndex(path) {
  const abs = resolve(path);
  if (abs.endsWith(".html")) return realpath(abs);
  for (const candidate of [join(abs, "index.html"), join(abs, "site/index.html")]) if (await exists(candidate)) return realpath(candidate);
  throw new Error(`No deck at ${path}: expected index.html or site/index.html.`);
}

async function decks() {
  const found = [];
  if (scope) for (const dir of [...scope.keys()].sort()) found.push(join(ROOT, "examples", dir, "index.html"));
  else if (positionals.length) for (const p of positionals) found.push(await deckIndex(p));
  else if (repoMode) {
    for (const dir of (await readdir(join(ROOT, "examples"))).sort()) {
      if (await exists(join(ROOT, "examples", dir, "index.html"))) found.push(join(ROOT, "examples", dir, "index.html"));
    }
  } else found.push(join(ROOT, "site/index.html"));
  const out = [];
  for (const index of found) {
    await assertDeckInput(ROOT, repoMode, index);
    const html = await readFile(index, "utf8");
    const own = html.match(/templates\/([\w-]+)\/theme\.css" id="theme"/)?.[1];
    const isCatalog = basename(dirname(index)) === "catalog";
    const want = scope?.get(basename(dirname(index)));
    const themes = want ? (want.themes.has("*") ? await allThemes() : [...new Set([...want.themes].map(t => t === "own" ? own : t))])
      : opt.theme === "all" || (!opt.theme && isCatalog) ? await allThemes() : opt.theme ? opt.theme.split(",") : [own];
    const name = basename(dirname(index)) === "site" ? basename(dirname(dirname(index))) : basename(dirname(index));
    if (themes.some(t => !t?.trim()) || new Set(themes).size !== themes.length) throw new Error(`${name}: templates must be non-empty and unique.`);
    const selectors = want ? want.slides ?? undefined : picks;
    const allIds = slideSections(html).map(s => s.id), selectedIds = selectSlides(allIds, selectors);
    out.push({ index, name, html, allIds, selectedIds, path: relative(serveRoot, index).split(sep).join("/"), themes, picks: selectors });
  }
  return out;
}

const deckList = await decks();
if (new Set(deckList.map(d => d.name)).size !== deckList.length) throw new Error("Deck names must be unique within a QA run.");
if (opt.status) {
  const status = await qaStatus(resolve(opt.out), deckList.map(d => d.index));
  console.log(JSON.stringify(status, null, 1));
  process.exitCode = status.currentFull && status.latest.problems === 0 ? 0 : 1;
} else {
  try { await runQA(); }
  catch (e) {
    console.log(JSON.stringify({ decks: {}, problems: [{ where: "qa", errors: [e.message] }], warnings: [], pending: ["QA did not complete"] }));
    process.exitCode = 1;
  }
}

async function runQA() {
const started = performance.now(), startedAt = new Date().toISOString();
const plan = fingerprintPlan(ROOT, repoMode);
const out = resolve(opt.out);
if (plan.inputs.some(p => out === p || out.startsWith(p + sep)) || out === serveRoot) throw new Error("--out must be outside served input folders (use the deck's qa/ folder or an external evidence folder).");
await assertOutputBoundary(out, plan.inputs, [serveRoot]);
const releaseOutput = await acquireOutputLock(out);
let releaseResources, server, browser, webkitBrowser;
try {
releaseResources = await acquireResourceLock({ kind: "qa", slots: jobs, budget });
const run = await createRun(out);
const config = { sizes: sizeList, motion: opt.motion, titles: opt.titles, jobs, fast: opt.fast, theme: opt.theme ?? null, selectors: picks ?? null, changed, since: opt.since ?? null, targets: positionals.map(p => resolve(p)), lintBaseline: opt["lint-baseline"] ? resolve(opt["lint-baseline"]) : null, lintChecks: opt["lint-checks"]?.split(",") ?? null };
if (config.lintBaseline) plan.tools.push(config.lintBaseline);
const before = await fingerprint(plan, config);
const inputFiles = new Map(before.inputs.files.filter(file => file.sha256).map(file => [file.path, file.target ?? file.path]));
const inputFolders = plan.inputs.filter(path => before.inputs.files.some(file => file.directory && file.path === path + "/"));
const uncovered = new Set();
function coveredFile(path, actual) {
  return inputFiles.get(path) === actual && inputFiles.has(actual);
}
const limitations = [opt.fast && "--fast", picks && "--slides", changed && "--changed/--since", opt.theme && "--theme", !["1920x1080", "1280x720"].every(size => sizeList.includes(size)) && "custom sizes omit a default size"].filter(Boolean);
const receiptScope = { kind: opt.fast ? "fast" : limitations.length ? "scoped" : "full", limitations, universe: repoMode && !positionals.length ? "engine" : "decks", decks: deckList.map(({ index, name, themes, allIds, selectedIds }) => ({ index, name, themes, allIds, selectedIds })) };
const pending = [];
if (repoMode && !positionals.length) {
  try { execFileSync(process.execPath, [join(ROOT, "tools/build.mjs"), "--check"], { stdio: "pipe" }); }
  catch (e) { problems.push({ where: "build", errors: String(e.stderr || e.message).trim().split("\n") }); }
}
if (scope?.size === 0) note("nothing changed outside the docs; this records an empty scoped run, never full evidence.");

const artifactRoot = await realpath(run.artifactRoot);
server = createServer(async (req, res) => {
  let path, root = serveRoot;
  try {
    let url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    // The contact sheet loads this run's screenshots from /__qa-out/.
    if (url.startsWith("/__qa-out/")) { root = run.artifactRoot; url = url.slice("/__qa-out".length); }
    path = resolve(root, "." + url.replace(/\/$/, "/index.html"));
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  if (root === serveRoot && !inputFiles.has(path) && !inputFolders.some(folder => path.startsWith(folder + sep))) uncovered.add(path);
  try {
    const actual = await realpath(path);
    if (root === serveRoot) {
      if (!coveredFile(path, actual)) {
        uncovered.add(path);
        res.writeHead(403).end("QA resource is outside the fingerprinted inputs");
        return;
      }
    } else if (!actual.startsWith(artifactRoot + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(actual);
    const headers = { "content-type": TYPES[extname(path)] || "application/octet-stream", "accept-ranges": "bytes" };
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, body.length - Number(match?.[2]));
      const end = match?.[1] && match[2] ? Math.min(body.length - 1, Number(match[2])) : body.length - 1;
      if (!match || !Number.isInteger(start) || start < 0 || start >= body.length || end < start) { res.writeHead(416, { "content-range": `bytes */${body.length}` }).end(); return; }
      const chunk = body.subarray(start, end + 1);
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": chunk.length }).end(req.method === "HEAD" ? undefined : chunk);
    } else res.writeHead(200, { ...headers, "content-length": body.length }).end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

browser = await chromium.launch();
// Missing standalone lint is visible and leaves its evidence pending.
const lintFile = join(ROOT, "tools/lint.mjs");
const lintModule = await exists(lintFile) ? await import(pathToFileURL(lintFile).href) : null;
const lint = lintModule?.lint;
async function lintDeck(deck) {
  if (!lint) return { problems: [], warnings: [{ where: deck.name, check: "lint-missing", message: "Content lint was not run: tools/lint.mjs is missing. Run npm run upgrade from the engine." }], pending: [`${deck.name}: content lint`], completed: false };
  const found = await lint(await readFile(deck.index, "utf8"), { browser, catalog: basename(dirname(deck.index)) === "catalog" });
  return { problems: [], lintRecord: { index: deck.index, slideIds: deck.allIds, findings: found }, warnings: found.map(({ slide, check, message }) => ({ where: slide ? `${deck.name} #${slide}` : deck.name, check, message })) };
}

function watch(page, where, problems, warnings) {
  return watchPage(page, where, problems, warnings);
}

// One job = one deck in one template at one size. Each job returns its own findings, and they are merged in job order, so --jobs never changes the report.
async function render(deck, theme, [w, h]) {
  const found = { problems: [], warnings: [], qrShots: [], artifacts: [], checkedIds: [], qrIds: [] };
  const where = `${deck.name} ${theme} ${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: opt.motion ? "no-preference" : "reduce" });
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(15000);
  const flush = watch(page, where, found.problems, found.warnings);
  try {
  await page.goto(`${base}${deck.path}?res=auto&theme=${theme}`, { waitUntil: "networkidle" });
  const ids = await page.$$eval("section.slide", s => s.map(x => x.id));
  if (JSON.stringify(ids) !== JSON.stringify(deck.allIds)) throw new Error("Runtime slide IDs differ from the input snapshot.");
  const dir = join(run.artifactRoot, encodeURIComponent(deck.name), encodeURIComponent(theme), `${w}x${h}`);
  await mkdir(dir, { recursive: true });
  const shots = [];
  for (const [i, id] of ids.entries()) {
    if (!deck.selectedIds.includes(id)) continue;
    await page.evaluate(id => Deck.goTo(document.getElementById(id), { stepMode: "end" }), id);
    if (deck.info.slides.find(s => s.id === id).features.length) {
      try { await readySlide(page, id); }
      catch (e) { found.problems.push({ where: `${where} #${id}`, check: "readiness", errors: [e.message] }); }
    }
    await page.waitForTimeout(opt.motion ? 1700 : 120);
    const report = await page.evaluate(([id, checked, motion]) => {
      const slide = document.getElementById(id);
      const vw = innerWidth, vh = innerHeight;
      const scrolls = ["auto", "scroll"].includes(getComputedStyle(slide).overflowY);
      const foot = slide.querySelector(".slide-foot");
      const footTop = foot && getComputedStyle(foot).display !== "none" ? foot.getBoundingClientRect().top : vh;
      const out = [];
      slide.querySelectorAll(checked).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || el.closest(".fan .shot, .inset")) return;
        if (r.right > vw + 1 || r.left < -1 || (!scrolls && (r.bottom > footTop + 1 || r.top < -1)))
          out.push(`${el.className.split(" ")[0]} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}] foot ${Math.round(footTop)}`);
      });
      slide.querySelectorAll(".code ol").forEach(ol => { if (ol.scrollWidth > ol.clientWidth + 1) out.push(`code line clipped by ${ol.scrollWidth - ol.clientWidth}px`); });
      const imgs = [...slide.querySelectorAll("img")].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
      const videos = [...slide.querySelectorAll("video")].filter(v => v.error || v.readyState < 1 || (motion && v.closest(".video") && (v.paused || v.currentTime === 0))).map(v => v.currentSrc || v.src);
      const scroll = (!scrolls && slide.scrollHeight > slide.clientHeight + 1) || slide.scrollWidth > slide.clientWidth + 1;
      // Lines are counted from text fragments only: an element box (a block <em>) would otherwise count as a line of its own.
      const lineCount = el => {
        const size = parseFloat(getComputedStyle(el).fontSize) || 16, tops = [];
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n; (n = walk.nextNode());) {
          if (!n.textContent.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const box of r.getClientRects()) if (box.width) tops.push(box.top);
        }
        tops.sort((a, b) => a - b);
        return tops.reduce((acc, t) => t - acc.last > size * .5 ? { n: acc.n + 1, last: t } : acc, { n: 0, last: -Infinity }).n;
      };
      const title = slide.querySelector("h2.title:not(.title--stack)");
      const em = title?.querySelector("em");
      const titleLines = title?.getBoundingClientRect().width ? lineCount(title) : 0;
      const emSplit = em ? lineCount(em) > 1 : false;
      return { out, imgs, videos, scroll, scrolls, titleLines, emSplit };
    }, [id, CHECKED, opt.motion]);
    const { titleLines, emSplit, scrolls, ...checks } = report;
    if ((checks.out.length || checks.scroll) || checks.imgs.length || checks.videos.length) found.problems.push({ where: `${where} #${id}`, ...checks });
    // The catalog's placeholder titles wrap by design; real decks follow the two-line rule.
    if (!scrolls && titleLines > 2 && deck.name !== "catalog") found.warnings.push({ where: `${where} #${id}`, check: "title-lines", message: `the title wraps to ${titleLines} lines; keep it to two` });
    else if (opt.titles && !scrolls && emSplit) found.warnings.push({ where: `${where} #${id}`, check: "title-break", message: "the <em> payoff breaks across lines; shorten it or put it on its own line" });
    const qrs = await page.evaluate(id => [...document.getElementById(id).querySelectorAll("a.close-qr, a.qr-link")].map(a => a.href), id);
    found.checkedIds.push(id);
    if (qrs.length) found.qrIds.push(id);
    // ponytail: --fast skips screenshots, the slowest step, but keeps the ones the QR check reads.
    if (opt.fast && !qrs.length) continue;
    const shot = join(dir, `${String(i + 1).padStart(2, "0")}-${encodeURIComponent(id)}.png`);
    await page.screenshot({ path: shot });
    shots.push(shot);
    found.artifacts.push(await artifact(run.artifactRoot, shot, { kind: "slide", index: deck.index, slide: id, theme, size: `${w}x${h}` }));
    if (qrs.length) found.qrShots.push({ where: `${where} #${id}`, shot, expected: qrs });
  }
  found.lateErrors = await lateErrors(page);
  if (!opt.fast && shots.length) {
    const sheet = join(run.artifactRoot, encodeURIComponent(deck.name), encodeURIComponent(theme), `sheet-${w}x${h}.png`);
    await contactSheet(page, shots, sheet);
    found.artifacts.push(await artifact(run.artifactRoot, sheet, { kind: "sheet", index: deck.index, theme, size: `${w}x${h}` }));
  }
  } catch (e) { found.completed = false; found.problems.push({ where, errors: [e.message] }); }
  finally { await flush(); await page.close(); }
  return found;
}

// All screenshots of one run as thumbnails on one image, to scan a deck at a glance.
async function contactSheet(page, shots, path) {
  const cells = shots.map(s => `<figure><img src="${base}__qa-out/${relative(run.artifactRoot, s).split(sep).map(encodeURIComponent).join("/")}"><figcaption>${basename(s, ".png")}</figcaption></figure>`).join("");
  await page.setViewportSize({ width: 1600, height: 200 });
  await page.setContent(`<!doctype html><style>body{margin:0;padding:16px;background:#222;color:#ddd;font:13px system-ui,sans-serif;display:grid;grid-template-columns:repeat(5,1fr);gap:16px;align-items:start}figure{margin:0}img{display:block;width:100%;outline:1px solid #555}figcaption{padding-top:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}</style>${cells}`);
  await page.screenshot({ path, fullPage: true });
}

async function offline(deck) {
  const found = { problems: [] };
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultNavigationTimeout(15000);
  const flush = watch(page, `${deck.name} file://`, found.problems, found.warnings ??= []);
  // Pin alias requests to the checked canonical file at Chromium interception.
  await page.route(/^file:/, async route => {
    const url = new URL(route.request().url());
    let path, actual;
    try {
      path = fileURLToPath(url);
      actual = await realpath(path);
    } catch { /* Report the original request as well when it cannot be resolved. */ }
    if (!coveredFile(path, actual)) {
      found.problems.push({
        where: deck.name + " file://", check: "resource-input-scope", errors: ["QA resource is outside the fingerprinted inputs or changed target: " + (path ?? url.href)]
      });
      await route.abort();
    } else if (actual !== path) {
      const target = pathToFileURL(actual);
      target.search = url.search;
      await route.continue({ url: target.href });
    } else await route.continue();
  });
  try {
    await page.goto(pathToFileURL(deck.index).href + "?res=auto", { waitUntil: "load" });
    await page.waitForTimeout(300);
  } catch (error) {
    found.completed = false;
    found.problems.push({ where: deck.name + " file://", errors: [error.message] });
  } finally {
    await flush();
    await page.close();
  }
  return found;
}

async function keyboard(deck) {
  const found = { problems: [] };
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(15000);
  const flush = watch(page, `${deck.name} keyboard`, found.problems, found.warnings ??= []);
  try {
  await page.goto(`${base}${deck.path}?res=auto`, { waitUntil: "networkidle" });
  const hash = () => page.evaluate(() => location.hash);
  const presses = await page.evaluate(() => [...document.querySelectorAll("section.slide:not([data-hidden])")].reduce((n, s) => n + 1 + Deck.stepGroups(s).length, 0));
  const seen = [];
  for (let i = 0; i < presses + 2; i++) {
    seen.push((await hash()) || "#" + await page.evaluate(() => document.querySelector("section.slide").id));
    const id = await page.evaluate(() => Deck.current()?.id);
    if (deck.info.slides.some(s => s.id === id && s.features.length)) {
      await readySlide(page, id);
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    }
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
  if (failures.length) found.problems.push({ where: `${deck.name} keyboard`, errors: failures });
  summary[deck.name] = { themes: deck.themes.join(" "), main: mainOrder.length, slides: slideCount };
  } finally { await flush(); await page.close(); }
  return found;
}

const summary = {};
const tasks = [];
const addTask = (kind, deck, run, metadata = {}) => tasks.push({ kind, index: deck.index, deck: deck.name, ...metadata, run });
for (const deck of deckList) {
  deck.info = await inspectDeck(deck.html, browser);
  if (JSON.stringify(deck.info.slides.map(s => s.id)) !== JSON.stringify(deck.allIds)) throw new Error(`${deck.name}: parsed slide IDs disagree.`);
  deck.features = featureScope(deck.info, deck.selectedIds);
}
let webkitError;
if (deckList.some(d => d.features.relevant)) {
  try { webkitBrowser = await webkit.launch(); }
  catch (e) { webkitError = e.message.split("\n").slice(0, 3).join(" "); }
}
if (scope) note(`checking ${deckList.map(d => `${d.name} in ${d.themes.join(" ")}${d.picks ? ` (slides ${d.picks.join(",")})` : ""}`).join(", ")}.`);
else if (changed && repoMode) note("checking everything.");
for (const deck of deckList) {
  summary[deck.name] = null;
  for (const theme of deck.themes) {
    if (!theme || !await exists(join(templatesDir, theme, "theme.css"))) { addTask("template", deck, async () => ({ completed: false, problems: [{ where: deck.name, errors: [`template "${theme}" not found`] }] })); continue; }
    for (const size of sizes) addTask("render", deck, () => render(deck, theme, size), { theme, size: size.join("x") });
  }
  for (const [kind, check] of [["offline", offline], ["keyboard", keyboard]]) {
    addTask(kind, deck, () => opt.fast
      ? { completed: false, problems: [], pending: [`${deck.name}: full ${kind} verification deferred by --fast`] }
      : check(deck));
  }
  addTask("lint", deck, () => lintDeck(deck));
  addTask("features-chromium", deck, () => checkFeatures({ browser, browserName: "chromium", deck, base, scope: deck.features }));
  addTask("features-webkit", deck, () => {
    if (!deck.features.relevant) return { problems: [], checks: [{ check: "features", state: "not-applicable", reason: "No feature slides in scope." }] };
    if (!webkitBrowser) {
      const item = { where: deck.name, check: "webkit-missing", message: `Playwright WebKit is unavailable: ${webkitError}` };
      return { completed: false, problems: receiptScope.kind === "full" ? [item] : [], warnings: receiptScope.kind === "full" ? [] : [item], pending: [`${deck.name}: Playwright WebKit feature checks`] };
    }
    return checkFeatures({ browser: webkitBrowser, browserName: "webkit", deck, base, scope: deck.features });
  });
}
const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, async () => {
  while (next < tasks.length) {
    const i = next++, { run, ...task } = tasks[i], start = performance.now();
    try { const found = await run(); results[i] = { ...task, completed: true, ...found, durationMs: Math.round((performance.now() - start) * 1000) / 1000 }; }
    catch (e) { results[i] = { ...task, completed: false, durationMs: Math.round((performance.now() - start) * 1000) / 1000, problems: [{ where: `${task.deck} ${task.kind}`, errors: [e.message] }] }; }
  }
}));
const qrShots = results.flatMap(r => r.qrShots || []);
for (const r of results) { problems.push(...(r.problems || [])); pending.push(...(r.pending || [])); }
const seen = new Set();
for (const w of results.flatMap(r => r.warnings || [])) if (!seen.has(w.message + w.where)) { seen.add(w.message + w.where); warnings.push(w); }

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
if (qrCheck.startsWith("skipped")) pending.push(`QR decoding ${qrCheck}`);
const lintRecords = results.flatMap(r => r.lintRecord ? [r.lintRecord] : []);
if (config.lintBaseline) {
  try {
    if (!lintModule) throw new Error("Content lint is missing.");
    const added = lintModule.compareLint(lintModule.lintRecords(JSON.parse(await readFile(config.lintBaseline, "utf8"))), lintRecords, { slides: new Map(deckList.map(d => [d.index, d.selectedIds])), checks: config.lintChecks ?? undefined });
    for (const w of added) problems.push({ where: `${basename(dirname(w.index))} #${w.slide}`, check: "new-lint-warning", lintCheck: w.check, message: w.message });
  } catch (e) { problems.push({ where: "lint baseline", errors: [e.message] }); }
}
if (uncovered.size) problems.push({
  where: "QA HTTP server", check: "resource-input-scope",
  errors: [...uncovered].sort().map(path => "QA resource is outside the fingerprinted inputs: " + path)
});
const after = await fingerprint(plan, config);
if (before.digest !== after.digest) { problems.push({ where: "fingerprint", errors: ["Inputs/tools/browser changed during QA. This run cannot be current evidence."] }); pending.push("rerun after inputs stop changing"); }
const artifacts = results.flatMap(r => r.artifacts || []);
const screenshotCounts = { slides: artifacts.filter(a => a.kind === "slide").length, sheets: artifacts.filter(a => a.kind === "sheet").length, total: artifacts.length };
const receipt = { schema: QA_SCHEMA, ...run, root: ROOT, startedAt, finishedAt: new Date().toISOString(), durationMs: Math.round((performance.now() - started) * 1000) / 1000, config, scope: receiptScope, fingerprint: before, browserVersions: { chromium: browser.version(), webkit: webkitBrowser?.version() ?? null }, tasks: results.map(({ artifacts, qrShots, lintRecord, ...r }) => r), lint: lintRecords, artifacts, screenshotCounts, qr: qrCheck, problems, warnings, pending, physicalPhone: { status: "unverified", reason: "Desktop/emulated checks do not verify a physical phone." } };
const receiptPath = await writeReceipt(out, receipt);
console.log(JSON.stringify({ decks: summary, scope: receiptScope.kind, sizes: sizeList.join(","), qr: qrCheck, screenshots: run.artifactRoot, screenshotCounts, receipt: receiptPath, durationMs: receipt.durationMs, tasks: results.length, pending, physicalPhone: receipt.physicalPhone, problems, warnings }, null, 1));
process.exitCode = problems.length ? 1 : 0;
} finally {
  await webkitBrowser?.close();
  await browser?.close();
  if (server) await new Promise(r => server.close(r));
  await releaseResources?.();
  await releaseOutput();
}
}

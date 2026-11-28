// Content lint is advisory by default. --baseline opts into a scoped no-new-warning contract.
import { chromium } from "playwright";
import { access, readdir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { selectSlides, slideSections } from "./qa-scope.mjs";
import { acquireResourceLock } from "./qa-lock.mjs";
import { atomicJSON } from "./qa-receipt.mjs";

export const CHECKS = {
  "clock-order": "Notes clocks run in talk order: each main slide's window starts at or after the previous one ends",
  "live-cap": "A data-live slide has a screenshot on the slide and a 20-second cap in its notes",
  "one-em": "A slide title has at most one <em>",
  "curly-quotes": "Slide text uses curly quotes and apostrophes",
  "private-data": "Notes have no emails, private hosts or addresses, tokens or long IDs",
  "drawn-disclosure": "Drawn mock-ups say they are drawn, and generated images keep their prompt in the notes",
  "fixed-colour": "Inline styles outside drawn mock-ups use palette slots, not fixed colours",
  "layout-variety": "Two main slides in a row don't share a data-layout"
};

// Runs in the browser on a parsed copy of the deck: DOMParser loads nothing and runs no scripts.
// The catalog is a list of patterns, not a talk, so it skips the two checks about talk order.
function check([html, catalog]) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const slides = [...doc.querySelectorAll("section.slide")];
  const out = [];
  const warn = (slide, check, message) => out.push({ slide: slide?.id || null, check, message });
  const notesText = s => [...s.querySelectorAll("aside.notes")].map(n => n.textContent).join(" ");
  const DRAWN_CLASSES = ["mock", "composer", "memo", "cli", "threads"];
  const DRAWN = DRAWN_CLASSES.map(c => "." + c).join(", ");

  // Matches how components/rehearse reads a slide's planned window.
  const CLOCK = /(\d+):(\d{2})\s*[–—-]\s*(\d+):(\d{2})/;
  let prev = null;
  for (const s of catalog ? [] : slides.filter(s => !s.hasAttribute("data-hidden"))) {
    const m = [...s.querySelectorAll("aside.notes b")].map(b => b.textContent.match(CLOCK)).find(Boolean);
    if (!m) { warn(s, "clock-order", "no clock in the notes, so the rehearsal timer has no plan for this slide"); continue; }
    const from = +m[1] * 60 + +m[2], to = +m[3] * 60 + +m[4], label = m[0];
    if (to < from) warn(s, "clock-order", `clock ${label} ends before it starts`);
    if (prev && from < prev.to) warn(s, "clock-order", `clock ${label} starts before the previous slide's ${prev.label} ends`);
    prev = { to: Math.max(from, to), label };
  }

  // ponytail: "20 s", "20-second", "20 seconds", "20s" all count. Another cap length in words is missed; add it here if decks use one.
  const CAP = /\b20[\s-]?(?:s|secs?|seconds?)\b/i;
  for (const s of slides.filter(s => s.hasAttribute("data-live"))) {
    if (!CAP.test(notesText(s))) warn(s, "live-cap", "no 20-second cap in the notes (write “20 s” or “20 seconds”)");
    // A drawn terminal or mock-up of the run stands in for the screenshot, as in the cli-run pattern.
    if (!s.querySelector("img, picture, video[poster], .cli, .mock, .threads")) warn(s, "live-cap", "no screenshot on the slide (an img, picture, video poster, .cli, .mock or .threads)");
  }

  for (const s of slides) for (const t of s.querySelectorAll(".title")) {
    const n = t.querySelectorAll("em").length;
    if (n > 1) warn(s, "one-em", `the title has ${n} <em>; keep one, on the payoff`);
  }

  // Visible text only: attributes, notes and code-like elements may need straight quotes.
  const CODE = "aside.notes, code, pre, kbd, samp, script, style, template, .cli, .code, .diff, .log";
  for (const s of slides) {
    const bad = new Set();
    const walk = doc.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      if (!/['"]/.test(n.data) || n.parentElement.closest(CODE)) continue;
      for (const m of n.data.matchAll(/\S*['"]\S*/g)) bad.add(m[0]);
    }
    if (bad.size) warn(s, "curly-quotes", `straight quotes in slide text: ${[...bad].slice(0, 3).join(" ")}${bad.size > 3 ? ` (+${bad.size - 3})` : ""}`);
  }

  // ponytail: a short list on purpose. Reserved example domains (example.com, .test, .invalid) are not flagged,
  // and neither is loopback (localhost, 127.x): it names the viewer's own machine, so it reveals nothing.
  const PRIVATE = [
    ["an email", /[\w.+-]+@(?!example\.(?:com|org|net)\b)[\w-]+(?:\.[\w-]+)*\.(?!test\b|invalid\b|example\b)[a-z]{2,}\b/gi],
    ["a private host or address", /\b10\.\d+\.\d+\.\d+\b|\b192\.168\.\d+\.\d+\b|\b172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+\b/gi],
    ["a URL with a token", /[?&#](?:token|access_token|api_?key|key|auth|code|sig|signature|session|sid|secret|password)=[^\s&"']+/gi],
    ["a key or token", /\b(?:sk|pk|rk)-[\w-]{16,}|\bgh[pousr]_\w{20,}|\bxox[abprs]-[\w-]{10,}|\bAKIA[0-9A-Z]{16}\b/g],
    ["a long ID", /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b(?=[a-z]*\d)[0-9a-f]{24,}\b/gi]
  ];
  for (const s of slides) {
    const notes = [...s.querySelectorAll("aside.notes")];
    const text = notes.map(n => n.textContent + " " + [...n.querySelectorAll("[href], [src]")].map(a => a.getAttribute("href") || a.getAttribute("src")).join(" ")).join(" ");
    for (const [what, re] of PRIVATE) {
      const hits = [...new Set(text.match(re) || [])];
      if (hits.length) warn(s, "private-data", `notes contain ${what}: ${hits.slice(0, 3).join(", ")}`);
    }
  }

  for (const s of slides) {
    const said = [...s.querySelectorAll("figcaption")].map(f => f.textContent).join(" ") + " " + notesText(s);
    const drawn = [...new Set([...s.querySelectorAll(DRAWN)].map(el => "." + DRAWN_CLASSES.find(c => el.classList.contains(c))))];
    if (drawn.length && !/\bdrawn\b|\billustrat/i.test(said)) warn(s, "drawn-disclosure", `${drawn.join(", ")} on the slide, but no caption or note says it is drawn`);
    const generated = [...s.querySelectorAll("b, strong")].some(b => /^\s*generated\b/i.test(b.textContent) && !b.closest("aside.notes"));
    if (generated && !/\bprompt\b/i.test(notesText(s))) warn(s, "drawn-disclosure", "a generated image, but the notes don't keep its prompt");
  }

  const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
  for (const s of slides) {
    const found = new Set();
    for (const el of [s, ...s.querySelectorAll("[style]")]) {
      if (el.closest(DRAWN) || el.closest("aside.notes")) continue;
      for (const m of (el.getAttribute("style") || "").match(COLOUR) || []) found.add(m);
    }
    if (found.size) warn(s, "fixed-colour", `fixed colours in inline styles: ${[...found].join(" ")}; use var(--a1) … var(--a6)`);
  }

  // A deck made before the tags has none, and the check below would pass it silently. The message
  // names no count, so tagging some slides doesn't read as a new warning against a lint baseline.
  const main = catalog ? [] : slides.filter(s => !s.hasAttribute("data-hidden"));
  if (main.length > 1 && main.some(s => !s.dataset.layout)) warn(null, "layout-variety", "some main slides have no data-layout, so their layouts aren't compared; npm run layouts -- <deck> --write tags them");
  let last = null;
  for (const s of main) {
    const layout = s.dataset.layout;
    if (layout && last?.dataset.layout === layout) warn(s, "layout-variety", `same layout as #${last.id} before it (${layout}); vary neighbouring slides`);
    last = s;
  }
  return out;
}

// Lints one deck's HTML. Pass a browser to reuse it (qa does); otherwise this launches its own.
export async function lint(html, { browser, catalog = false } = {}) {
  const own = !browser;
  const release = own ? await acquireResourceLock({ kind: "qa", slots: 1 }) : null;
  try {
    browser ||= await chromium.launch();
    const page = await browser.newPage();
    try { return await page.evaluate(check, [html, catalog]); }
    finally { await page.close(); }
  } finally {
    if (own) { await browser?.close(); await release?.(); }
  }
}

export function lintRecords(value) {
  if (!Array.isArray(value.lint)) throw new Error("Expected a saved lint report or QA receipt with lint coverage.");
  return value.lint;
}

export function compareLint(baseline, current, { slides = new Map(), checks = Object.keys(CHECKS) } = {}) {
  for (const check of checks) if (!CHECKS[check]) throw new Error(`Unknown lint check: ${check}`);
  for (const record of current) {
    const selected = checks.some(c => ["clock-order", "layout-variety"].includes(c)) ? record.slideIds : slides.get(record.index) ?? record.slideIds;
    const previous = baseline.find(b => b.index === record.index);
    if (!previous || selected.some(id => !previous.slideIds.includes(id))) throw new Error(`Lint baseline has no coverage for ${record.index}: ${selected.join(", ")}.`);
  }
  const key = w => JSON.stringify([w.slide, w.check, w.message]);
  return current.flatMap(record => {
    const selected = slides.get(record.index) ?? record.slideIds;
    const old = new Set(baseline.find(b => b.index === record.index).findings.map(key));
    return record.findings.filter(w => (w.slide === null || selected.includes(w.slide) || ["clock-order", "layout-variety"].includes(w.check)) && checks.includes(w.check) && !old.has(key(w))).map(w => ({ index: record.index, ...w }));
  });
}

const exists = path => access(path).then(() => true, () => false);

async function deckIndex(path) {
  const abs = resolve(path);
  if (abs.endsWith(".html")) return realpath(abs);
  for (const candidate of [join(abs, "index.html"), join(abs, "site/index.html")]) if (await exists(candidate)) return realpath(candidate);
  throw new Error(`No deck at ${path}: expected index.html or site/index.html.`);
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  try {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: {
    slides: { type: "string" }, baseline: { type: "string" }, checks: { type: "string" }, out: { type: "string" }
  } });
  let paths = [...positionals];
  if (!paths.length) {
    if (await exists(join(ROOT, "examples"))) {
      for (const dir of (await readdir(join(ROOT, "examples"))).sort()) if (await exists(join(ROOT, "examples", dir, "index.html"))) paths.push(join(ROOT, "examples", dir));
    } else paths = [ROOT];
  }
  const release = await acquireResourceLock({ kind: "qa", slots: 1 });
  let browser;
  try {
    browser = await chromium.launch();
    const decks = {}, warnings = [], records = [], selected = new Map();
    for (const p of paths) {
      const index = await deckIndex(p);
      const name = basename(dirname(index)) === "site" ? basename(dirname(dirname(index))) : basename(dirname(index));
      const html = await readFile(index, "utf8"), slideIds = slideSections(html).map(s => s.id);
      selected.set(index, selectSlides(slideIds, opt.slides));
      const found = await lint(html, { browser, catalog: basename(dirname(index)) === "catalog" });
      records.push({ index, slideIds, findings: found });
      decks[name] = found.length;
      warnings.push(...found.map(({ slide, check, message }) => ({ where: slide ? `${name} #${slide}` : name, check, message })));
    }
    const added = opt.baseline ? compareLint(lintRecords(JSON.parse(await readFile(resolve(opt.baseline), "utf8"))), records, { slides: selected, checks: opt.checks?.split(",") }) : [];
    const result = { schema: "talk-deck-lint/v1", decks, warnings, lint: records, newWarnings: added, advisory: !opt.baseline };
    if (opt.out) await atomicJSON(resolve(opt.out), result);
    console.log(JSON.stringify(result, null, 1));
    process.exitCode = added.length ? 1 : 0;
  } finally { await browser?.close(); await release(); }
  } catch (e) {
    console.log(JSON.stringify({ schema: "talk-deck-lint/v1", problems: [{ where: "lint", errors: [e.message] }], warnings: [] }));
    process.exitCode = 1;
  }
}

// Content lint: checks a deck's HTML against the authoring rules in AGENTS.md. Findings are warnings; they never fail QA.
// No imports from the rest of tools/, so a standalone deck can carry this file next to qa.mjs.
import { chromium } from "playwright";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const DRAWN_CLASSES = ["mock", "composer", "memo", "cli"];
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
    if (!s.querySelector("img, picture, video[poster], .cli, .mock")) warn(s, "live-cap", "no screenshot on the slide (an img, picture, video poster, .cli or .mock)");
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

  // ponytail: a short list on purpose. Reserved example domains (example.com, .test, .invalid) are not flagged.
  const PRIVATE = [
    ["an email", /[\w.+-]+@(?!example\.(?:com|org|net)\b)[\w-]+(?:\.[\w-]+)*\.(?!test\b|invalid\b|example\b)[a-z]{2,}\b/gi],
    ["a private host or address", /\blocalhost\b|\b127\.\d+\.\d+\.\d+\b|\b10\.\d+\.\d+\.\d+\b|\b192\.168\.\d+\.\d+\b|\b172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+\b/gi],
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

  let last = null;
  for (const s of catalog ? [] : slides.filter(s => !s.hasAttribute("data-hidden"))) {
    const layout = s.dataset.layout;
    if (layout && last?.dataset.layout === layout) warn(s, "layout-variety", `same layout as #${last.id} before it (${layout}); vary neighbouring slides`);
    last = s;
  }
  return out;
}

// Lints one deck's HTML. Pass a browser to reuse it (qa does); otherwise this launches its own.
export async function lint(html, { browser, catalog = false } = {}) {
  const own = !browser;
  browser ||= await chromium.launch();
  try {
    const page = await browser.newPage();
    const found = await page.evaluate(check, [html, catalog]);
    await page.close();
    return found;
  } finally {
    if (own) await browser.close();
  }
}

const exists = path => access(path).then(() => true, () => false);

async function deckIndex(path) {
  const abs = resolve(path);
  if (abs.endsWith(".html")) return abs;
  for (const candidate of [join(abs, "index.html"), join(abs, "site/index.html")]) if (await exists(candidate)) return candidate;
  throw new Error(`No deck at ${path}: expected index.html or site/index.html.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let paths = process.argv.slice(2);
  if (!paths.length) {
    if (await exists(join(ROOT, "examples"))) {
      for (const dir of (await readdir(join(ROOT, "examples"))).sort()) if (await exists(join(ROOT, "examples", dir, "index.html"))) paths.push(join(ROOT, "examples", dir));
    } else paths = [ROOT];
  }
  const browser = await chromium.launch();
  const decks = {}, warnings = [];
  for (const p of paths) {
    const index = await deckIndex(p);
    const name = basename(dirname(index)) === "site" ? basename(dirname(dirname(index))) : basename(dirname(index));
    const found = await lint(await readFile(index, "utf8"), { browser, catalog: basename(dirname(index)) === "catalog" });
    decks[name] = found.length;
    warnings.push(...found.map(({ slide, check, message }) => ({ where: slide ? `${name} #${slide}` : name, check, message })));
  }
  await browser.close();
  // Warnings only for now, so the exit code stays 0.
  console.log(JSON.stringify({ decks, warnings }, null, 1));
}

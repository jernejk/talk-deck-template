import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { REPO, copyAssets, deckHtml, esc, exists, fail, inside, libPrefix, patterns, routeTable, slideSections, templates, uniqueId, vendorLib, withId, writeTooling } from "./lib.mjs";

const USAGE = `Usage: npm run new -- <dir> --title "Big words.|Real demos.|*Honest fallbacks.*" [options]

  --template  Style from templates/ (default: community)
  --slides    Comma-separated slide patterns (default: the template's list; see npm run add -- --list)
  --title     Talk title. "|" starts a new cover line; *word* is the accent
  --event     Event line on the cover, e.g. "Codex Community Brisbane · Lightning talk"
  --date      Date line on the cover, e.g. "Tuesday 17 November 2026"
  --speaker   Your name on the cover and speaker slides
  --brand     Footer text (default: "<speaker> · <event>")
  --url       Where the slides will live (sets the QR code and CNAME)

Inside this repo (for example examples/my-talk) the deck links the shared library.
Anywhere else it gets a self-contained copy: site/ to publish, plus QA tooling.`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    template: { type: "string", default: "community" }, slides: { type: "string" },
    title: { type: "string" }, event: { type: "string" }, date: { type: "string" }, speaker: { type: "string" },
    brand: { type: "string" }, url: { type: "string" }, help: { type: "boolean", short: "h" }
  }
});
if (o.help || positionals.length !== 1 || !o.title) { console.log(USAGE); process.exit(o.help ? 0 : 1); }

const target = resolve(positionals[0]);
const inRepo = inside(target, REPO);
if (inRepo && !inside(target, join(REPO, "examples"))) fail("Inside this repo, decks go in examples/.");
if (await exists(target) && (await readdir(target)).length) fail(`${target} is not empty.`);

const list = await templates();
const template = list.find(t => t.id === o.template) || fail(`Unknown template "${o.template}". Pick one of: ${list.map(t => t.id).join(", ")}`);
const library = await patterns();
const names = o.slides ? o.slides.split(",").map(s => s.trim()).filter(Boolean) : template.slides.length ? template.slides : library.map(p => p.name);
const missing = names.filter(n => !library.some(p => p.name === n));
if (missing.length) fail(`Unknown slides: ${missing.join(", ")}. See npm run add -- --list.`);
const url = o.url ? new URL(o.url) : null;

const plain = o.title.replace(/\|/g, " ").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const coverTitle = o.title.split("|").map(part => {
  const t = part.trim();
  const whole = t.match(/^\*([^*]+)\*$/);
  if (whole) return `<em>${esc(whole[1])}</em>`;
  return `<span>${esc(t).replace(/\*([^*]+)\*/g, "<em>$1</em>")}</span>`;
}).join("");

const taken = new Set();
let slides = names.map(n => {
  const html = library.find(p => p.name === n).html;
  const id = slideSections(html)[0].id;
  const unique = uniqueId(id, taken);
  return unique === id ? html : withId(html, unique);
});
slides = slides.map(html => {
  const open = html.match(/^<section\b[^>]*>/)[0];
  let s = html.replace(/(<(h1|h2)\b[^>]*\sdata-fill="title"[^>]*>)[\s\S]*?(<\/\2>)/, (_, a, tag, b) => a + coverTitle + b);
  if (html.includes('data-fill="title"')) s = s.replace(/^(<section\b[^>]*?\sdata-title=")[^"]*/, (_, a) => a + esc(plain));
  if (o.speaker && /slide--(about|presenter)/.test(open) && html.includes('data-fill="speaker"')) s = s.replace(/^(<section\b[^>]*?\sdata-title=")[^"]*/, (_, a) => a + esc(o.speaker));
  for (const [key, value] of Object.entries({ event: o.event, speaker: o.speaker, date: o.date })) {
    if (value) s = s.replace(new RegExp(`(data-fill="${key}">)[^<]*`, "g"), (_, a) => a + esc(value));
  }
  if (url) {
    const shown = (url.host + url.pathname).replace(/\/$/, "");
    s = s.replace(/(<a class="close-qr" href=")[^"]*/, (_, a) => a + esc(url.href)).replace(/(<span class="qr-url">)[^<]*/, (_, a) => a + esc(shown));
  }
  return s;
});

const toClock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
let at = 0;
slides = slides.map(html => /^<section\b[^>]*\sdata-hidden\b/.test(html) ? html : html.replace(/(<aside class="notes">[\s\S]*?<b>)(\d+):(\d{2})–(\d+):(\d{2})(\.<\/b>)/, (_, a, m1, s1, m2, s2, b) => {
  const from = at;
  at += Math.max(0, m2 * 60 + +s2 - (m1 * 60 + +s1));
  return a + toClock(from) + "–" + toClock(at) + b;
}));

const deckDir = inRepo ? target : join(target, "site");
const html = deckHtml({
  title: plain,
  description: [plain, o.event].filter(Boolean).join(" · "),
  brand: o.brand ?? [o.speaker, o.event].filter(Boolean).join(" · "),
  template: template.id,
  lib: inRepo ? libPrefix(target) : "lib/",
  slides
});
await mkdir(deckDir, { recursive: true });
await writeFile(join(deckDir, "index.html"), html);
await copyAssets(html, deckDir);
if (url) await writeFile(join(deckDir, "CNAME"), url.host + "\n");

const route = routeTable(slides);
let guide = await readFile(join(REPO, "docs/presenter.md"), "utf8");
const fills = { title: plain, event: o.event, date: o.date, url: url?.href ?? "not published yet; the QR and `.qr-url` still point at example.com/slides.", route: route.route, extras: route.extras || "| None yet |  |", main: String(route.main), extraLine: route.extraCount === 1 ? "1 extra" : `${route.extraCount} extras` };
for (const [key, value] of Object.entries(fills)) if (value) guide = guide.replaceAll(`{{${key}}}`, () => value);
await writeFile(join(target, "PRESENTER.md"), guide);

if (!inRepo) {
  await vendorLib(deckDir);
  await writeTooling(target, basename(target));
}

if (url && html.includes("assets/qr-slides.png")) {
  const qr = join(deckDir, "assets/qr-slides.png");
  try {
    execFileSync("swift", [join(REPO, "tools/qr.swift"), url.href, qr], { stdio: "inherit" });
  } catch {
    await rm(qr, { force: true });
    console.error(`The QR code wasn't generated, so the sample one was removed. Make ${qr} for ${url.href} with any QR tool and scan it before the talk.`);
    process.exitCode = 1;
  }
}

console.log(`\nNew ${template.name} deck with ${slides.length} slides in ${target}
  open ${join(deckDir, "index.html")}
  ${inRepo ? "npm run build && npm run qa" : `cd ${target} && npm install && npm run qa`}`);

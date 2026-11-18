import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { attributes, htmlTags } from "./qa-scope.mjs";
import { copyAssets, coverTitleHtml, deckIndex, esc, fail, patterns, plainTitle, retime, routeTable, sectionsOf, slideSections, uniqueId, withId } from "./lib.mjs";

const USAGE = `Usage: npm run outline -- <deck> <outline.json> [--dry-run] [--force]

Builds a deck's slides from a JSON outline: one pattern per slide, with its id, title,
section and notes clock, then "duration" (and "agenda", if the deck uses one) in #deck-config.

  --dry-run  Print the plan and write nothing
  --force    Replace the slides the deck already has (a deck from npm run new has some)

Outline: { "title": "...", "duration": "15:00", "agenda": true,
           "slides": [{ "pattern": "cover", "title": "...", "id": "...", "section": "...", "minutes": 1.5 }] }
"pattern" and "title" are required for each slide. See docs/slides.md.`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: { "dry-run": { type: "boolean" }, force: { type: "boolean" }, help: { type: "boolean", short: "h" } }
});
if (o.help || positionals.length !== 2) { console.log(USAGE); process.exit(o.help ? 0 : 1); }

const [deckPath, outlinePath] = positionals;
let outline;
try { outline = JSON.parse(await readFile(outlinePath, "utf8")); } catch (e) { fail(`Can't read ${outlinePath}: ${e.message}`); }

const library = await patterns();
const errors = [];
const isClock = v => typeof v === "string" && /^\d+:\d{2}$/.test(v);
if (!Array.isArray(outline.slides) || !outline.slides.length) errors.push(`"slides" must be a list with at least one slide.`);
if (outline.title !== undefined && (typeof outline.title !== "string" || !outline.title.trim())) errors.push(`"title" must be text.`);
if (outline.duration !== undefined && !isClock(outline.duration)) errors.push(`"duration" must look like "15:00".`);
(outline.slides || []).forEach((s, i) => {
  s ??= {};
  const at = `Slide ${i + 1}`;
  if (!library.some(p => p.name === s.pattern)) errors.push(`${at}: no pattern called "${s.pattern}". See npm run add -- --list.`);
  if (typeof s.title !== "string" || !s.title.trim()) errors.push(`${at}: "title" is required.`);
  if (s.id !== undefined && !/^[A-Za-z][\w-]*$/.test(s.id)) errors.push(`${at}: "id" must start with a letter and use only letters, digits, - and _.`);
  if (s.section !== undefined && (typeof s.section !== "string" || !s.section.trim())) errors.push(`${at}: "section" must be text.`);
  if (s.minutes !== undefined && !(typeof s.minutes === "number" && s.minutes > 0)) errors.push(`${at}: "minutes" must be a number above 0.`);
});
if (errors.length) fail(`${outlinePath}:\n  ${errors.join("\n  ")}`);

const index = await deckIndex(deckPath);
let html = await readFile(index, "utf8");
// Identify the owned region before planning any writes. A second deck or an
// unmatched main makes the replacement unsafe.
let openMain, boundary;
const configs = [], titles = [];
for (const tag of htmlTags(html)) {
  if (tag.name === "main") {
    if (!tag.closing) {
      if (openMain) fail(index + " has nested <main> elements.");
      openMain = tag;
    } else {
      if (!openMain) fail(index + " has an unmatched </main>.");
      if (attributes(openMain.tag).get("id") === "deck") {
        if (boundary) fail(index + ' has more than one <main id="deck">.');
        boundary = { start: openMain.end, end: tag.start };
      }
      openMain = null;
    }
  }
  if (!tag.closing && tag.name === "script" && attributes(tag.tag).get("id") === "deck-config") configs.push(tag);
  if (!tag.closing && tag.name === "title") titles.push(tag);
}
if (openMain || !boundary) fail(index + ' needs a matching <main id="deck">…</main>.');
if (configs.length > 1 || configs.some(tag => tag.start >= boundary.start && tag.start < boundary.end)) {
  fail(index + " has ambiguous #deck-config markup.");
}
const configTag = configs[0];
const config = configTag ? JSON.parse(html.slice(configTag.end, configTag.contentEnd)) : {};
const existing = slideSections(html);

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeSection = name => name?.replace(/&(amp|lt|gt|quot|apos);/g, (_, key) => entities[key]);
const taken = new Set();
const isExtra = s => /^<section\b[^>]*\sdata-hidden\b/.test(s);
const plan = outline.slides.map(s => {
  const pattern = library.find(p => p.name === s.pattern);
  const frame = slideSections(pattern.html)[0];
  const baseId = s.id ?? frame.id;
  const section = s.section ?? decodeSection(attributes(frame.tag).get("data-section"));
  const id = uniqueId(baseId, taken);
  let slide = withId(pattern.html, id).replace(/^(<section\b[^>]*?\sdata-title=")[^"]*/, (_, a) => a + esc(plainTitle(s.title)));
  if (s.section) {
    const open = slide.match(/^<section\b[^>]*>/)[0];
    const next = /\sdata-section="/.test(open) ? open.replace(/(\sdata-section=")[^"]*/, (_, a) => a + esc(s.section)) : open.replace(/>$/, ` data-section="${esc(s.section)}">`);
    slide = next + slide.slice(open.length);
  }
  // ponytail: the visible title is the first h1/h2 with class "title"; patterns without one (speaker, question) keep their copy.
  const heading = /(<(h1|h2)\b[^>]*\sclass="[^"]*\btitle\b[^"]*"[^>]*>)[\s\S]*?(<\/\2>)/;
  const shown = heading.test(slide);
  slide = slide.replace(heading, (_, a, tag, b) => a + (a.includes('data-fill="title"') ? coverTitleHtml(s.title) : esc(s.title.replace(/\|/g, " ")).replace(/\*([^*]+)\*/g, "<em>$1</em>")) + b);
  return { id, pattern, slide, shown, section, renamed: s.id && s.id !== id ? s.id : null, seconds: s.minutes === undefined ? undefined : Math.round(s.minutes * 60) };
});
let slides = retime(plan.map(p => p.slide), plan.map(p => p.seconds));
// Keep what npm run new filled in on the slides being replaced: event, speaker, date and the close slide's link.
for (const key of ['data-fill="event">', 'data-fill="speaker">', 'data-fill="date">', '<a class="close-qr" href="', '<span class="qr-url">']) {
  const at = html.indexOf(key);
  if (at < 0) continue;
  const value = html.slice(at + key.length).match(/^[^<"]*/)[0];
  slides = slides.map(s => s.split(key).map((part, i) => i ? value + part.replace(/^[^<"]*/, "") : part).join(key));
}
const clockOf = s => s.match(/<aside class="notes">[\s\S]*?<b>(\d+:\d{2})–(\d+:\d{2})\.<\/b>/)?.slice(1);

const warnings = [];
plan.forEach((p, i) => { if (p.seconds && isExtra(slides[i])) warnings.push(`#${p.id} is a presenter extra, so it has no clock and its "minutes" are ignored.`); });
for (const p of plan) if (p.renamed) warnings.push(`The id "${p.renamed}" is taken, so that slide is #${p.id}.`);
const main = plan.map((p, i) => ({ ...p, html: slides[i], n: i + 1 })).filter(p => !isExtra(p.html));
for (let i = 1; i < main.length; i++) {
  const [a, b] = [main[i - 1], main[i]];
  if (a.pattern.layout === b.pattern.layout) warnings.push(`Slides ${a.n} and ${b.n} (#${a.id}, #${b.id}) are both "${a.pattern.layout}". Neighbours read better in different layouts (docs/slides.md, Layouts).`);
}
const total = clockOf(main.at(-1)?.html ?? "")?.[1] ?? "0:00";
const duration = outline.duration ?? total;
const secs = c => +c.split(":")[0] * 60 + +c.split(":")[1];
if (secs(total) > secs(duration)) warnings.push(`The clocks run to ${total}, past the duration of ${duration}.`);

config.title = outline.title ? plainTitle(outline.title) : config.title;
config.duration = duration;
config.sections = { ...sectionsOf(slides), ...config.sections };
if (outline.agenda === true || Array.isArray(config.agenda)) {
  // Same parts the agenda component would pick: each section in slide order, except Welcome and slot-0 sections.
  const parts = [];
  for (const p of main) {
    const { section } = p;
    if (!section || section === "Welcome" || config.sections[section] === 0 || parts.some(x => x.section === section)) continue;
    const old = (config.agenda || []).find(x => x.section === section);
    parts.push({ ...old, section, title: old?.title ?? section, time: clockOf(p.html)?.[0] ?? "" });
  }
  config.agenda = parts;
}

if (existing.length && !o.force && !o["dry-run"]) fail(`${index} already has ${existing.length} slides. Pass --force to replace them with the outline, or --dry-run to see the plan.`);

console.log(`${o["dry-run"] ? "Plan for" : "Writing"} ${index}:`);
plan.forEach((p, i) => {
  const clock = clockOf(slides[i])?.join("–") ?? "extra";
  console.log(`  ${String(i + 1).padStart(2)}  ${clock.padEnd(11)} ${p.pattern.name.padEnd(16)} ${(p.pattern.layout ?? "").padEnd(10)} #${p.id}${p.shown ? "" : "  (no title element: data-title only)"}`);
});
console.log(`  duration ${duration}${config.agenda ? `, agenda: ${config.agenda.map(x => `${x.title} ${x.time}`).join(", ")}` : ""}`);
for (const w of warnings) console.warn(`Warning: ${w}`);

if (o["dry-run"]) {
  if (existing.length) console.log(`The deck has ${existing.length} slides. A real run needs --force to replace them.`);
  process.exit(0);
}

const body = slides.filter(s => !isExtra(s));
const extras = slides.filter(isExtra);
const { start, end } = boundary;
const replacement = "\n\n" + body.join("\n\n") + "\n" +
  (extras.length ? "\n<!-- Presenter extras -->\n\n" + extras.join("\n\n") + "\n" : "");
const edits = [{ start, end, text: replacement }];
if (configTag) edits.push({ start: configTag.end, end: configTag.contentEnd, text: "\n" + JSON.stringify(config, null, 2).replace(/</g, "\\u003c") + "\n" });
const title = titles.find(t => t.end <= start);
if (outline.title && title) edits.push({ start: title.end, end: title.contentEnd, text: esc(config.title) });
for (const edit of edits.sort((a, b) => b.start - a.start)) {
  html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
}
await writeFile(index, html);
const copied = await copyAssets(slides.join("\n"), dirname(index));

const route = routeTable(slides);
console.log(`\nWrote ${slides.length} slides${copied.length ? `, with ${copied.join(", ")}` : ""}. Route table for PRESENTER.md:\n`);
console.log(`| # | Slide | Clock | Live or screenshot | Cue |\n|---|---|---|---|---|\n${route.route}`);
console.log(`\nEdit each slide's copy and notes, then run QA.`);

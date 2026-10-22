import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { copyAssets, deckIndex, fail, patterns, slideSections, uniqueId, withId } from "./lib.mjs";

const USAGE = `Usage: npm run add -- <deck> <slide> [--before <id> | --after <id>]
       npm run add -- --list

Copies a slide pattern from slides/ into a deck, with a unique id and the assets it needs.
By default it goes in front of the close slide, or at the end of the main slides.`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: { before: { type: "string" }, after: { type: "string" }, list: { type: "boolean" }, help: { type: "boolean", short: "h" } }
});

const library = await patterns();
if (o.list) {
  const width = Math.max(...library.map(p => p.name.length));
  for (const p of library) console.log(`${p.name.padEnd(width)}  ${p.summary}`);
  process.exit(0);
}
if (o.help || positionals.length !== 2) { console.log(USAGE); process.exit(o.help ? 0 : 1); }
if (o.before && o.after) fail("Use --before or --after, not both.");

const [deckPath, name] = positionals;
const pattern = library.find(p => p.name === name) || fail(`No slide called "${name}". See npm run add -- --list.`);
const index = await deckIndex(deckPath);
let html = await readFile(index, "utf8");

const existing = slideSections(html);
const baseId = slideSections(pattern.html)[0].id;
const id = uniqueId(baseId, new Set(existing.map(s => s.id)));
const slide = id === baseId ? pattern.html : withId(pattern.html, id);

const find = target => existing.find(s => s.id === target) || fail(`No slide with id "${target}" in ${index}.`);
const isExtra = /^<section[^>]*\sdata-hidden\b/i.test(slide);
let at;
if (o.before) at = find(o.before).start;
else if (o.after) at = find(o.after).end;
else {
  const close = existing.find(s => s.id === "close");
  const firstExtra = existing.find(s => s.hidden);
  const marker = html.indexOf("<!-- Presenter extras -->");
  const mainEnd = html.lastIndexOf("</main>");
  if (mainEnd < 0) fail(`${index} has no </main>.`);
  at = isExtra ? mainEnd : close ? close.start : marker >= 0 ? marker : firstExtra ? firstExtra.start : mainEnd;
}
html = `${html.slice(0, at).replace(/\s*$/, "\n\n")}${slide}\n\n${html.slice(at).replace(/^\s*/, "")}`;
await writeFile(index, html);
const copied = await copyAssets(slide, dirname(index));

console.log(`Added "${name}" as #${id} to ${index}${copied.length ? `, with ${copied.join(", ")}` : ""}.`);
console.log(`Edit its text and notes, then run QA. Its section is "${slide.match(/data-section="([^"]+)"/)?.[1] ?? "none"}".`);

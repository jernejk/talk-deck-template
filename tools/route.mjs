// Rewrite the route and extras tables in a deck's PRESENTER.md from its slides.
// usage: npm run route -- <deck> [--check]   (in a standalone deck the path is optional)
// Number, title and clock come from index.html, and so does the live column for live slides.
// Hand-written text (cues, "Use when", labels such as "Illustration") is kept, matched by slide ID where recorded, then title or row position.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { REPO, deckIndex, exists, fail, markdownRow, routeRows, slideSections } from "./lib.mjs";

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean" }, help: { type: "boolean", short: "h" } } });
// A standalone deck has no examples/, so the deck is the folder this tool lives in.
const standalone = !await exists(join(REPO, "examples"));
if (o.help || positionals.length > 1 || (!positionals.length && !standalone)) {
  console.log("Usage: npm run route -- <deck> [--check]\n\nRewrites the Talk route and Extras tables in PRESENTER.md. --check only reports whether they are stale.");
  process.exit(o.help ? 0 : 1);
}

const index = await deckIndex(positionals[0] ?? REPO);
const html = await readFile(index, "utf8");
const presenter = [join(dirname(index), "PRESENTER.md"), join(dirname(index), "../PRESENTER.md")];
const file = (await exists(presenter[0])) ? presenter[0] : (await exists(presenter[1])) ? presenter[1] : fail(`No PRESENTER.md next to ${index}.`);
const before = await readFile(file, "utf8");

const marker = / <!-- deck-slide:([^ ]+) -->\s*$/;
function tableRow(line, width, titleCol) {
  const cells = [""];
  const row = line.trim().slice(1);
  for (const part of row.matchAll(/\\\||\||[^|\\]+|\\/g)) {
    if (part[0] === "|") cells.push("");
    else cells[cells.length - 1] += part[0] === "\\|" ? "|" : part[0];
  }
  if (row.endsWith("|") && cells.at(-1) === "") cells.pop();
  if (width === 5 && cells.length === 4 && cells.every(cell => cell.trim())) cells.push("");
  if (cells.length !== width) fail(file + ": expected " + width + " columns, found " + cells.length + ". Use the standard columns and escape any literal pipes as \\|: " + line);
  const mark = marker.exec(cells[titleCol]);
  if (mark) cells[titleCol] = cells[titleCol].slice(0, mark.index);
  return { id: mark ? decodeURIComponent(mark[1]) : "", cells: cells.map(c => c.trim()) };
}

// The table whose header starts with head, with its Markdown body offsets.
function table(md, head, width, titleCol) {
  const at = md.search(new RegExp('^\\| ' + head + ' \\|.*\\n\\|[-| ]+\\|\\n', "m"));
  if (at < 0) return null;
  const start = md.indexOf("\n", md.indexOf("\n", at) + 1) + 1;
  let end = start;
  while (md.startsWith("|", end)) end = md.indexOf("\n", end) + 1 || md.length;
  return { start, end, rows: md.slice(start, end).split("\n").filter(Boolean).map(line => tableRow(line, width, titleCol)) };
}

const slides = slideSections(html).map(s => html.slice(s.start, s.end));
const fresh = routeRows(slides);
const allIds = [...fresh.main, ...fresh.extras].map(row => row.id).filter(Boolean);
if (new Set(allIds).size !== allIds.length) fail(file + ": duplicate slide IDs must be resolved before refreshing.");
const mainIds = new Set(fresh.main.map(row => row.id));
const extraIds = new Set(fresh.extras.map(row => row.id));
let md = before;
const migrations = [];

function match(old, rows, col) {
  const oldTitles = old.map(r => r.cells[col]);
  const titles = rows.map(r => r.cells[col]);
  const sameOrder = oldTitles.length === titles.length && oldTitles.every((t, i) => t === titles[i]);
  for (const title of new Set(oldTitles)) {
    const legacy = old.filter(row => !row.id && row.cells[col] === title);
    if (!sameOrder && legacy.length > 1) {
      fail(file + ': ambiguous legacy rows for "' + title + '". Align the existing rows with the slides before refreshing.');
    }
  }
  const used = new Set();
  const matches = rows.map(r => {
    if (!r.id) return undefined;
    const matches = old.filter(o => o.id === r.id);
    if (matches.length > 1 || (matches.length && rows.filter(row => row.id === r.id).length > 1)) {
      fail(file + ": ambiguous route ID " + r.id + ".");
    }
    const [row] = matches;
    if (row) used.add(row);
    return row;
  });
  const unmatched = title => titles.flatMap((t, i) => t === title && !matches[i] ? [i] : []);
  const orphans = old.filter(o => o.id && !used.has(o));
  const otherIds = col === 1 ? extraIds : mainIds;
  for (const row of orphans) if (otherIds.has(row.id)) {
    fail(file + ": slide #" + row.id + " moved between the route and Extras. Move its marked row to the matching table before refreshing.");
  }
  for (const title of new Set(orphans.map(o => o.cells[col]))) {
    const prior = orphans.filter(o => o.cells[col] === title);
    const slots = unmatched(title);
    const nextId = rows[slots[0]]?.id;
    const competingLegacy = old.some(o => !o.id && o.cells[col] === title);
    if (prior.length !== 1 || slots.length !== 1 || !nextId || rows.filter(r => r.id === nextId).length !== 1 || competingLegacy) {
      fail(file + ': ambiguous route ID for "' + title + '". Update the affected ID markers or remove retired rows before refreshing.');
    }
    matches[slots[0]] = prior[0];
    used.add(prior[0]);
  }
  for (const title of new Set(titles)) {
    const legacy = old.filter(o => !o.id && o.cells[col] === title);
    if (!legacy.length) continue;
    const slots = unmatched(title);
    if (!slots.length) continue;
    const repeated = oldTitles.filter(t => t === title).length > 1 || titles.filter(t => t === title).length > 1;
    const conflictingClock = col === 1 && repeated && legacy.some(row => row.cells[2] && rows.some(
      (candidate, i) => !matches[i] && !slots.includes(i) && candidate.cells[2] === row.cells[2]
    ));
    if (conflictingClock) fail(file + ': conflicting clock for legacy row "' + title + '". Add an explicit slide ID marker before refreshing.');
    if (legacy.length > 1 || slots.length > 1) {
      // An unchanged legacy table only supplies occurrence order. Detect visible
      // reorder signals before assigning IDs on the first refresh.
      const clockMoved = col === 1 && slots.some(i => {
        const clock = rows[i].cells[2];
        return clock && old[i]?.cells[2] !== clock && legacy.some(o => o.cells[2] === clock);
      });
      if (!sameOrder || legacy.length !== slots.length || clockMoved) {
        fail(file + ': ambiguous legacy rows for "' + title + '". Align the existing rows with the slides before refreshing.');
      }
    }
    slots.forEach((i, n) => {
      matches[i] = legacy[n];
      used.add(legacy[n]);
      if (titles.filter(t => t === title).length > 1 && rows[i].id) {
        const occurrence = oldTitles.slice(0, old.indexOf(legacy[n]) + 1).filter(t => t === title).length;
        const table = col === 1 ? "route" : "extra";
        migrations.push('Legacy ' + table + ' binding by order: ' + JSON.stringify(title) + ' occurrence ' + occurrence + ' → #' + rows[i].id);
      }
    });
  }
  // Retain the positional fallback for a renamed legacy slide.
  return rows.map((_, i) => matches[i] ?? (old[i] && !used.has(old[i]) && !old[i].id && !titles.includes(old[i].cells[col]) ? old[i] : null));
}

function refresh(prior, rows, col, fill) {
  const old = match(prior.rows, rows, col);
  return rows.map((row, i) => {
    const cells = fill([...row.cells], old[i]?.cells);
    if (row.id && (old[i]?.id || rows.some((other, j) => i !== j && other.cells[col] === cells[col]))) {
      cells[col] += " <!-- deck-slide:" + encodeURIComponent(row.id).replace(/-/g, "%2D") + " -->";
    }
    return markdownRow(cells);
  });
}

const extras = table(md, "Extra", 2, 0);
if (extras) {
  if (extras.rows.length === 1 && extras.rows[0].cells[0] === "None yet" && !extras.rows[0].cells[1]) extras.rows = [];
  const rows = refresh(extras, fresh.extras, 0, (cells, old) => [cells[0], old?.[1] ?? ""]);
  md = md.slice(0, extras.start) + (rows.join("\n") || "| None yet |  |") + "\n" + md.slice(extras.end);
}
const route = table(md, "#", 5, 1);
if (!route) fail(file + ' has no "| # | Slide | …" route table.');
const rows = refresh(route, fresh.main, 1, (cells, old) => {
  if (!cells[3].startsWith("**Live:**") && old?.[3] && !old[3].startsWith("**Live:**")) cells[3] = old[3];
  cells[4] = old?.[4] ?? "";
  return cells;
});
md = md.slice(0, route.start) + (rows.length ? rows.join("\n") + "\n" : "") + md.slice(route.end);
md = md.replace(/^\d+ main slides plus \d+ extras?\./m, fresh.main.length + " main slides plus " + fresh.extras.length + (fresh.extras.length === 1 ? " extra." : " extras."));

if (md === before) console.log(`${file} is up to date.`);
else if (o.check) fail(`${file} is stale: run npm run route${positionals.length ? ` -- ${positionals[0]}` : ""}`);
else {
  migrations.forEach(message => console.error(message));
  await writeFile(file, md);
  console.log(`Updated ${file}.`);
}

// Rewrite the route and extras tables in a deck's PRESENTER.md from its slides.
// usage: npm run route -- <deck> [--check]
// Number, title and clock come from index.html, and so does the live column for live slides.
// Hand-written text (cues, "Use when", labels such as "Illustration") is kept, matched by title, else by row position.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { deckIndex, exists, fail, routeTable, slideSections } from "./lib.mjs";

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { check: { type: "boolean" }, help: { type: "boolean", short: "h" } } });
if (o.help || positionals.length !== 1) {
  console.log("Usage: npm run route -- <deck> [--check]\n\nRewrites the Talk route and Extras tables in PRESENTER.md. --check only reports whether they are stale.");
  process.exit(o.help ? 0 : 1);
}

const index = await deckIndex(positionals[0]);
const html = await readFile(index, "utf8");
const presenter = [join(dirname(index), "PRESENTER.md"), join(dirname(index), "../PRESENTER.md")];
const file = (await exists(presenter[0])) ? presenter[0] : (await exists(presenter[1])) ? presenter[1] : fail(`No PRESENTER.md next to ${index}.`);
const before = await readFile(file, "utf8");

const cells = row => row.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
// The table whose header starts with `head`: its body rows, as [start, end] offsets plus parsed cells.
function table(md, head) {
  const at = md.search(new RegExp(`^\\| ${head} \\|.*\\n\\|[-| ]+\\|\\n`, "m"));
  if (at < 0) return null;
  const bodyStart = md.indexOf("\n", md.indexOf("\n", at) + 1) + 1;
  let end = bodyStart;
  while (md.startsWith("|", end)) end = md.indexOf("\n", end) + 1 || md.length;
  return { start: bodyStart, end, rows: md.slice(bodyStart, end).split("\n").filter(Boolean).map(cells) };
}

const slides = slideSections(html).map(s => html.slice(s.start, s.end));
const fresh = routeTable(slides);
let md = before;

// The old row for each fresh title: same title, else the row in the same position if its title is gone.
function match(old, titles, col) {
  const byTitle = new Map(old.map(r => [r[col], r]));
  const fresh = new Set(titles);
  return titles.map((t, i) => byTitle.get(t) ?? (old[i] && !fresh.has(old[i][col]) ? old[i] : []));
}

const extras = table(md, "Extra");
if (extras) {
  const names = fresh.extras ? fresh.extras.split("\n").map(r => cells(r)[0]) : [];
  const old = match(extras.rows, names, 0);
  const rows = names.length ? names.map((n, i) => `| ${n} | ${old[i][1] ?? ""} |`) : ["| None yet |  |"];
  md = md.slice(0, extras.start) + rows.join("\n") + "\n" + md.slice(extras.end);
}
const route = table(md, "#");
if (!route) fail(`${file} has no "| # | Slide | …" route table.`);
const freshRows = fresh.route.split("\n").map(cells);
const old = match(route.rows, freshRows.map(c => c[1]), 1);
const rows = freshRows.map((c, i) => {
  const live = c[3].startsWith("**Live:**") || !old[i][3] || old[i][3].startsWith("**Live:**") ? c[3] : old[i][3];
  return `| ${c[0]} | ${c[1]} | ${c[2]} | ${live} | ${old[i][4] ?? ""} |`;
});
md = md.slice(0, route.start) + rows.join("\n") + "\n" + md.slice(route.end);
md = md.replace(/^\d+ main slides plus \d+ extras?\./m, `${fresh.main} main slides plus ${fresh.extraCount === 1 ? "1 extra" : `${fresh.extraCount} extras`}.`);

if (md === before) console.log(`${file} is up to date.`);
else if (o.check) fail(`${file} is stale: run npm run route -- ${positionals[0]}`);
else { await writeFile(file, md); console.log(`Updated ${file}.`); }

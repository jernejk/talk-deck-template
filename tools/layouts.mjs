// npm run layouts: fill in missing layout tags. With no path it checks the library (slides/index.json
// and each pattern's data-layout), or in a standalone deck the deck; with deck paths it tags those decks. It prints what
// it would do; --write applies it. Guesses come from the components a slide uses, so read the table.
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { LAYOUTS, REPO, deckIndex, exists } from "./lib.mjs";
import { attributes, slideSections } from "./qa-scope.mjs";

// An opening <section> tag, reading past a ">" inside a quoted attribute such as data-title="a > b".
const OPEN = /^<section\b(?:[^>"']|"[^"]*"|'[^']*')*>/;
const opening = html => html.trim().match(OPEN)?.[0] ?? "";
const valid = layout => Object.hasOwn(LAYOUTS, layout);

// The library's own tags are the reference: every pattern in slides/ gets its tag back from this
// function (a test keeps it that way). A slide built from the same components gets the same shape.
export function guessLayout(html) {
  const body = html.replace(/<aside\b[^>]*class="notes"[^>]*>[\s\S]*?<\/aside>/g, "");
  const tag = opening(body);
  const cls = new Set([...body.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  const has = (...names) => names.some(n => cls.has(n));
  const pictures = (body.match(/<(img|video|iframe|picture)\b/g) || []).length;
  const beside = has("split", "agenda--side") || (/slide--(cover|about|presenter|close)\b/.test(tag) && !has("presenter-team"));
  if (/slide--bleed|cover--photo|presenter--banner/.test(tag)) return ["full-bleed", "a full-bleed section"];
  if (/cover--center/.test(tag)) return ["statement", "a centred cover"];
  if (/<table\b/.test(body) || has("rule", "compare", "matrix", "ledger")) return ["table", "a table"];
  if (has("timeline", "milestones")) return ["timeline", "a timeline or milestones"];
  if (has("strip", "iterations") || (has("cols") && has("shot")) || (!beside && (has("fan") || (body.match(/<figure\b[^>]*>\s*<img/g) || []).length >= 3))) return ["gallery", "a row of captioned images"];
  if (beside) {
    if (has("pillars", "cols")) return ["columns", "cards beside the text"];
    if (has("cli", "code", "diff", "composer", "memo", "threads", "qr", "close-qr", "agenda", "mascots", "quote", "fold", "bubbles")) return ["split", "text beside a drawn panel"];
    if (pictures || has("shot", "phone", "embed", "player", "video", "zoom", "about-portrait")) return ["media", "text beside a picture"];
    return ["split", "text beside a panel"];
  }
  if (has("flow", "pipe", "stages", "motion", "pipeline")) return ["flow", "stages joined by arrows"];
  if (has("findings", "log", "recipe", "agenda")) return ["list", "full-width rows"];
  if (has("cols", "pillars", "kpis", "stats", "counters", "cards", "agents", "pets", "versus", "presenter-team", "scores", "qmap", "poll", "schedule", "ladder")) return ["columns", "cards side by side"];
  if (pictures || has("shot", "phone", "embed", "player", "video")) return ["media", "one large picture"];
  return ["statement", "no panel, picture or cards"];
}

// Adds data-layout to a section's opening tag, after its id when it has one.
export function tagSection(sectionHtml, layout) {
  return sectionHtml.replace(OPEN, open => /\sid="[^"]*"/.test(open)
    ? open.replace(/(\sid="[^"]*")/, `$1 data-layout="${layout}"`)
    : open.replace(/^<section\b/, `<section data-layout="${layout}"`));
}

// Library: index.json and data-layout must agree. One side fills the other; neither means a guess.
export function planLibrary(index, htmlOf) {
  return index.map(p => {
    const html = htmlOf(p.name), inHtml = attributes(opening(html)).get("data-layout");
    const json = p.layout === undefined || p.layout === "" ? undefined : p.layout;
    if (json !== undefined && inHtml !== undefined) {
      const ok = json === inHtml && valid(json);
      return { name: p.name, layout: json, action: ok ? "ok" : "conflict", reason: ok ? "" : json === inHtml ? `"${json}" is not a layout` : `index.json says ${json}, data-layout says "${inHtml}"` };
    }
    // An empty data-layout="" is a tag someone meant to fill in, so it needs a decision, not a guess.
    const one = json ?? inHtml;
    if (one !== undefined) return { name: p.name, layout: one, action: valid(one) ? "copy" : "conflict", reason: valid(one) ? (json ? "copied from index.json" : "copied from data-layout") : `"${one}" is not a layout` };
    const [layout, reason] = guessLayout(html.trim());
    return { name: p.name, layout, action: "guess", reason };
  });
}

export function planDeck(html) {
  return slideSections(html).map(s => {
    const layout = attributes(opening(s.html)).get("data-layout");
    if (layout !== undefined) return { name: s.id, layout, action: valid(layout) ? "ok" : "conflict", reason: valid(layout) ? "" : `"${layout}" is not a layout`, start: s.start, end: s.end };
    const [guess, reason] = guessLayout(s.html);
    return { name: s.id, layout: guess, action: "guess", reason, start: s.start, end: s.end };
  });
}

export function applyDeck(html, plan) {
  let out = html;
  for (const row of [...plan].reverse()) if (row.action === "guess") out = out.slice(0, row.start) + tagSection(out.slice(row.start, row.end), row.layout) + out.slice(row.end);
  return out;
}

function print(where, plan) {
  const todo = plan.filter(r => r.action !== "ok");
  console.log(`${where}: ${plan.length - todo.length} of ${plan.length} tagged${todo.length ? "" : ", nothing to do"}.`);
  for (const r of todo) console.log(`  ${r.action.padEnd(8)} ${r.name.padEnd(24)} ${r.layout.padEnd(10)} ${r.reason}`);
  return todo;
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { write: { type: "boolean", default: false } } });
  let conflicts = 0, changes = 0;
  // A standalone deck has no slides/ library, so the deck is the folder this tool lives in.
  if (!positionals.length && !await exists(join(REPO, "slides/index.json"))) {
    if (!await exists(join(REPO, "site/index.html"))) { console.error("No slides/index.json or site/index.html here: pass a deck path."); process.exit(1); }
    positionals.push(REPO);
  }
  if (!positionals.length) {
    const indexPath = join(REPO, "slides/index.json"), index = JSON.parse(await readFile(indexPath, "utf8"));
    const htmls = new Map();
    for (const p of index) htmls.set(p.name, await readFile(join(REPO, "slides", `${p.name}.html`), "utf8"));
    const plan = planLibrary(index, name => htmls.get(name));
    const todo = print("slides/", plan);
    conflicts += todo.filter(r => r.action === "conflict").length;
    const fix = todo.filter(r => r.action !== "conflict");
    changes += fix.length;
    if (opt.write && fix.length) {
      for (const r of fix) {
        const p = index.find(p => p.name === r.name), html = htmls.get(r.name);
        if (!p.layout) { const { name, ...rest } = p; Object.keys(p).forEach(k => delete p[k]); Object.assign(p, { name, layout: r.layout, ...rest }); }
        if (!attributes(opening(html)).has("data-layout")) await writeFile(join(REPO, "slides", `${r.name}.html`), html.replace(/^(\s*)(<section\b[\s\S]*)$/, (_, lead, rest) => lead + tagSection(rest, r.layout)));
      }
      await writeFile(indexPath, JSON.stringify(index, null, 2) + "\n");
    }
  }
  for (const path of positionals) {
    const index = await deckIndex(path), html = await readFile(index, "utf8"), plan = planDeck(html);
    const todo = print(relative(process.cwd(), index) || index, plan);
    conflicts += todo.filter(r => r.action === "conflict").length;
    changes += todo.filter(r => r.action === "guess").length;
    if (opt.write && todo.some(r => r.action === "guess")) await writeFile(index, applyDeck(html, plan));
  }
  if (changes) console.log(opt.write ? `Wrote ${changes} tag(s). Check the guesses against docs/slides.md, then run npm run build.` : `Run again with --write to apply ${changes} tag(s).`);
  if (conflicts) { console.error(`${conflicts} tag(s) need a decision by hand: pick one of ${Object.keys(LAYOUTS).join(", ")}.`); process.exitCode = 1; }
}

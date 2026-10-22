import { chromium } from "playwright";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { REPO, esc, exists, fail } from "./lib.mjs";

const OUT = join(REPO, "docs/showcase");
const HERO = join(REPO, "docs/hero/index.html");
const WIDTH = 2000;

const COLOURWAYS = {
  amber: { name: "Amber", base: "terminal", about: "an amber phosphor screen", css: `:root{
  --bg:#0b0700;--panel:#150d02;--panel-2:#211506;--ink:#ffe3b3;--muted:#c49c62;--rule:#3d2a10;
  --a0:#a88454;--a1:#ffb000;--a2:#ffd36b;--a3:#ff8a3d;--a4:#ffc94d;--a5:#f5a25d;--a6:#ffe9a8;
  --m1:#ffb000;--m2:#ffd36b;--m3:#ff8a3d;--m4:#ffc94d;--m5:#f5a25d;
  --ok:#ffd36b;--signal:#ff8a3d;--on-accent:#150d00;--sticker:#ffb000;--on-sticker:#150d00;
  --shot-border:#4d3713;--dots:rgba(255,176,0,.13);--ghost-ink:rgba(255,176,0,.07);
  --ui-bg:#070400;--ui-ink:#ffe3b3;--ui-muted:#a88454;--ui-border:#4d3713;--ui-chip:#2a1b06;--ui-chip-ink:#ffb000;--ui-send:#ffb000;
  --cli-bg:#070400;--cli-ink:#ffe3b3;--cli-muted:#a88454;--cli-border:#4d3713;
  --code-bg:#070400;--code-ink:#ffe3b3;--code-muted:#a88454;--code-border:#4d3713;
}` },
  berry: { name: "Berry", base: "keynote", about: "a rose-tinted stage with berry accents", css: `:root{
  --bg:#fbf1f4;--panel-2:#f3e3ea;--rule:#e8d2dc;
  --a1:#b0165e;--a2:#6d2bb5;--a3:#c2410c;--a4:#0f7a5c;--a5:#a1123a;--a6:#93590a;
  --m1:#b0165e;--m2:#6d2bb5;--m3:#c2410c;--m4:#0f7a5c;--m5:#a1123a;
  --ok:#0f7a5c;--signal:#b0165e;--sticker:#b0165e;
}` },
  sunset: { name: "Sunset", base: "aurora", about: "plum and apricot light instead of the polar aurora", css: `:root{
  --bg:#1a0b1f;--panel:#2a1230;--panel-2:#3a1a40;--muted:#dcbcd2;
  --a0:#c9a7bd;--a1:#ffb36b;--a2:#ff6f91;--a3:#c38cff;--a4:#ffd86b;--a5:#ff8a5c;--a6:#ffe3b0;
  --m1:#ffb36b;--m2:#ff6f91;--m3:#c38cff;--m4:#ffd86b;--m5:#ff8a5c;
  --ok:#ffd86b;--signal:#ff6f91;--on-accent:#1a0b1f;--sticker:#ffb36b;--on-sticker:#1a0b1f;
  --ui-bg:rgba(42,14,46,.62);--ui-muted:#dcbcd2;--ui-chip:rgba(255,179,107,.16);--ui-chip-ink:#ffb36b;--ui-send:#ffb36b;
  --cli-bg:rgba(30,10,34,.62);--cli-muted:#dcbcd2;--cli-bad:#ff6f91;
  --code-bg:rgba(30,10,34,.62);--code-muted:#dcbcd2;--code-k:#ffb36b;--code-s:#ffd86b;--code-f:#c38cff;--code-n:#ff8a5c;
}
html,body{background:linear-gradient(150deg,#12061a 0%,#1a0b1f 45%,#3d1438 100%) fixed}` },
  sage: { name: "Sage", base: "paper", about: "green-grey stock with forest and terracotta ink", css: `:root{
  --bg:#e7eadf;--panel:#f4f5ee;--panel-2:#dce1d1;--ink:#1a1f17;--muted:#56604e;--rule:#c5ccb7;
  --a0:#5b6454;--a1:#2f6b3a;--a2:#a4482a;--a3:#3d5a8a;--a4:#76570f;--a5:#7b3b6b;--a6:#66650c;
  --m1:#3f7d4a;--m2:#c0583a;--m3:#3d5a8a;--m4:#d4a332;--m5:#7b3b6b;
  --ok:#2f6b3a;--signal:#a4482a;--sticker:#d7e3b5;--on-sticker:#1a1f17;
  --dots:rgba(26,31,23,.16);--ghost-ink:rgba(26,31,23,.07);
}` },
  chalk: { name: "Chalkboard", base: "blueprint", about: "a green board with chalk colours", css: `:root{
  --bg:#1f3a30;--panel:#1a3229;--panel-2:#26473b;--ink:#f4f1e8;--muted:#c3cbbd;--rule:rgba(255,255,255,.34);
  --a0:#c3cbbd;--a1:#ffe066;--a2:#9fd8ff;--a3:#fff;--a4:#b8f2a0;--a5:#ffb3a7;--a6:#fff3a8;
  --ok:#b8f2a0;--signal:#ffe066;--on-accent:#1f3a30;--sticker:#ffb3a7;--on-sticker:#1f3a30;
  --ui-bg:#1a3229;--ui-muted:#c3cbbd;--ui-send:#ffe066;
  --cli-bg:#1a3229;--cli-muted:#c3cbbd;--cli-bad:#ffb3a7;
  --code-bg:#1a3229;--code-muted:#c3cbbd;--code-k:#ffe066;--code-s:#b8f2a0;--code-f:#9fd8ff;--code-n:#ffb3a7;
  --grid-minor:rgba(255,255,255,.04);--grid-major:rgba(255,255,255,.09);
}` },
  brand: { name: "Brand", base: "community", about: "the five-line tweak from docs/styles.md: one brand colour and font, no mascots", css: `:root{
  --a1:#2b88d8;--m1:#2b88d8;--signal:#2b88d8;--sticker:#2b88d8;--on-sticker:#fff;
  --sans:"Avenir Next",system-ui,sans-serif;
}
.mascot,.ghost{display:none}` }
};

const TALKS = [
  { label: "Lightning talk", deck: "codex-lightning", theme: "community-codex", slides: ["cover", "prompt", "cli-run", "numbers", "takeaways"] },
  { label: "Conference talk", deck: "aurora-conference", theme: "aurora", slides: ["cover", "agenda", "cli-run", "how-its-made", "takeaways"] },
  { label: "Product launch", deck: "keynote-launch", theme: "keynote", slides: ["cover", "photo", "numbers", "quote", "options"] },
  { label: "Architecture deep dive", deck: "blueprint-architecture", theme: "blueprint", slides: ["cover", "agenda", "rule", "code", "long-page"] },
  { label: "Workshop", deck: "workshop", theme: "paper", slides: ["cover-split", "speaker-card", "agenda-list", "pipeline", "follow-up"] },
  { label: "Meetup talk", deck: "starter", theme: "terminal", slides: ["cover", "opener", "before-after", "transcript", "close"] }
];

const SHEETS = [
  { id: "hero", title: "What you can build", about: "Nine slides from the library, in six templates and three colourways.",
    tiles: ["cover community-codex", "speaker-card keynote+berry", "cli-run terminal", "cover-split paper", { at: "agents blueprint", steps: 2 }, "try-it keynote", "at-a-glance aurora", "takeaways paper+sage", "close terminal+amber"] },
  { id: "talks", title: "Six talks, six looks", about: "Each row is an example deck from `examples/`. The meetup row is the starter deck shown in the terminal template.",
    rows: TALKS.map(t => ({ label: t.label, meta: `${t.deck} in ${t.theme}`, at: t.slides.map(s => `${t.deck}/${s} ${t.theme}`) })) },
  { id: "openings", title: "Covers and titles", about: "Five cover layouts, plus the title shapes any slide can use: a kicker, a big numeral and stacked lines.",
    tiles: ["cover community-codex", "cover-image keynote", "cover-photo aurora", "cover-center terminal", "cover-split blueprint", "title-styles paper"] },
  { id: "presenter", title: "About the presenter", about: "A portrait with links, a card with an award badge and a current-focus project, a banner, fact bubbles, and a slide for co-presenters.",
    tiles: ["speaker-card keynote", "speaker community", "speaker-banner paper", "speaker-facts aurora", "speakers blueprint"] },
  { id: "agendas", title: "Agendas and chapters", about: "Agenda slides fill themselves in from the deck config and light the current part; footers carry a dot per part. Chapter slides open each part, optionally with the agenda beside them.",
    tiles: ["agenda-list paper", "agenda aurora", "agenda-schedule keynote", "chapter blueprint", { at: "workshop/chapter-agenda-2 community", pattern: "chapter-agenda" }] },
  { id: "hooks", title: "Hooks", about: "Open on one line, a real input, a full-bleed photo, the question the demo answers, or the pet that will be with you all talk.",
    tiles: ["statement paper", "opener community", "photo aurora", "question keynote", "pets community-codex"] },
  { id: "demos", title: "Demos", about: "A drawn terminal run, a prompt that types itself, a live-demo map, before and after, a screenshot that zooms on Space, a weak prompt beside a useful one, a looping clip and a QR to the repo.",
    tiles: ["cli-run terminal", "prompt keynote", "demo-map aurora", "before-after community", "zoom paper", "versus paper", "video blueprint", "get-the-code keynote"] },
  { id: "live", title: "Live and interactive", about: "A real HTML page you can click during the talk; a screenshot that goes live on L, fills the slide and counts down its 20 seconds; a clip with sound and controls; a YouTube video that loads nothing until you press play; and a workshop timer.",
    tiles: ["try-it keynote", "live-demo aurora", { at: "live-demo community", keys: "l", clock: 8, note: "after L" }, "player paper", "youtube blueprint", { at: "exercise terminal", click: '[data-timer="toggle"]', clock: 74, note: "running" }] },
  { id: "how-it-works", title: "How it works", about: "Stages with a you-are-here marker, agents whose pets change with their state, steps beside the screens, the one line of code that matters, a diff with its context folded, long output folded away, a long page that scrolls itself, a transcript and a table of rules.",
    tiles: ["pipeline blueprint", { at: "agents community-codex", steps: 2, note: "mid-run" }, "how-its-made community", "code terminal", "diff keynote", "fold terminal", "long-page keynote", "transcript aurora", "rule paper"] },
  { id: "evidence", title: "Evidence", about: "Headline numbers, review findings by severity, a feature matrix, an event log with the bad row lit, a room poll, milestones, a phone beside the numbers, quotes, a photo strip and iterations.",
    tiles: ["at-a-glance aurora", "findings terminal", "matrix keynote", "log-trace paper", "poll community", "milestones blueprint", "numbers keynote", "quote aurora", "photo-strip community", "iterations paper"] },
  { id: "wrap-ups", title: "Summaries and wrap-ups", about: "Takeaways and options to close the argument, then questions, follow-up links and the close with its QR.",
    tiles: ["takeaways community", "options keynote", "questions paper", "follow-up aurora", "close community-codex"] },
  { id: "extras", title: "Presenter extras", about: "Hidden until someone asks (H shows them, or pick one from O): a build log, a comparison, a ladder, honest limits and the cost.",
    tiles: ["x-timeline paper", "x-compare keynote", "x-ladder aurora", "x-limits terminal", "x-cost blueprint"] },
  { id: "pets", title: "Pets and agents", about: "Every template brings a pet with four poses: a drawn robot unless the template swaps it. Agent cards use it as each agent's avatar, its pose following the agent's state as you step through.",
    tiles: ["pets community-codex", "pets community", "pets terminal", { at: "agents community-codex", steps: 1, note: "step 1" }, { at: "agents paper", steps: 2, note: "step 2" }, "agents aurora"] },
  { id: "colourways", title: "Colourways", about: "Each row is one template recoloured by a short stylesheet of tokens, the first level in `docs/styles.md`. To use one, save its CSS below as `templates/<name>/theme.css` next to a `template.json`; the `@import` brings in the base.",
    rows: Object.entries(COLOURWAYS).map(([id, c]) => ({ label: c.name, meta: `${c.base} · ${c.about}`, at: ["cover", "agenda", "cli-run", "takeaways"].map(s => `${s} ${c.base}+${id}`) })) },
  { id: "presenting", title: "Presenting", about: "The controls every deck gets: an overview of every slide, speaker notes that open with the clock, a rehearsal timer that checks your pace against those clocks, and the gallery of every example and template.",
    tiles: [
      { at: "workshop/agenda-list paper", keys: "o", label: "O · overview" },
      { at: "aurora-conference/cli-run aurora", keys: "n", label: "N · speaker notes" },
      { at: "workshop/cli-run paper", rehearse: [150, 25], label: "T · rehearsal timer" },
      { page: "examples/index.html", label: "examples/index.html · the gallery" }
    ] },
  { id: "templates", title: "Seven templates", about: "The same cover in every template. `?theme=<name>` on any deck's URL previews another one.",
    layout: [3, 4], tiles: ["cover community", "cover community-codex", "cover paper", "cover terminal", "cover keynote", "cover aurora", "cover blueprint"] }
];

const LAYOUT = { 4: [2, 2], 5: [2, 3], 7: [3, 4], 8: [4, 4], 10: [3, 3, 4] };

function layoutOf(sheet) {
  const n = sheet.tiles.length;
  const counts = sheet.layout || LAYOUT[n] || Array.from({ length: Math.ceil(n / 3) }, (_, i) => Math.min(3, n - 3 * i));
  const placed = counts.reduce((a, b) => a + b, 0);
  if (placed !== n) fail(`The "${sheet.id}" layout places ${placed} of its ${n} tiles.`);
  return counts;
}

function tile(spec) {
  const o = typeof spec === "string" ? { at: spec } : spec;
  if (o.page) return { ...o, key: o.page, caption: o.label };
  const [where, look] = o.at.split(" ");
  const [deck, slide] = where.includes("/") ? where.split("/") : ["catalog", where];
  const [theme, colourway] = look.split("+");
  if (colourway && !COLOURWAYS[colourway]) fail(`Unknown colourway "${colourway}" in "${o.at}".`);
  const pattern = o.pattern || slide;
  const shown = colourway ? COLOURWAYS[colourway].name : theme;
  return { ...o, deck, slide, pattern, theme, colourway, shown, key: [o.at, o.keys, o.rehearse, o.steps, o.click, o.clock].join("|"), caption: o.label || `<b>${esc(pattern)}</b> · ${esc(shown)}${o.note ? ` · ${esc(o.note)}` : ""}` };
}

const rowsOf = sheet => sheet.rows
  ? sheet.rows.map(r => ({ ...r, tiles: r.at.map(tile).map(t => ({ ...t, caption: `<b>${esc(t.pattern)}</b>` })) }))
  : layoutOf(sheet).reduce((out, n, i, all) => {
    const from = all.slice(0, i).reduce((a, b) => a + b, 0);
    return [...out, { tiles: sheet.tiles.slice(from, from + n).map(tile) }];
  }, []);

async function shoot(browser, t, file) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", r => errors.push(`failed: ${r.url()}`));
  if (t.rehearse || t.clock) await page.clock.install();
  if (t.page) {
    await page.goto(pathToFileURL(join(REPO, t.page)).href, { waitUntil: "load" });
    await page.waitForTimeout(2500);
  } else {
    const index = join(REPO, "examples", t.deck, "index.html");
    if (!await exists(index)) throw new Error(`No deck at examples/${t.deck}.`);
    await page.goto(`${pathToFileURL(index).href}?theme=${t.theme}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.Deck && Deck.current());
    if (t.colourway) await page.addStyleTag({ content: COLOURWAYS[t.colourway].css });
    if (t.rehearse) {
      await page.keyboard.press("t");
      await page.clock.fastForward(t.rehearse[0] * 1000);
    }
    const found = await page.evaluate(([id, stepMode]) => {
      const slide = document.getElementById(id);
      if (!slide?.matches("section.slide")) return false;
      Deck.goTo(slide, { stepMode });
      return true;
    }, [t.slide, t.steps === undefined ? "end" : "start"]);
    if (!found) throw new Error(`No slide #${t.slide} in examples/${t.deck}.`);
    if (t.rehearse) {
      await page.clock.fastForward(t.rehearse[1] * 1000);
      await page.clock.runFor(500);
    }
    for (let i = 0; i < (t.steps || 0); i++) await page.keyboard.press("ArrowRight");
    if (t.click) await page.click(`#${t.slide} ${t.click}`);
    for (const k of t.keys || "") await page.keyboard.press(k);
    if (t.clock) {
      await page.clock.fastForward(t.clock * 1000);
      await page.clock.runFor(500);
    }
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: file });
  await page.close();
  if (errors.length) throw new Error(`${t.key}:\n  ${errors.join("\n  ")}`);
}

function sheetHtml(rows) {
  const figure = t => `<figure><img src="${t.file}" alt=""><figcaption>${t.caption}</figcaption></figure>`;
  const body = rows.map(r => `${r.label ? `<h2>${esc(r.label)}${r.meta ? ` <span>${esc(r.meta)}</span>` : ""}</h2>` : ""}<div class="row" style="grid-template-columns:repeat(${r.tiles.length},1fr)">${r.tiles.map(figure).join("")}</div>`).join("\n");
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:30px 30px 8px;background:#111113;color:#ececef;font:500 18px/1.25 -apple-system,"Helvetica Neue",Arial,sans-serif}
h2{margin:6px 0 12px;font-size:21px;font-weight:600}
h2 span{margin-left:8px;color:#9a9aa2;font-weight:500}
.row{display:grid;gap:22px;margin-bottom:24px}
figure{margin:0}
img{display:block;width:100%;border-radius:8px;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
figcaption{margin-top:10px;color:#9a9aa2}
figcaption b{color:#ececef;font-weight:600}
</style>
${body}`;
}

function readme() {
  const name = t => t.page ? `\`${t.page}\`` : t.label ? `${t.label} (\`${t.deck}\`, ${t.theme})` : `\`${t.pattern}\` (${t.shown}${t.note ? `, ${t.note}` : ""}${t.deck === "catalog" ? "" : `, from \`${t.deck}\``})`;
  const patternsOf = r => r.tiles.map(t => `\`${t.pattern}\``).join(", ");
  const list = s => {
    const rows = rowsOf(s);
    if (!s.rows) return rows.flatMap(r => r.tiles).map(name).join(", ");
    const same = rows.every(r => patternsOf(r) === patternsOf(rows[0]));
    return (same ? `Each row: ${patternsOf(rows[0])}.\n\n` : "") + rows.map(r => `**${r.label}** (${r.meta})${same ? "" : `: ${patternsOf(r)}`}`).join("  \n");
  };
  const css = Object.values(COLOURWAYS).map(c => `<details><summary>${c.name}, on ${c.base}</summary>\n\n\`\`\`css\n@import url("../${c.base}/theme.css");\n${c.css}\n\`\`\`\n\n</details>`).join("\n");
  const sections = SHEETS.map(s => `## ${s.title}\n\n${s.about}\n\n![${s.title}](${s.id}.jpg)\n\n${list(s)}${s.id === "colourways" ? `\n\n${css}` : ""}`);
  return `# Showcase

<!-- Generated by npm run showcase from tools/showcase.mjs. Edit the sheets there, then run it again. -->

Every picture is rendered from this repo at 1920×1080: real slides with every step shown, plus the controls and the gallery under Presenting. Captions read pattern · template. Add a pattern to a deck with \`npm run add -- <deck> <pattern>\`, start a deck in a template with \`npm run new -- <dir> --template <name>\`, and preview any deck in another template with \`?theme=<name>\`.

${sections.join("\n\n")}
`;
}

// The hero's slides are live iframes of the example decks, so wait for each to open its slide.
async function renderHero(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 500 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await page.goto(pathToFileURL(HERO).href, { waitUntil: "load" });
  for (const f of page.frames().filter(f => f !== page.mainFrame())) await f.waitForSelector(".slide.is-active", { timeout: 15000 });
  for (const f of page.frames()) await f.addStyleTag({ content: ".deck-nav{display:none!important}" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(REPO, "docs/hero.jpg"), type: "jpeg", quality: 88 });
  await page.close();
}

const { positionals } = parseArgs({ allowPositionals: true });
const unknown = positionals.filter(id => id !== "readme" && !SHEETS.some(s => s.id === id));
if (unknown.length) fail(`Unknown sheets: ${unknown.join(", ")}. Pick from: readme, ${SHEETS.map(s => s.id).join(", ")}`);
const chosen = SHEETS.filter(s => !positionals.length || positionals.includes(s.id));
const withHero = !positionals.length || positionals.includes("readme");

const shots = new Map();
for (const sheet of chosen) for (const row of rowsOf(sheet)) for (const t of row.tiles) if (!shots.has(t.key)) shots.set(t.key, { t });
const tmp = await mkdtemp(join(tmpdir(), "showcase-"));
[...shots.values()].forEach((s, i) => { s.file = join(tmp, `${i}.png`); });
let browser;
try {
  browser = await chromium.launch();
  const queue = [...shots.values()];
  let failed;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length && !failed) {
      const s = queue.shift();
      try { await shoot(browser, s.t, s.file); } catch (e) { failed ??= e; }
    }
  }));
  if (failed) throw failed;
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 800 } });
  for (const sheet of chosen) {
    const rows = rowsOf(sheet).map(r => ({ ...r, tiles: r.tiles.map(t => ({ ...t, file: pathToFileURL(shots.get(t.key).file).href })) }));
    const html = join(tmp, `${sheet.id}.html`);
    await writeFile(html, sheetHtml(rows));
    await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
    await page.screenshot({ path: join(tmp, `${sheet.id}.jpg`), fullPage: true, type: "jpeg", quality: 82 });
  }
  if (chosen.length) {
    await mkdir(OUT, { recursive: true });
    for (const sheet of chosen) await copyFile(join(tmp, `${sheet.id}.jpg`), join(OUT, `${sheet.id}.jpg`));
    await writeFile(join(OUT, "README.md"), readme());
    console.log(`Rendered ${shots.size} slides into ${chosen.length} sheets in docs/showcase/.`);
  }
  if (withHero) {
    await renderHero(browser);
    console.log("Rendered docs/hero.jpg.");
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await rm(tmp, { recursive: true, force: true });
}

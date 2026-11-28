import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { applyDeck, guessLayout, planDeck, planLibrary, tagSection } from "../layouts.mjs";
import { LAYOUTS } from "../lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const index = JSON.parse(await readFile(join(ROOT, "slides/index.json"), "utf8"));
const untagged = html => html.replace(/\sdata-layout="[^"]*"/, "");

test("the guess gives every library pattern its own layout back", async () => {
  const misses = [];
  for (const p of index) {
    const [layout, reason] = guessLayout(untagged((await readFile(join(ROOT, "slides", `${p.name}.html`), "utf8")).trim()));
    assert(Object.hasOwn(LAYOUTS, layout) && reason);
    if (layout !== p.layout) misses.push(`${p.name}: ${p.layout} → ${layout}`);
  }
  assert.deepEqual(misses, []);
});

test("library plan copies a one-sided tag, guesses a missing one and flags conflicts", () => {
  const html = {
    both: '<section class="slide" id="a" data-layout="media"><figure class="shot"><img src="x.png"></figure></section>',
    json: '<section class="slide" id="b"><p>x</p></section>',
    file: '<section class="slide" id="c" data-layout="table"><table></table></section>',
    none: '<section class="slide" id="d"><div class="split"><div class="text"></div><figure class="cli"></figure></div></section>',
    clash: '<section class="slide" id="e" data-layout="split"></section>',
    bogus: '<section class="slide" id="f" data-layout="carousel"></section>',
    empty: '<section class="slide" id="g" data-layout=""></section>',
    same: '<section class="slide" id="h" data-layout="carousel"></section>',
    quoted: '<section class="slide" data-title="a > b" id="i" data-layout="list"><p></p></section>'
  };
  const plan = planLibrary([{ name: "both", layout: "media" }, { name: "json", layout: "statement" }, { name: "file" }, { name: "none" }, { name: "clash", layout: "media" }, { name: "bogus" }, { name: "empty" }, { name: "same", layout: "carousel" }, { name: "quoted", layout: "list" }], n => html[n]);
  assert.deepEqual(plan.map(r => [r.name, r.action, r.layout]), [["both", "ok", "media"], ["json", "copy", "statement"], ["file", "copy", "table"], ["none", "guess", "split"], ["clash", "conflict", "media"], ["bogus", "conflict", "carousel"], ["empty", "conflict", ""], ["same", "conflict", "carousel"], ["quoted", "ok", "list"]]);
});

test("deck tagging touches only untagged slide sections and keeps every other byte", () => {
  const deck = '<main>\n<section class="slide" id="one"><h2 class="title">Hi</h2></section>\n<!-- <section class="slide" id="fake"> -->\n<section class="slide" id="two" data-layout="media"><img src="a.png"></section>\n<section class="slide" data-hidden id="three"><table></table></section>\n</main>';
  const plan = planDeck(deck);
  assert.deepEqual(plan.map(r => [r.name, r.action, r.layout]), [["one", "guess", "statement"], ["two", "ok", "media"], ["three", "guess", "table"]]);
  const out = applyDeck(deck, plan);
  assert.equal(out, deck.replace('id="one"', 'id="one" data-layout="statement"').replace('id="three"', 'id="three" data-layout="table"'));
  assert.deepEqual(planDeck(out).map(r => r.action), ["ok", "ok", "ok"]);
  assert.equal(tagSection('<section class="slide"><p></p></section>', "list"), '<section data-layout="list" class="slide"><p></p></section>');
  const quoted = '<section class="slide" data-title="a > b" id="q"><p></p></section><section class="slide" data-title="c > d" id="r" data-layout="media"><img src="x.png"></section>';
  assert.deepEqual(planDeck(quoted).map(r => r.action), ["guess", "ok"]);
  assert.equal(applyDeck(quoted, planDeck(quoted)), quoted.replace('id="q"', 'id="q" data-layout="statement"'));
});

test("npm run layouts dry-runs, then --write tags a deck and a second run has nothing to do", async t => {
  const dir = await mkdtemp(join(tmpdir(), "layouts-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(join(ROOT, "examples/starter/index.html"), join(dir, "index.html"));
  const before = await readFile(join(dir, "index.html"), "utf8");
  const run = (...args) => execFileSync(process.execPath, [join(ROOT, "tools/layouts.mjs"), dir, ...args], { encoding: "utf8" });
  assert.match(run(), /Run again with --write/);
  assert.equal(await readFile(join(dir, "index.html"), "utf8"), before);
  assert.match(run("--write"), /Wrote \d+ tag/);
  const after = await readFile(join(dir, "index.html"), "utf8");
  assert.equal(after.replace(/ data-layout="[^"]*"/g, ""), before);
  assert.match(after, /id="rule" data-layout="table"/);
  assert.match(run(), /nothing to do/);
  assert.match(execFileSync(process.execPath, [join(ROOT, "tools/layouts.mjs")], { encoding: "utf8" }), /68 of 68 tagged, nothing to do|of \d+ tagged, nothing to do/);
});

test("a fork's own untagged pattern gets a tag in index.json and its file with --write", async t => {
  const dir = await mkdtemp(join(tmpdir(), "layouts-fork-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(join(ROOT, "tools"), join(dir, "tools"), { recursive: true, filter: src => !src.includes("/tests") });
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(dir, "slides"));
  await writeFile(join(dir, "slides/index.json"), JSON.stringify([{ name: "ours", summary: "Our own pattern" }, { name: "theirs", layout: "media", summary: "Tagged in index only" }], null, 2) + "\n");
  await writeFile(join(dir, "slides/ours.html"), '<section class="slide" id="ours">\n  <table class="matrix"></table>\n</section>\n');
  await writeFile(join(dir, "slides/theirs.html"), '<section class="slide" id="theirs">\n  <img src="a.png">\n</section>\n');
  const out = execFileSync(process.execPath, [join(dir, "tools/layouts.mjs"), "--write"], { encoding: "utf8" });
  assert.match(out, /guess\s+ours\s+table/);
  assert.match(out, /copy\s+theirs\s+media/);
  assert.deepEqual(JSON.parse(await readFile(join(dir, "slides/index.json"), "utf8")), [{ name: "ours", layout: "table", summary: "Our own pattern" }, { name: "theirs", layout: "media", summary: "Tagged in index only" }]);
  assert.equal(await readFile(join(dir, "slides/ours.html"), "utf8"), '<section class="slide" id="ours" data-layout="table">\n  <table class="matrix"></table>\n</section>\n');
  assert.match(await readFile(join(dir, "slides/theirs.html"), "utf8"), /id="theirs" data-layout="media"/);
});

test("in a standalone deck, npm run layouts with no path tags the deck itself", async t => {
  const dir = await mkdtemp(join(tmpdir(), "layouts-standalone-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(join(ROOT, "tools"), join(dir, "tools"), { recursive: true, filter: src => !src.includes("/tests") });
  await cp(join(ROOT, "examples/codex-lightning/index.html"), join(dir, "site/index.html"), { recursive: true });
  assert.match(execFileSync(process.execPath, [join(dir, "tools/layouts.mjs"), "--write"], { encoding: "utf8" }), /site\/index\.html: 0 of \d+ tagged[\s\S]*Wrote \d+ tag/);
  assert.match(await readFile(join(dir, "site/index.html"), "utf8"), /id="cli-run" data-layout="split"/);
});

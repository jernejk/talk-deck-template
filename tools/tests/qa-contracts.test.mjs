import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { selectSlides, slideSections, outsideSlides, insertFragment } from "../qa-scope.mjs";
import { acquireOutputLock, acquireResourceLock } from "../qa-lock.mjs";
import { nativeWebkitControlDiagnostic } from "../qa-features.mjs";
import { assertOutputBoundary } from "../qa-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tools = ["qa.mjs", "lint.mjs", "qa-scope.mjs", "qa-receipt.mjs", "qa-features.mjs", "qa-lock.mjs", "accept.mjs", "qr.swift"];
const artifacts = process.env.QA_TEST_ARTIFACTS ? resolve(process.env.QA_TEST_ARTIFACTS) : tmpdir();
await mkdir(artifacts, { recursive: true });

async function fixture(t, { missingWebkit = false } = {}) {
  const root = await mkdtemp(join(artifacts, "qa-contract-"));
  if (!process.env.QA_TEST_ARTIFACTS) t.after(() => rm(root, { recursive: true, force: true }));
  else console.log(`Fixture evidence: ${root}`);
  await mkdir(join(root, "tools"));
  await mkdir(join(root, "site/lib/components"), { recursive: true });
  await mkdir(join(root, "site/lib/templates"), { recursive: true });
  await mkdir(join(root, "logs"));
  for (const name of tools) await cp(join(ROOT, "tools", name), join(root, "tools", name));
  await cp(join(ROOT, "core"), join(root, "site/lib/core"), { recursive: true });
  await cp(join(ROOT, "components"), join(root, "site/lib/components"), { recursive: true });
  await cp(join(ROOT, "templates/community"), join(root, "site/lib/templates/community"), { recursive: true });
  for (const ext of ["css", "js"]) await cp(join(ROOT, `components/components.${ext}`), join(root, `site/lib/components/components.${ext}`));
  await cp(join(ROOT, "slides/assets/sample/demo.mp4"), join(root, "site/demo.mp4"));
  await cp(join(ROOT, "slides/assets/sample/demo-poster.png"), join(root, "site/poster.png"));
  await cp(join(ROOT, "tools/tests/fixtures/qa-deck.html"), join(root, "site/index.html"));
  await writeFile(join(root, "site/child.html"), '<!doctype html><title>Child</title><iframe src="grandchild.html" title="Grandchild"></iframe>');
  await writeFile(join(root, "site/grandchild.html"), "<!doctype html><title>Grandchild</title><p>Ready.</p>");
  await writeFile(join(root, "package.json"), '{"type":"module","private":true}\n');
  if (!missingWebkit) await symlink(join(ROOT, "node_modules"), join(root, "node_modules"));
  else {
    await mkdir(join(root, "node_modules/playwright"), { recursive: true });
    await symlink(join(ROOT, "node_modules/playwright-core"), join(root, "node_modules/playwright-core"));
    const pkg = JSON.parse(await readFile(join(ROOT, "node_modules/playwright/package.json"), "utf8"));
    await writeFile(join(root, "node_modules/playwright/package.json"), JSON.stringify({ type: "module", version: pkg.version, exports: { ".": "./index.mjs", "./package.json": "./package.json" } }));
    await writeFile(join(root, "node_modules/playwright/index.mjs"), `import { chromium, webkit as real } from ${JSON.stringify(join(ROOT, "node_modules/playwright/index.mjs"))}; export { chromium }; export const webkit = { executablePath: () => real.executablePath(), launch: async () => { throw new Error("seeded WebKit unavailable"); } };`);
  }
  return root;
}

let serial = 0;
async function run(root, tool, args = [], { code } = {}) {
  const log = join(root, "logs", `${String(++serial).padStart(2, "0")}-${tool}`);
  const r = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, `tools/${tool}.mjs`), ...args], { cwd: root, env: { ...process.env }, timeout: 90000 });
    let stdout = "", stderr = "";
    child.stdout.on("data", s => { stdout += s; }); child.stderr.on("data", s => { stderr += s; });
    child.on("error", reject); child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  await writeFile(`${log}.stdout`, r.stdout); await writeFile(`${log}.stderr`, r.stderr);
  let json;
  try { json = JSON.parse(r.stdout); } catch {}
  if (code !== undefined) assert.equal(r.code, code, JSON.stringify(r, null, 1));
  return { ...r, json };
}
const qa = (root, out, args = [], options = {}) => run(root, "qa", [...args, "--jobs", "1", "--out", join(root, "qa", out)], options);
const status = (root, out) => qa(root, out, ["--status"]);

test("selector contract rejects unknown, mixed, partial ranges and empty selectors", () => {
  const ids = ["intro", "embed", "close"];
  assert.deepEqual(selectSlides(ids, ["close", "1-2"]), ids);
  for (const selectors of [["typo"], ["intro", "typo"], ["1-9"], ["0"], ["2-1"], [""]]) assert.throws(() => selectSlides(ids, selectors), /slides/);
  assert.throws(() => selectSlides(["a", "a"]), /unique/);
});

test("WebKit native-control classification excludes application and unrelated errors", () => {
  const text = "Button failed to load, iconName = pip-placard, layoutTraits = [MacOSLayoutTraits Inline], src = blob:http://fixture.test/native-icon";
  const message = (value, url = "") => ({ type: () => "error", text: () => value, location: () => ({ url }) });
  assert.equal(nativeWebkitControlDiagnostic(message(text)), true);
  assert.equal(nativeWebkitControlDiagnostic(message(text, "http://fixture.test/app.js")), false);
  assert.equal(nativeWebkitControlDiagnostic(message("Video did not start")), false);
  assert.equal(nativeWebkitControlDiagnostic(message(text.replace("pip-placard", "unknown-icon"))), false);
});

test("output boundaries reject a new path through a symlink into served inputs", async t => {
  const root = await mkdtemp(join(artifacts, "qa-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "site"));
  await symlink(join(root, "site"), join(root, "alias"));
  await assert.rejects(assertOutputBoundary(join(root, "site", "captures"), [join(root, "site")]), /outside served/);
  await assert.rejects(assertOutputBoundary(join(root, "alias", "new", "captures"), [join(root, "site")]), /outside served/);
  await assertOutputBoundary(join(root, "qa", "captures"), [join(root, "site")]);
});

test("fragment parser preserves outside bytes, handles nested sections and ignores quoted fake sections", () => {
  const before = '<style>x{content:"<section>"}</style><!-- <section> --><section class="slide" id="one"><section>Nested</section><p>Old.</p></section><script>const x="</section>";</script><section class="slide" id="two">Keep.</section>';
  const fragment = '<section class="slide" id="one"><section>Nested</section><p>Exact.</p></section>';
  const after = insertFragment(before, "one", fragment);
  assert.equal(slideSections(before).length, 2);
  assert.equal(outsideSlides(before, ["one"]), outsideSlides(after, ["one"]));
  assert.notEqual(outsideSlides(before, ["one"]), outsideSlides(after.replace("Keep.", "Escaped ownership."), ["one"]));
  assert.throws(() => insertFragment(before, "one", fragment + "<style>body{color:red}</style>"), /exactly one/);
});

test("task resource locks coordinate QA and exclusive perf without touching other processes", async t => {
  const directory = await mkdtemp(join(artifacts, "qa-lock-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const a = await acquireResourceLock({ kind: "qa", slots: 1, directory });
  const b = await acquireResourceLock({ kind: "qa", slots: 3, directory });
  await assert.rejects(acquireResourceLock({ kind: "qa", slots: 1, directory, waitMs: 0 }), /budget busy/);
  await assert.rejects(acquireResourceLock({ kind: "perf", directory, waitMs: 0 }), /budget busy/);
  await a(); await b();
  const perf = await acquireResourceLock({ kind: "perf", directory });
  await assert.rejects(acquireResourceLock({ kind: "qa", directory, waitMs: 0 }), /budget busy/);
  await perf();
  const out = join(directory, "output"), release = await acquireOutputLock(out);
  await assert.rejects(acquireOutputLock(out), /in use/);
  await release(); await (await acquireOutputLock(out))();
});

test("resource contention queues within its bound and recovers a dead guard owner", async t => {
  const directory = await mkdtemp(join(artifacts, "qa-queue-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const held = await acquireResourceLock({ slots: 4, directory });
  const start = Date.now();
  const waiting = acquireResourceLock({ slots: 1, directory, waitMs: 2000 });
  const release = setTimeout(held, 120);
  t.after(() => clearTimeout(release));
  const done = await waiting;
  assert(Date.now() - start >= 100);
  await done();
  await writeFile(join(directory, "guard"), JSON.stringify({ pid: 2147483647, token: "dead-owner" }));
  await (await acquireResourceLock({ directory, waitMs: 0 }))();
});

test("scoped clock acceptance catches the overlap attributed to the next slide", { timeout: 90000 }, async t => {
  const root = await fixture(t), index = join(root, "site/index.html"), baseline = join(root, "lint-before.json");
  await run(root, "lint", ["--out", baseline], { code: 0 });
  await writeFile(index, (await readFile(index, "utf8")).replace("0:00–0:10", "0:00–0:15"));
  const result = await run(root, "lint", ["--slides", "intro", "--baseline", baseline, "--checks", "clock-order"], { code: 1 });
  assert(result.json.newWarnings.some(w => w.slide === "embed" && w.check === "clock-order"));
});

test("lazy video metadata is probed and a failed slide retains the rest of the captures", { timeout: 90000 }, async t => {
  const root = await fixture(t), index = join(root, "site/index.html");
  await writeFile(index, (await readFile(index, "utf8")).replace('preload="auto"', 'preload="none"'));
  let result = await qa(root, "preload-none", ["--slides", "intro,media", "--sizes", "1920x1080"], { code: 0 });
  assert.deepEqual(result.json.screenshotCounts, { slides: 2, sheets: 1, total: 3 });
  const video = await readFile(join(root, "site/demo.mp4"));
  await writeFile(join(root, "site/demo.mp4"), "HTTP 200 but not a playable video");
  result = await qa(root, "invalid-lazy-video", ["--slides", "media", "--fast"], { code: 1 });
  assert(result.json.problems.length > 0);
  await writeFile(join(root, "site/demo.mp4"), video);
  await writeFile(join(root, "site/child.html"), '<!doctype html><script>Object.defineProperty(document,"readyState",{get:()=>"loading"})</script><p>Seeded never-ready child</p>');
  await writeFile(index, (await readFile(index, "utf8")).replace('<img class="embed-shot" src="poster.png" alt="Fixture fallback capture">', ""));
  result = await qa(root, "readiness-failure-captures", ["--slides", "intro,embed,close", "--sizes", "1920x1080"], { code: 1 });
  assert.deepEqual(result.json.screenshotCounts, { slides: 3, sheets: 1, total: 4 });
  assert(result.json.problems.some(p => p.check === "readiness"));
});

test("real QA receipts distinguish full/scoped/fast, stale and tampered evidence", { timeout: 90000 }, async t => {
  const root = await fixture(t);
  const full = await qa(root, "full", [], { code: 0 });
  assert.equal(full.json.problems.length, 0);
  assert.deepEqual(full.json.screenshotCounts, { slides: 8, sheets: 2, total: 10 });
  let s = await status(root, "full");
  assert.equal(s.json.currentFull, true, JSON.stringify(s.json)); assert.equal(s.json.state, "current-full");
  const pointer = join(root, "qa/full/latest.json");
  const correctPointer = await readFile(pointer);
  await writeFile(pointer, JSON.stringify({ ...JSON.parse(correctPointer), schema: "wrong" }));
  s = await status(root, "full");
  assert.equal(s.json.latest.valid, false);
  assert.equal(s.json.full.valid, true);
  await writeFile(pointer, correctPointer);
  const receipt = JSON.parse(await readFile(full.json.receipt, "utf8"));
  assert.deepEqual(receipt.tasks.filter(t => t.kind === "render").map(t => t.checkedIds), Array(2).fill(["intro", "embed", "media", "close"]));
  assert(receipt.tasks.filter(t => t.kind.startsWith("features-")).every(t => t.completed), JSON.stringify(receipt.problems));
  assert.equal(receipt.physicalPhone.status, "unverified");
  const pending = join(root, "pending.json");
  await run(root, "accept", ["pending", root, "--pending", pending, "--add", "full-qa", "--reason", "Full evidence owed", "--allow-pending"], { code: 0 });
  let pendingResult = await run(root, "accept", ["pending", "--pending", pending, "--receipt", full.json.receipt], { code: 0 });
  assert.equal(pendingResult.json.complete, true);
  const partial = await qa(root, "partial", ["--slides", "intro"], { code: 0 });
  assert.deepEqual(partial.json.screenshotCounts, { slides: 2, sheets: 2, total: 4 });
  s = await status(root, "partial"); assert.equal(s.json.currentFull, false); assert.equal(s.json.state, "current-scoped");
  const fast = await qa(root, "fast", ["--slides", "intro", "--fast"], { code: 0 });
  assert.equal(fast.json.screenshotCounts.total, 0);
  s = await status(root, "fast"); assert.equal(s.json.currentFull, false); assert.equal(s.json.state, "incomplete-fast");
  pendingResult = await run(root, "accept", ["pending", "--pending", pending, "--receipt", fast.json.receipt], { code: 1 });
  assert.equal(pendingResult.json.complete, false);
  for (const picks of ["missing", "intro,missing", "1-99"]) {
    const bad = await qa(root, "unknown", ["--slides", picks], { code: 1 });
    assert.match(bad.stderr, /unknown slide|outside slides/);
  }
  const png = join(receipt.artifactRoot, receipt.artifacts[0].path), original = await readFile(png);
  await writeFile(png, Buffer.concat([original, Buffer.from("tampered")]));
  s = await status(root, "full"); assert.equal(s.json.currentFull, false); assert(s.json.full.reasons.some(r => r.includes("Artifact altered")));
  await run(root, "accept", ["pending", "--pending", pending, "--receipt", full.json.receipt], { code: 1 });
  await writeFile(png, original);
  const html = await readFile(join(root, "site/index.html"), "utf8");
  await writeFile(join(root, "site/index.html"), html.replace("Original wording.", "Changed after QA."));
  s = await status(root, "full"); assert.equal(s.json.currentFull, false); assert(s.json.full.reasons.some(r => r.includes("inputs changed")));
  await run(root, "accept", ["pending", "--pending", pending, "--receipt", full.json.receipt], { code: 1 });
  await writeFile(join(root, "site/index.html"), html);
  const bytes = await readFile(full.json.receipt);
  await writeFile(full.json.receipt, bytes.toString().replace('"kind": "full"', '"kind": "scoped"'));
  s = await status(root, "full"); assert.equal(s.json.currentFull, false); assert(s.json.full.reasons.some(r => r.includes("digest mismatch")));
});

test("missing lint is visible; missing WebKit is a full problem and a scoped warning", { timeout: 90000 }, async t => {
  const root = await fixture(t, { missingWebkit: true });
  let r = await qa(root, "full-missing-webkit", [], { code: 1 });
  assert(r.json.problems.some(p => p.check === "webkit-missing"));
  r = await qa(root, "scoped-missing-webkit", ["--slides", "intro", "--fast"], { code: 0 });
  assert(r.json.warnings.some(p => p.check === "webkit-missing")); assert(r.json.pending.length);
  await rename(join(root, "tools/lint.mjs"), join(root, "tools/lint.unavailable"));
  r = await qa(root, "missing-lint", ["--slides", "intro", "--fast"], { code: 0 });
  assert(r.json.warnings.some(w => w.check === "lint-missing" && w.message.includes("upgrade")));
  assert.equal((await status(root, "missing-lint")).json.currentFull, false);
});

test("deferred plugin scripts initialize the framed deck without entering the empty host", { timeout: 90000 }, async t => {
  const root = await fixture(t), index = join(root, "site/index.html");
  const html = await readFile(index, "utf8");
  const scripts = '<script src="lib/core/deck.js"></script><script src="lib/components/components.js"></script>';
  assert(html.includes(scripts));
  await writeFile(index, html.replace(scripts, "").replace("</head>", scripts.replaceAll("<script ", "<script defer ") + "</head>"));
  const result = await qa(root, "deferred", ["--slides", "embed,media", "--fast"], { code: 0 });
  assert.equal(result.json.problems.length, 0);
});

test("broken decoded posters, nested embeds, lifecycle handlers and forced host geometry fail", { timeout: 90000 }, async t => {
  const root = await fixture(t);
  const poster = await readFile(join(root, "site/poster.png"));
  await writeFile(join(root, "site/poster.png"), "HTTP 200 but not an image");
  let r = await qa(root, "broken-poster", ["--slides", "media", "--fast"], { code: 1 });
  assert(r.json.problems.some(p => p.check === "poster-decode"), JSON.stringify(r.json));
  await writeFile(join(root, "site/poster.png"), poster);
  await writeFile(join(root, "site/child.html"), '<!doctype html><title>Child</title><iframe src="missing-nested.html" title="Broken nested child"></iframe>');
  r = await qa(root, "broken-nested", ["--slides", "embed", "--fast"], { code: 1 });
  assert(JSON.stringify(r.json.problems).includes("missing-nested"));
  await writeFile(join(root, "site/child.html"), '<!doctype html><title>Child</title><iframe src="grandchild.html" title="Grandchild"></iframe>');
  const html = await readFile(join(root, "site/index.html"), "utf8");
  await writeFile(join(root, "site/index.html"), html.replace("</head>", '<script>document.addEventListener("visibilitychange",()=>{throw new Error("seeded lifecycle failure")})</script></head>'));
  r = await qa(root, "broken-lifecycle", ["--slides", "embed", "--fast"], { code: 1 });
  assert(JSON.stringify(r.json.problems).includes("seeded lifecycle failure"));
  await writeFile(join(root, "site/index.html"), html);
  const core = await readFile(join(root, "site/lib/core/deck.js"), "utf8");
  assert(core.includes("frame.width = w;"));
  await writeFile(join(root, "site/lib/core/deck.js"), core.replace("frame.width = w;", "frame.width = w - 20;"));
  r = await qa(root, "broken-host", ["--slides", "embed", "--fast"], { code: 1 });
  assert(JSON.stringify(r.json.problems).includes("frame geometry"));
});

test("fragment acceptance recomputes exact wording, ownership, library, lint delta and deferred gates", { timeout: 90000 }, async t => {
  const root = await fixture(t), index = join(root, "site/index.html");
  await mkdir(join(root, "contracts"));
  const text = join(root, "text.json");
  await writeFile(text, JSON.stringify([{ slide: "intro", selector: ".sub", text: "Exact final wording." }]));
  const contractDir = join(root, "contracts", "wording");
  const made = await run(root, "accept", ["fragment-out", root, "--slides", "intro", "--text", text, "--out", contractDir], { code: 0 });
  const contract = made.json.contract, fragment = made.json.fragment;
  const original = await readFile(fragment, "utf8");
  await writeFile(fragment, original.replace("Original wording.", "Paraphrased wording."));
  let r = await run(root, "accept", ["fragment-in", "--contract", contract, "--fragment", fragment], { code: 1 });
  assert(r.json.problems.some(p => p.includes("exactly")));
  await writeFile(fragment, original.replace("Original wording.", "Exact final wording.") + "<style>body{color:red}</style>");
  r = await run(root, "accept", ["fragment-in", "--contract", contract, "--fragment", fragment], { code: 1 });
  assert.match(r.stderr, /exactly one/);
  await writeFile(fragment, original.replace("Original wording.", "Exact final wording."));
  r = await run(root, "accept", ["fragment-in", "--contract", contract, "--fragment", fragment], { code: 0 });
  assert.equal(r.json.inserted, true); assert.equal(r.json.complete, false);
  const scoped = await qa(root, "acceptance-scoped", ["--slides", "intro"], { code: 0 });
  r = await run(root, "accept", ["check", "--contract", contract, "--receipt", scoped.json.receipt, "--allow-pending"], { code: 0 });
  assert.equal(r.json.accepted, true); assert.equal(r.json.complete, false);
  assert(r.json.pending.some(c => c.id === "full-qa" && c.state === "pending"));
  assert.deepEqual(r.json.checkedIds, ["intro"]);
  await run(root, "accept", ["check", "--contract", contract, "--receipt", scoped.json.receipt], { code: 1 });
  const pendingPath = made.json.pending, savedPending = await readFile(pendingPath, "utf8");
  await writeFile(pendingPath, JSON.stringify({ schema: "talk-deck-pending/v1", checks: [] }));
  r = await run(root, "accept", ["check", "--contract", contract, "--receipt", scoped.json.receipt, "--allow-pending"], { code: 1 });
  assert.match(r.stderr, /altered or deleted/);
  await writeFile(pendingPath, savedPending);
  const current = await readFile(index, "utf8");
  await writeFile(index, current.replace("<body>", '<body data-outside="changed">'));
  r = await run(root, "accept", ["check", "--contract", contract, "--receipt", scoped.json.receipt, "--allow-pending"], { code: 1 });
  assert(r.json.problems.some(p => p.includes("outside the owned slide")));
  await writeFile(index, current);
  const lib = join(root, "site/lib/core/deck.js");
  await writeFile(lib, (await readFile(lib, "utf8")) + "\n// seeded shared change\n");
  r = await run(root, "accept", ["check", "--contract", contract, "--receipt", scoped.json.receipt, "--allow-pending"], { code: 1 });
  assert(r.json.problems.some(p => p.includes("Shared library changed")));
});

test("new selected lint warnings fail only the explicit baseline/fragment contract", { timeout: 90000 }, async t => {
  const root = await fixture(t), index = join(root, "site/index.html");
  const baseline = join(root, "lint-before.json");
  await run(root, "lint", ["--out", baseline], { code: 0 });
  const html = await readFile(index, "utf8");
  await writeFile(index, html.replace("Original wording.", "Don't paraphrase."));
  let r = await run(root, "lint", [], { code: 0 });
  assert(r.json.warnings.some(w => w.check === "curly-quotes"));
  r = await run(root, "lint", ["--slides", "intro", "--baseline", baseline, "--checks", "curly-quotes"], { code: 1 });
  assert(r.json.newWarnings.some(w => w.slide === "intro"));
  await run(root, "lint", ["--slides", "close", "--baseline", baseline], { code: 0 });
  await qa(root, "advisory", ["--slides", "intro", "--fast"], { code: 0 });
  r = await qa(root, "strict", ["--slides", "intro", "--fast", "--lint-baseline", baseline, "--lint-checks", "curly-quotes"], { code: 1 });
  assert(r.json.problems.some(p => p.check === "new-lint-warning"));
  await writeFile(index, html);
  await mkdir(join(root, "contracts"));
  const text = join(root, "text.json");
  await writeFile(text, JSON.stringify([{ slide: "intro", selector: ".sub", text: "Don't paraphrase." }]));
  const made = await run(root, "accept", ["fragment-out", root, "--slides", "intro", "--text", text, "--out", join(root, "contracts", "lint")], { code: 0 });
  await writeFile(made.json.fragment, (await readFile(made.json.fragment, "utf8")).replace("Original wording.", "Don't paraphrase."));
  r = await run(root, "accept", ["fragment-in", "--contract", made.json.contract, "--fragment", made.json.fragment], { code: 1 });
  assert(r.json.problems.some(p => p.includes("New lint warning")));
});


test("full keyboard QA traverses a stepped nested embed and rejects its broken revealed child", { timeout: 90000 }, async t => {
  const root = await fixture(t);
  const file = join(root, "site/index.html");
  const source = (await readFile(file, "utf8")).replace('<figure class="embed"', '<figure class="embed" data-step').replace(/<img class="embed-shot"[^>]*>/, "");
  await writeFile(file, source);
  const valid = await qa(root, "stepped-valid", [], { code: 0 });
  const receipt = JSON.parse(await readFile(valid.json.receipt, "utf8"));
  assert.equal(receipt.tasks.find(x => x.kind === "keyboard").completed, true);
  await writeFile(join(root, "site/grandchild.html"), '<!doctype html><title>Broken revealed child</title><img src="missing-grandchild.png" alt="Broken">');
  const broken = await qa(root, "stepped-broken", [], { code: 1 });
  assert.ok(broken.json.problems.some(p => JSON.stringify(p).includes("404")));
});

async function authoringFixture(t) {
  const dir = await mkdtemp(join(artifacts, "authoring-contract-"));
  if (!process.env.QA_TEST_ARTIFACTS) t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function author(tool, dir, ...args) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [join(ROOT, "tools", tool + ".mjs"), dir, ...args], { encoding: "utf8" });
  assert.ifError(r.error);
  return r;
}

test("outline preserves the deck boundary and config, and rejects ambiguous markup before writing", async t => {
  const dir = await authoringFixture(t), index = join(dir, "index.html"), outline = join(dir, "outline.json");
  await writeFile(outline, JSON.stringify({ agenda: true, slides: [{ pattern: "statement", section: "Q&A", title: "Questions" }] }));
  const head = '<head><title>Retain</title><script>const fake = "<main id=deck></main>"</script><script id="deck-config" type="application/json">{"brand":"Keep","agenda":[{"section":"Q&A","title":"Your questions","note":"Keep"}]}</script></head>';
  const end = "</MAIN><main id=other>Keep this main</main><footer>Keep</footer>";
  for (const opener of ['<MAIN class="x > y" id="deck">', "<main id='deck'>"]) {
    await writeFile(index, "<!doctype html>" + head + "<!-- <main id=deck></main> -->" + opener + "Old" + end);
    const r = await author("outline", dir, outline, "--force");
    assert.equal(r.status, 0, r.stderr);
    const html = await readFile(index, "utf8");
    assert.ok(html.includes(opener) && html.endsWith(end));
    assert.ok(html.includes('<title>Retain</title><script>const fake = "<main id=deck></main>"'));
    assert.match(html, /data-section="Q&amp;A"/);
    const config = JSON.parse(html.match(/<script id="deck-config"[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(config.brand, "Keep");
    assert.deepEqual(config.agenda, [{ section: "Q&A", title: "Your questions", note: "Keep", time: "0:00" }]);
  }
  for (const main of ["<main>Other</main>", "<main id=deck>", "<main id=deck></main><main id='deck'></main>", "<main id=deck></main></main>"]) {
    const html = head + main;
    await writeFile(index, html);
    const r = await author("outline", dir, outline, "--force");
    assert.equal(r.status, 1, r.stdout);
    assert.equal(await readFile(index, "utf8"), html);
  }
});

test("add and route share nested boundaries and preserve repeated cues, use cases and pipes", async t => {
  const dir = await authoringFixture(t), index = join(dir, "index.html"), presenter = join(dir, "PRESENTER.md");
  const section = (id, title, body = "", attrs = "") => '<section class=slide id="' + id + '" data-title="' + title + '" ' + attrs + '>' + body + '</section>';
  const notes = clock => '<aside class="notes"><b>' + clock + '.</b></aside>';
  const one = section("one", "Demo", '<section>Nested</section><!-- </section> -->' + notes("0:00–1:00"));
  const two = section("two", "Demo", notes("1:00–2:00"));
  const pipe = section("pipe", "A | B");
  const extra1 = section("extra-one", "Extra: More | detail", "", "data-hidden");
  const extra2 = section("extra-two", "Extra: More | detail", "", "data-hidden");
  const writeDeck = (...slides) => writeFile(index, '<main id="deck">' + slides.join("\n") + '</main>');
  const original = '| # | Slide | Clock | Live or screenshot | Cue |\n|---|---|---|---|---|\n' +
    '| 1 | Demo | 0:00–1:00 | Illustration | FIRST \\| both |\n| 2 | Demo | 1:00–2:00 | Slide | SECOND |\n| 3 | A \\| B |  | Slide | THIRD\n\n' +
    '| Extra | Use when |\n|---|---|\n| More \\| detail | Extra FIRST |\n| More \\| detail | Extra SECOND |\n';
  await writeFile(presenter, original);
  await writeDeck(two, one, pipe, extra1, extra2);
  let r = await author("route", dir);
  assert.match(r.stderr, /ambiguous legacy/);
  assert.equal(await readFile(presenter, "utf8"), original);

  await writeDeck(one, two, pipe, extra1, extra2);
  r = await author("route", dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await author("route", dir, "--check")).status, 0);
  await writeDeck(two, one, pipe, extra2, extra1);
  r = await author("route", dir);
  assert.equal(r.status, 0, r.stderr);
  const md = await readFile(presenter, "utf8");
  assert.match(md, /\| 1 \| Demo .* \| 1:00–2:00 \| Slide \| SECOND \|/);
  assert.match(md, /\| 2 \| Demo .* \| 0:00–1:00 \| Illustration \| FIRST \\\| both \|/);
  assert.match(md, /\| A \\\| B \|  \| Slide \| THIRD \|/);
  assert.ok(md.indexOf("Extra SECOND") < md.indexOf("Extra FIRST"));
  r = await author("add", dir, "statement", "--after", "one");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(slideSections(await readFile(index, "utf8")).map(s => s.id), ["two", "one", "statement", "pipe", "extra-two", "extra-one"]);
});

test("inline resolves static resources per iframe document and fails before overwriting output on cycles", async t => {
  const dir = await authoringFixture(t), out = join(dir, "standalone.html");
  await mkdir(join(dir, "demo/nested"), { recursive: true });
  await writeFile(join(dir, "index.html"), "<iframe data-src='demo/child.html' title='Child'></iframe>");
  await writeFile(join(dir, "demo/child.html"), "<script src='run.js'></script><link rel=stylesheet href=look.css><iframe src=nested/grandchild.html></iframe>");
  await writeFile(join(dir, "demo/run.js"), 'document.title = "child";');
  await writeFile(join(dir, "demo/look.css"), "body { background: url(nested/icon.svg); }");
  await writeFile(join(dir, "demo/nested/icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" />');
  await writeFile(join(dir, "demo/nested/grandchild.html"), "<img src=icon.svg alt=Icon>");
  let r = await author("inline", dir);
  assert.equal(r.status, 0, r.stderr);
  const exported = await readFile(out, "utf8");
  const unstuff = (text, type) => Buffer.from(text.match(new RegExp("data:" + type + "[^,]*,([A-Za-z0-9+/=]+)"))[1], "base64").toString();
  const child = unstuff(exported, "text/html");
  assert.equal(unstuff(child, "text/javascript"), 'document.title = "child";');
  assert.match(unstuff(child, "text/css"), /data:image\/svg\+xml;base64/);
  assert.match(unstuff(child, "text/html"), /data:image\/svg\+xml;base64/);
  for (const [body, diagnostic] of [["<iframe src=../child.html></iframe>", /Circular iframe/], ["<img srcset='icon.svg 1x'>", /grandchild.html.*unsupported/]]) {
    await writeFile(join(dir, "demo/nested/grandchild.html"), body);
    r = await author("inline", dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, diagnostic);
    assert.equal(await readFile(out, "utf8"), exported);
  }
});

test("QA rejects an explicit repository deck outside the fingerprinted examples", async t => {
  const root = await fixture(t);
  await mkdir(join(root, "examples"));
  await mkdir(join(root, "core"));
  await writeFile(join(root, "core/deck.js"), "");
  const output = join(root, "outside");
  const r = await run(root, "qa", ["site", "--out", output], { code: 1 });
  assert.match(r.stderr, /inside the fingerprinted examples/);
  await assert.rejects(readFile(join(output, "latest.json")), { code: "ENOENT" });
});

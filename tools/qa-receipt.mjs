import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const QA_SCHEMA = "talk-deck-qa/v1";
export const hash = value => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export const exists = path => access(path).then(() => true, () => false);
const within = (root, path) => path === root || path.startsWith(root + sep);
const TOOLS = ["qa.mjs", "lint.mjs", "qa-scope.mjs", "qa-receipt.mjs", "qa-features.mjs", "qa-lock.mjs", "accept.mjs", "lib.mjs", "build.mjs", "qr.swift"];

export async function canonicalPath(path) {
  let existing = resolve(path);
  const suffix = [];
  for (;;) {
    try { return join(await realpath(existing), ...suffix); }
    catch (e) {
      if (e.code !== "ENOENT") throw e;
      if (dirname(existing) === existing) throw e;
      suffix.unshift(basename(existing));
      existing = dirname(existing);
    }
  }
}

export async function assertOutputBoundary(output, inputs, exact = []) {
  const actual = await canonicalPath(output);
  for (const input of inputs) if (within(await canonicalPath(input), actual)) throw new Error("Output must be outside served input folders, including symlink aliases.");
  for (const input of exact) if (actual === await canonicalPath(input)) throw new Error("Output cannot replace the served root.");
}

export async function snapshot(paths) {
  const files = [];
  async function walk(path, label, ancestors = new Set()) {
    let info;
    try { info = await lstat(path); }
    catch (e) { if (e.code !== "ENOENT") throw e; files.push({ path: label, missing: true }); return; }
    if (info.isSymbolicLink()) {
      const target = await realpath(path);
      if (ancestors.has(target)) throw new Error(`Fingerprint symlink cycle at ${path}.`);
      await walk(target, label, new Set([...ancestors, target]));
    } else if (info.isDirectory()) {
      files.push({ path: label + "/", directory: true });
      for (const name of (await readdir(path)).sort()) {
        if ([".git", "node_modules", ".DS_Store"].includes(name)) continue;
        await walk(join(path, name), `${label}/${name}`, ancestors);
      }
    } else if (info.isFile()) {
      const bytes = await readFile(path);
      files.push({ path: label, ...(path !== label ? { target: path } : {}), bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  for (const path of [...new Set(paths.map(p => resolve(p)))].sort()) await walk(path, path);
  return { digest: hash(files), files };
}

export async function assertDeckInput(root, repoMode, index) {
  const folder = repoMode ? "examples" : "site";
  const dir = join(root, folder), physicalDir = join(await canonicalPath(root), folder);
  const actual = await canonicalPath(index);
  if (!within(dir, index) || index === dir || !within(physicalDir, actual) || actual === physicalDir) {
    throw new Error('QA deck must be inside the fingerprinted ' + (repoMode ? "examples/" : "site/") + ' directory: ' + index);
  }
}

export function fingerprintPlan(root, repoMode, config = {}) {
  root = resolve(root);
  return {
    inputs: (repoMode ? ["core", "components", "slides", "templates", "examples", "docs/components.md", "docs/slides.md"] : ["site"]).map(p => join(root, p)),
    tools: [...TOOLS.map(p => join(root, "tools", p)), join(root, "package.json"), join(root, "package-lock.json"), ...(config.lintBaseline ? [config.lintBaseline] : [])]
  };
}

export async function browserFingerprint() {
  const require = createRequire(import.meta.url);
  const { chromium, webkit } = await import("playwright");
  const browsers = {};
  for (const [name, type] of Object.entries({ chromium, webkit })) {
    const path = type.executablePath();
    const info = await stat(path).catch(() => null);
    browsers[name] = { path, available: !!info, bytes: info?.size ?? null, modifiedMs: info?.mtimeMs ?? null };
  }
  return {
    playwright: require("playwright/package.json").version,
    revisions: JSON.parse(await readFile(join(dirname(require.resolve("playwright-core/package.json")), "browsers.json"), "utf8")).browsers,
    node: process.version, platform: process.platform, arch: process.arch, browsers
  };
}

export async function fingerprint(plan, config) {
  const inputs = await snapshot(plan.inputs), tools = await snapshot(plan.tools), browser = await browserFingerprint();
  return { plan, inputs, tools, browser, config: hash(config), digest: hash([inputs.digest, tools.digest, browser, config]) };
}

export async function atomicJSON(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  await rename(temporary, path);
}

export async function createRun(out) {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const artifactRoot = join(resolve(out), "runs", runId);
  await mkdir(artifactRoot, { recursive: true });
  return { runId, artifactRoot };
}

export async function artifact(root, path, metadata) {
  const rel = relative(resolve(root), resolve(path));
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(".." + sep)) throw new Error(`Artifact outside this run: ${path}`);
  const body = await readFile(path);
  return { ...metadata, path: rel.split(sep).join("/"), bytes: body.length, sha256: hash(body) };
}

export async function writeReceipt(out, receipt) {
  const path = join(receipt.artifactRoot, "receipt.json");
  await atomicJSON(path, receipt);
  await writeFile(join(receipt.artifactRoot, "receipt.sha256"), hash(await readFile(path)) + "\n", { flag: "wx" });
  const pointer = { schema: QA_SCHEMA, receipt: relative(resolve(out), path).split(sep).join("/") };
  await atomicJSON(join(out, "latest.json"), pointer);
  if (receipt.scope.kind === "full") await atomicJSON(join(out, "latest-full.json"), pointer);
  return path;
}

export async function loadReceipt(path) {
  path = resolve(path);
  const body = await readFile(path);
  if (hash(body) !== (await readFile(join(dirname(path), "receipt.sha256"), "utf8")).trim()) throw new Error("Receipt was altered (digest mismatch).");
  const receipt = JSON.parse(body);
  if (receipt.schema !== QA_SCHEMA || resolve(receipt.artifactRoot) !== dirname(path) || basename(dirname(path)) !== receipt.runId) throw new Error("Invalid QA receipt identity or artifact root.");
  return receipt;
}

export function coverageProblems(receipt) {
  const errors = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!receipt.scope?.decks?.length) errors.push("No decks were checked.");
  if (!["full", "scoped", "fast"].includes(receipt.scope?.kind)) errors.push("Unknown QA scope kind.");
  if (new Set(receipt.artifacts.map(a => a.path)).size !== receipt.artifacts.length) errors.push("Duplicate artifact paths.");
  const actualCounts = { slides: receipt.artifacts.filter(a => a.kind === "slide").length, sheets: receipt.artifacts.filter(a => a.kind === "sheet").length, total: receipt.artifacts.length };
  if (!same(actualCounts, receipt.screenshotCounts)) errors.push("Screenshot count disagrees with artifact manifest.");
  for (const deck of receipt.scope?.decks || []) {
    if (!deck.selectedIds.length || new Set(deck.allIds).size !== deck.allIds.length || deck.selectedIds.some(id => !deck.allIds.includes(id))) errors.push(`${deck.name}: invalid or empty checked slide scope.`);
    for (const theme of deck.themes) for (const size of receipt.config.sizes) {
      const tasks = receipt.tasks.filter(t => t.kind === "render" && t.index === deck.index && t.theme === theme && t.size === size);
      const task = tasks[0];
      if (tasks.length !== 1 || !task?.completed || !same(task.checkedIds, deck.selectedIds)) { errors.push(`${deck.name} ${theme} ${size}: render coverage incomplete.`); continue; }
      const shots = receipt.artifacts.filter(a => a.kind === "slide" && a.index === deck.index && a.theme === theme && a.size === size);
      const expected = receipt.config.fast ? task.qrIds : deck.selectedIds;
      if (!same(shots.map(a => a.slide), expected)) errors.push(`${deck.name} ${theme} ${size}: screenshot coverage incomplete.`);
      const sheets = receipt.artifacts.filter(a => a.kind === "sheet" && a.index === deck.index && a.theme === theme && a.size === size);
      if (sheets.length !== (receipt.config.fast ? 0 : 1)) errors.push(`${deck.name} ${theme} ${size}: contact-sheet coverage incomplete.`);
    }
    for (const kind of ["offline", "keyboard", "lint", "features-chromium", "features-webkit"]) {
      const tasks = receipt.tasks.filter(t => t.kind === kind && t.index === deck.index);
      if (tasks.length !== 1 || !tasks[0].completed) errors.push(`${deck.name}: ${kind} pending.`);
    }
    const lint = receipt.lint.find(l => l.index === deck.index);
    if (!lint || !same(lint.slideIds, deck.allIds)) errors.push(`${deck.name}: full lint coverage missing.`);
    if (receipt.scope.kind === "full" && !same(deck.selectedIds, deck.allIds)) errors.push(`${deck.name}: partial slides cannot be full evidence.`);
  }
  if (receipt.scope.kind === "full" && (receipt.config.fast || receipt.config.changed || receipt.config.selectors !== null || receipt.config.theme !== null || !["1920x1080", "1280x720"].every(size => receipt.config.sizes.includes(size)))) errors.push("Scoped or fast configuration cannot be full evidence.");
  return errors;
}

export async function verifyReceipt(path, { expectedIndices } = {}) {
  let receipt;
  const reasons = [], coverage = [];
  try {
    receipt = await loadReceipt(path);
    coverage.push(...coverageProblems(receipt));
    if (expectedIndices && JSON.stringify([...expectedIndices].sort()) !== JSON.stringify(receipt.scope.decks.map(d => d.index).sort())) reasons.push("Receipt covers a different deck set.");
    const repoMode = await exists(join(receipt.root, "examples")) && await exists(join(receipt.root, "core/deck.js"));
    for (const { index } of receipt.scope.decks) await assertDeckInput(receipt.root, repoMode, index);
    const plan = fingerprintPlan(receipt.root, repoMode, receipt.config);
    if (JSON.stringify(plan) !== JSON.stringify(receipt.fingerprint.plan)) reasons.push("Fingerprint plan does not cover the current canonical inputs/tools.");
    const current = await fingerprint(plan, receipt.config);
    if (current.inputs.digest !== receipt.fingerprint.inputs.digest) reasons.push("Deck/library inputs changed.");
    if (current.tools.digest !== receipt.fingerprint.tools.digest) reasons.push("QA/tool inputs changed.");
    if (JSON.stringify(current.browser) !== JSON.stringify(receipt.fingerprint.browser)) reasons.push("Browser/runtime configuration changed.");
    if (current.digest !== receipt.fingerprint.digest && !reasons.length) reasons.push("Configuration fingerprint mismatch.");
    const root = await realpath(receipt.artifactRoot);
    for (const a of receipt.artifacts) {
      const file = resolve(receipt.artifactRoot, a.path);
      const actual = await realpath(file).catch(() => null);
      if (!within(root, actual || "") || actual === root) { reasons.push(`Artifact missing or outside this run: ${a.path}`); continue; }
      const bytes = await readFile(actual);
      if (bytes.length !== a.bytes || hash(bytes) !== a.sha256) reasons.push(`Artifact altered: ${a.path}`);
    }
  } catch (e) { reasons.push(e.message); }
  return { receipt, current: reasons.length === 0, valid: reasons.length === 0 && coverage.length === 0, reasons: [...reasons, ...coverage] };
}

async function pointer(out, file, verify) {
  try {
    const p = JSON.parse(await readFile(join(out, file), "utf8"));
    if (p.schema !== QA_SCHEMA || typeof p.receipt !== "string" || !p.receipt || isAbsolute(p.receipt)) throw new Error("Invalid receipt pointer.");
    const path = resolve(out, p.receipt);
    if (!within(resolve(out), path)) throw new Error("Receipt pointer escapes the output folder.");
    const actual = await canonicalPath(path);
    if (!within(await canonicalPath(out), actual)) throw new Error("Receipt pointer escapes the output folder.");
    return { path, ...await verify(path) };
  } catch (e) { return { valid: false, reasons: [`${file}: ${e.message}`] }; }
}

export async function qaStatus(out, expectedIndices) {
  const checked = new Map();
  const verify = path => {
    if (!checked.has(path)) checked.set(path, verifyReceipt(path, { expectedIndices }));
    return checked.get(path);
  };
  const latest = await pointer(out, "latest.json", verify);
  const full = await pointer(out, "latest-full.json", verify);
  const green = result => result.valid && !result.receipt.problems.length && !result.receipt.pending.length;
  const currentFull = green(full) && full.receipt.scope.kind === "full";
  const state = !latest.current ? "stale-or-missing" : `${green(latest) ? "current" : "incomplete"}-${latest.receipt.scope.kind}`;
  return {
    schema: "talk-deck-qa-status/v1", state, currentFull,
    latest: { receipt: latest.path ?? null, artifactRoot: latest.receipt?.artifactRoot ?? null, screenshotCounts: latest.receipt?.screenshotCounts ?? null, kind: latest.receipt?.scope.kind ?? null, valid: latest.valid, problems: latest.receipt?.problems.length ?? null, reasons: latest.reasons },
    full: { receipt: full.path ?? null, valid: full.valid, reasons: full.reasons, problems: full.receipt?.problems.length ?? null },
    pending: [...(!currentFull ? ["current full QA"] : []), ...(latest.receipt?.pending || [])],
    physicalPhone: { status: "unverified", reason: "Desktop Chromium and Playwright WebKit do not verify a physical phone." }
  };
}

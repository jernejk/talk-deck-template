// Integrator-owned contracts. Worker status strings are never acceptance evidence.
import { chromium } from "playwright";
import { mkdir, readFile, writeFile, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { atomicJSON, exists, hash, snapshot, verifyReceipt } from "./qa-receipt.mjs";
import { acquireResourceLock } from "./qa-lock.mjs";
import { compareLint, lint } from "./lint.mjs";
import { insertFragment, outsideSlides, selectSlides, slideSections } from "./qa-scope.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_SCHEMA = "talk-deck-fragment/v1";

export async function deckIndex(path) {
  const absolute = resolve(path);
  for (const p of absolute.endsWith(".html") ? [absolute] : [join(absolute, "index.html"), join(absolute, "site/index.html")]) if (await exists(p)) return realpath(p);
  throw new Error(`No deck index at ${path}.`);
}

async function withBrowser(fn) {
  const release = await acquireResourceLock({ kind: "qa", slots: 1 });
  let browser;
  try { browser = await chromium.launch(); return await fn(browser); }
  finally { await browser?.close(); await release(); }
}

async function unchangedSnapshot(paths, index) {
  const found = await snapshot(paths);
  const files = found.files.filter(f => f.path !== index);
  return { digest: hash(files), files };
}

export async function loadContract(path) {
  path = resolve(path);
  const bytes = await readFile(path);
  if (hash(bytes) !== (await readFile(join(dirname(path), "contract.sha256"), "utf8")).trim()) throw new Error("Integrator contract was altered.");
  const contract = JSON.parse(bytes);
  if (contract.schema !== CONTRACT_SCHEMA || contract.slides.length !== 1 || !contract.text.length) throw new Error("Expected a one-fragment supplied-text contract.");
  const before = await readFile(contract.baseline.path, "utf8");
  if (hash(before) !== contract.baseline.sha256) throw new Error("Integrator baseline was altered.");
  return { contract, before };
}

// Parse inert documents: no deck scripts or external resources run here.
export async function textAndStructure(before, after, contract, browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(({ before, after, contract }) => {
      const parse = html => new DOMParser().parseFromString(html, "text/html");
      const a = parse(before), b = parse(after), problems = [];
      const masks = [new Set(), new Set()], attributes = [new Map(), new Map()];
      const canonicalText = text => text.replace(/[\t\n\r ]+/g, " ").trim();
      for (const target of contract.text) {
        if (!contract.slides.includes(target.slide) || typeof target.text !== "string" || !target.selector) { problems.push("Invalid supplied-text target."); continue; }
        if (target.attribute && !["alt", "aria-label", "title"].includes(target.attribute)) { problems.push(`Attribute ${target.attribute} is outside the text-only contract.`); continue; }
        const pair = [a, b].map(doc => {
          const section = doc.getElementById(target.slide);
          const els = section ? [...section.querySelectorAll(target.selector)] : [];
          if (els.length !== 1) { problems.push(`#${target.slide} ${target.selector}: expected exactly one target, got ${els.length}.`); return null; }
          if (els[0].closest("script, style, template, iframe")) { problems.push("Scripts/styles/templates/frames cannot be text targets."); return null; }
          return els[0];
        });
        pair.forEach((el, i) => {
          if (!el) return;
          if (target.attribute) attributes[i].set(el, [...(attributes[i].get(el) || []), target.attribute]);
          else masks[i].add(el);
        });
        if (pair[1]) {
          const actual = target.attribute ? pair[1].getAttribute(target.attribute) : canonicalText(pair[1].textContent);
          if (actual !== target.text) problems.push(`#${target.slide} ${target.selector}: supplied ${target.attribute || "text"} does not match exactly.`);
        }
      }
      const skeleton = (node, i, masked = false) => {
        if (node.nodeType === Node.TEXT_NODE) return ["text", masked ? "<supplied-text>" : node.data];
        if (node.nodeType !== Node.ELEMENT_NODE) return [node.nodeType, node.textContent];
        masked ||= masks[i].has(node);
        const attrs = [...node.attributes].map(a => [a.name, attributes[i].get(node)?.includes(a.name) ? "<supplied-attribute>" : a.value]).sort((a, b) => a[0].localeCompare(b[0]));
        return [node.tagName, attrs, [...node.childNodes].map(n => skeleton(n, i, masked))];
      };
      for (const id of contract.slides) {
        const old = a.getElementById(id), current = b.getElementById(id);
        if (!old || !current || JSON.stringify(skeleton(old, 0)) !== JSON.stringify(skeleton(current, 1))) problems.push(`#${id}: changed structure, attributes, or text outside the supplied targets.`);
      }
      return problems;
    }, { before, after, contract });
  } finally { await page.close(); }
}

export async function makeContract(index, id, text, out) {
  index = await deckIndex(index);
  const before = await readFile(index, "utf8"), sections = slideSections(before);
  if (!sections.some(s => s.id === id)) throw new Error(`Supply one existing stable slide id, not a number/range: ${id}`);
  if (!Array.isArray(text) || !text.length || text.some(t => t.slide !== id)) throw new Error("--text must be a JSON array of supplied {slide, selector, text, attribute?} targets for this slide.");
  out = resolve(out);
  const site = dirname(index);
  if (out === site || out.startsWith(site + sep)) throw new Error("Put worker contracts outside the served deck folder.");
  const engineDeck = index.startsWith(join(ROOT, "examples") + sep);
  const sharedPaths = engineDeck ? ["core", "components", "slides", "templates"].map(p => join(ROOT, p)) : [join(site, "lib")];
  const shared = await snapshot(sharedPaths);
  const unchangedPaths = [site];
  const unchanged = await unchangedSnapshot(unchangedPaths, index);
  const lintRecord = await withBrowser(async browser => ({ index, slideIds: sections.map(s => s.id), findings: await lint(before, { browser, catalog: basename(site) === "catalog" }) }));
  const ownTheme = before.match(/templates\/([\w-]+)\/theme\.css["']/)?.[1];
  if (!ownTheme) throw new Error("Cannot infer the shipped template; stop and use a senior-owned contract.");
  await mkdir(out, { recursive: false });
  const contract = {
    schema: CONTRACT_SCHEMA, index, slides: [id], workerFile: join(out, "fragment.html"),
    baseline: { path: join(out, "before.html"), sha256: hash(before) },
    text, shared: { paths: sharedPaths, ...shared }, unchanged: { paths: unchangedPaths, ...unchanged },
    lintBaseline: [lintRecord],
    required: { sizes: ["1920x1080", "1280x720"], themes: [ownTheme], screenshots: true, qa: "scoped" },
    pending: join(out, "pending-checks.json")
  };
  await writeFile(contract.baseline.path, before, { flag: "wx" });
  await writeFile(contract.workerFile, sections.find(s => s.id === id).html + "\n", { flag: "wx" });
  const pending = { schema: "talk-deck-pending/v1", checks: [
    { id: "full-qa", type: "full-qa", index, reason: "Integrated full-deck QA remains due at batch completion." },
    { id: "visual-review", type: "manual", index, reason: "Senior visual review of current captures remains due." }
  ] };
  contract.requiredPending = pending.checks;
  await atomicJSON(join(out, "contract.json"), contract);
  await writeFile(join(out, "contract.sha256"), hash(await readFile(join(out, "contract.json"))) + "\n", { flag: "wx" });
  await savePending(contract.pending, pending);
  return { contract: join(out, "contract.json"), fragment: contract.workerFile, pending: contract.pending };
}

export async function validateChange(contract, before, after, browser) {
  const problems = [];
  try { if (outsideSlides(before, contract.slides) !== outsideSlides(after, contract.slides)) problems.push("Changed bytes outside the owned slide."); }
  catch (e) { problems.push(e.message); }
  problems.push(...await textAndStructure(before, after, contract, browser));
  if ((await snapshot(contract.shared.paths)).digest !== contract.shared.digest) problems.push("Shared library changed after the contract was frozen.");
  if ((await unchangedSnapshot(contract.unchanged.paths, contract.index)).digest !== contract.unchanged.digest) problems.push("Changed a deck asset or file outside the allowed index fragment.");
  const currentLint = [{ index: contract.index, slideIds: slideSections(after).map(s => s.id), findings: await lint(after, { browser, catalog: basename(dirname(contract.index)) === "catalog" }) }];
  const added = compareLint(contract.lintBaseline, currentLint, { slides: new Map([[contract.index, contract.slides]]) });
  problems.push(...added.map(w => `New lint warning #${w.slide} ${w.check}: ${w.message}`));
  return { problems, lintDelta: added };
}

export async function receiptForContract(path, contract, html) {
  const result = await verifyReceipt(path), problems = [...result.reasons];
  const r = result.receipt;
  if (!r) return { problems };
  if (r.problems.length || r.pending.length) problems.push("QA receipt has problems or pending mechanical checks.");
  for (const warning of r.warnings) if (["title-lines", "title-break"].includes(warning.check) && contract.slides.some(id => warning.where.endsWith(` #${id}`))) problems.push(`Selected title requires senior repair: ${warning.message}`);
  const deck = r.scope.decks.find(d => d.index === contract.index), ids = slideSections(html).map(s => s.id);
  if (!deck) problems.push("QA receipt does not cover the contracted deck.");
  else {
    if (r.config.changed) problems.push("Fragment acceptance needs explicit --slides or full-deck scope, not Git-derived scope.");
    const expected = selectSlides(ids, r.config.selectors);
    if (JSON.stringify(expected) !== JSON.stringify(deck.selectedIds) || JSON.stringify(ids) !== JSON.stringify(deck.allIds)) problems.push("QA checked IDs do not match the recomputed current selector scope.");
    if (contract.slides.some(id => !deck.selectedIds.includes(id))) problems.push("QA omitted an owned slide.");
    if (contract.required.themes.some(t => !deck.themes.includes(t)) || contract.required.sizes.some(s => !r.config.sizes.includes(s))) problems.push("QA omitted a required template or size.");
    if (contract.required.qa === "full" && r.scope.kind !== "full") problems.push("Full QA is required; partial evidence cannot clear it.");
    if (contract.required.screenshots && r.config.fast) problems.push("--fast cannot prove fresh visual captures.");
    for (const theme of contract.required.themes) for (const size of contract.required.sizes) for (const id of contract.slides) {
      if (contract.required.screenshots && r.artifacts.filter(a => a.kind === "slide" && a.index === contract.index && a.theme === theme && a.size === size && a.slide === id).length !== 1) problems.push(`Missing exact current capture for #${id} ${theme} ${size}.`);
    }
  }
  return { problems, receipt: path, screenshotCounts: r.screenshotCounts, checkedIds: deck?.selectedIds ?? [], artifactRoot: r.artifactRoot };
}

export async function pendingChecks(record, receiptPath) {
  if (record.schema !== "talk-deck-pending/v1" || !Array.isArray(record.checks) || new Set(record.checks.map(c => c.id)).size !== record.checks.length) throw new Error("Invalid pending-check record.");
  const verification = receiptPath ? await verifyReceipt(receiptPath) : null;
  return record.checks.map(check => {
    const r = verification?.receipt;
    let state = "pending", reason = check.reason;
    if (["full-qa", "scoped-qa", "motion-qa"].includes(check.type) && verification?.valid && !r.problems.length && !r.pending.length) {
      const deck = r.scope.decks.find(d => d.index === resolve(check.index));
      const whole = check.type !== "full-qa" || r.scope.kind === "full";
      const motion = check.type !== "motion-qa" || r.config.motion;
      const covers = deck && (check.slides || deck.allIds).every(id => deck.selectedIds.includes(id)) && (check.sizes || ["1920x1080", "1280x720"]).every(size => r.config.sizes.includes(size)) && (check.themes || deck.themes).every(t => deck.themes.includes(t));
      if (whole && motion && covers && !r.config.fast) { state = "verified"; reason = "Matching current QA receipt."; }
    }
    return { ...check, state, reason, evidence: state === "verified" ? receiptPath : null };
  });
}

async function savePending(path, record) {
  // The ledger retains every deferred row. Reporting never rewrites either file.
  await atomicJSON(`${path}.ledger.json`, record);
  await atomicJSON(path, record);
}

async function loadPending(path, required = []) {
  const record = JSON.parse(await readFile(path, "utf8"));
  const ledger = JSON.parse(await readFile(`${path}.ledger.json`, "utf8"));
  if (JSON.stringify(record) !== JSON.stringify(ledger)) throw new Error("Pending rows were altered or deleted outside the append command; restore the ledger, then add explicit evidence.");
  for (const check of required) if (!record.checks.some(c => JSON.stringify(c) === JSON.stringify(check))) throw new Error(`Deferred contract gate was deleted or altered: ${check.id}`);
  return record;
}

async function main() {
  const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: {
    contract: { type: "string" }, slides: { type: "string" }, text: { type: "string" }, fragment: { type: "string" },
    receipt: { type: "string" }, out: { type: "string" }, pending: { type: "string" }, add: { type: "string" }, reason: { type: "string" }, "allow-pending": { type: "boolean", default: false }
  } });
  const [command = "check", deck] = positionals;
  let result;
  if (command === "fragment-out") {
    if (!deck || !opt.slides || !opt.text || !opt.out) throw new Error("fragment-out <deck> --slides <stable-id> --text <targets.json> --out <new-directory>");
    result = await makeContract(deck, opt.slides, JSON.parse(await readFile(opt.text, "utf8")), opt.out);
  } else if (command === "pending") {
    if (!opt.pending) throw new Error("pending --pending <record.json> [--add full-qa|scoped-qa|motion-qa|manual <deck> --reason <text>] [--receipt <receipt.json>] [--allow-pending]");
    const path = resolve(opt.pending);
    const record = await exists(path) ? await loadPending(path) : opt.add ? { schema: "talk-deck-pending/v1", checks: [] } : (() => { throw new Error("Pending-check record is missing."); })();
    if (opt.add) {
      if (!deck || !opt.reason || !["full-qa", "scoped-qa", "motion-qa", "manual"].includes(opt.add)) throw new Error("A pending row needs a supported type, deck and reason.");
      record.checks.push({ id: `${opt.add}-${Date.now()}`, type: opt.add, index: await deckIndex(deck), reason: opt.reason, ...(opt.slides ? { slides: opt.slides.split(",") } : {}) });
      await savePending(path, record);
    }
    const checks = await pendingChecks(record, opt.receipt);
    result = { schema: "talk-deck-pending-status/v1", checks, complete: checks.every(c => c.state === "verified") };
    process.exitCode = result.complete || opt["allow-pending"] ? 0 : 1;
  } else if (["fragment-in", "check"].includes(command)) {
    if (!opt.contract) throw new Error(`${command} --contract <contract.json> ${command === "fragment-in" ? "--fragment <returned.html>" : "--receipt <receipt.json> [--allow-pending]"}`);
    const { contract, before } = await loadContract(opt.contract);
    const pendingRecord = await loadPending(opt.pending || contract.pending, contract.requiredPending);
    const current = await readFile(contract.index, "utf8");
    let after = current;
    if (command === "fragment-in") {
      if (!opt.fragment) throw new Error("fragment-in needs --fragment <returned.html>.");
      if (current !== before) throw new Error("Deck changed since fragment-out; review/rebase the contract before insertion.");
      after = insertFragment(current, contract.slides[0], await readFile(opt.fragment, "utf8"));
    }
    const validation = await withBrowser(browser => validateChange(contract, before, after, browser));
    const qa = command === "check" ? opt.receipt ? await receiptForContract(resolve(opt.receipt), contract, after) : { problems: ["Current scoped QA receipt is required."] } : null;
    const problems = [...validation.problems, ...(qa?.problems || [])];
    if (command === "check" && await readFile(contract.index, "utf8") !== current) problems.push("Deck changed during acceptance; rerun against stable inputs.");
    if (command === "fragment-in" && !problems.length) {
      // Re-read immediately before the integrator's write; never overwrite a concurrent edit.
      if (await readFile(contract.index, "utf8") !== current) throw new Error("Deck changed during fragment validation; nothing was inserted.");
      await writeFile(contract.index, after);
    }
    const pending = await pendingChecks(pendingRecord, opt.receipt);
    result = { schema: "talk-deck-acceptance/v1", accepted: !problems.length, complete: command === "check" && !problems.length && pending.every(c => c.state === "verified"), inserted: command === "fragment-in" && !problems.length, checkedIds: qa?.checkedIds ?? [], qa, lintDelta: validation.lintDelta, pending, problems };
    process.exitCode = problems.length || (command === "check" && !result.complete && !opt["allow-pending"]) ? 1 : 0;
  } else throw new Error(`Unknown acceptance command: ${command}`);
  if (opt.out && command !== "fragment-out") await atomicJSON(resolve(opt.out), result);
  console.log(JSON.stringify(result, null, 1));
}

if (process.argv[1] && await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url))) {
  try { await main(); }
  catch (e) { console.error(JSON.stringify({ accepted: false, complete: false, problems: [e.message] })); process.exitCode = 1; }
}

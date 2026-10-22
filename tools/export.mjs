import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { REPO, deckIndex, exists, fail, inside, readDeck, vendorLib, writeTooling } from "./lib.mjs";

const USAGE = `Usage: npm run export -- <deck in examples/> <dir>

Copies a deck into a self-contained folder outside this repo: site/ is what you publish,
with the engine, components and templates in site/lib/, plus PRESENTER.md and QA tooling.`;

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean", short: "h" } } });
if (o.help || positionals.length !== 2) { console.log(USAGE); process.exit(o.help ? 0 : 1); }

const index = await deckIndex(positionals[0]);
const source = dirname(index);
const target = resolve(positionals[1]);
if (!inside(source, join(REPO, "examples"))) fail("Export decks that live in examples/.");
if (inside(target, REPO)) fail("Export to a folder outside this repo.");
if (await exists(target) && (await readdir(target)).length) fail(`${target} is not empty.`);

const site = join(target, "site");
await mkdir(site, { recursive: true });
for (const entry of await readdir(source)) {
  if (entry === "PRESENTER.md" || entry === ".DS_Store") continue;
  await cp(join(source, entry), join(site, entry), { recursive: true });
}
const html = await readFile(index, "utf8");
const { lib } = readDeck(html);
await writeFile(join(site, "index.html"), html.replaceAll(`"${lib}core/`, `"lib/core/`).replaceAll(`"${lib}components/`, `"lib/components/`).replaceAll(`"${lib}templates/`, `"lib/templates/`));
if (await exists(join(source, "PRESENTER.md"))) await cp(join(source, "PRESENTER.md"), join(target, "PRESENTER.md"));
await vendorLib(site);
await writeTooling(target, basename(target));

console.log(`Exported ${basename(source)} to ${target}
  open ${join(site, "index.html")}
  cd ${target} && npm install && npm run qa
  publish: npx surge ${site}`);

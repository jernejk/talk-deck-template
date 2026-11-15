import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { REPO, exists, fail, inside, vendorLib, writeTooling } from "./lib.mjs";

const USAGE = `Usage: npm run upgrade -- <standalone deck folder> [--write]

Refreshes a deck made by npm run new or npm run export from this repo: the library in
site/lib/, the tools, AGENTS.md, the agent skills and the npm scripts. Without --write it
only lists what would change. It never touches index.html, PRESENTER.md or the assets.`;

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { write: { type: "boolean", default: false }, help: { type: "boolean", short: "h" } } });
if (o.help || positionals.length !== 1) { console.log(USAGE); process.exit(o.help ? 0 : 1); }

const target = resolve(positionals[0]);
if (inside(target, REPO)) fail("That folder is inside this repo. Decks in examples/ already use the library directly.");
if (!await exists(join(target, "site", "lib", "core", "deck.js"))) fail(`${target} is not a standalone deck: it has no site/lib/core/deck.js.`);

const LINKS = ["CLAUDE.md", join(".claude", "skills"), join(".agents", "skills")];
const MERGED = ["package.json", ".gitignore"];

async function files(root, dir = root) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(root, path));
    else if (entry.isFile()) out.push(relative(root, path));
  }
  return out;
}

const isLink = async path => { try { return (await lstat(path)).isSymbolicLink(); } catch { return false; } };

async function upgrade(fresh) {
  await vendorLib(join(fresh, "site"));
  await writeTooling(fresh, basename(target));

  const added = [], changed = [];
  for (const rel of await files(fresh)) {
    if (MERGED.includes(rel) || LINKS.some(l => rel === l || rel.startsWith(l + sep))) continue;
    if (!await exists(join(target, rel))) added.push(rel);
    else if (!(await readFile(join(target, rel))).equals(await readFile(join(fresh, rel)))) changed.push(rel);
  }

  const pkgPath = join(target, "package.json");
  const pkg = await exists(pkgPath) ? JSON.parse(await readFile(pkgPath, "utf8")) : { name: basename(target), private: true };
  const ours = JSON.parse(await readFile(join(fresh, "package.json"), "utf8"));
  const nextPkg = { ...pkg, type: ours.type, scripts: { ...pkg.scripts, ...ours.scripts }, devDependencies: { ...pkg.devDependencies, ...ours.devDependencies } };
  const pkgChanged = JSON.stringify(pkg) !== JSON.stringify(nextPkg);

  const ignorePath = join(target, ".gitignore");
  const ignore = await exists(ignorePath) ? await readFile(ignorePath, "utf8") : "";
  const ignoreAdd = (await readFile(join(fresh, ".gitignore"), "utf8")).split("\n").filter(l => l && !ignore.split(/\r?\n/).includes(l));

  const links = [];
  for (const l of LINKS) if (!await isLink(join(target, l)) && !await exists(join(target, l))) links.push(l);

  const lib = changed.filter(f => f.startsWith(join("site", "lib") + sep));
  const other = changed.filter(f => !lib.includes(f));
  const total = added.length + changed.length + links.length + (pkgChanged ? 1 : 0) + (ignoreAdd.length ? 1 : 0);
  if (!total) return console.log(`${target} is up to date with this repo.`);

  console.log(`${o.write ? "Updating" : "Would update"} ${target}:`);
  if (added.length) console.log(`  ${added.length} new file(s), for example ${added.slice(0, 4).join(", ")}`);
  if (lib.length) console.log(`  ${lib.length} changed file(s) in site/lib/:\n${lib.map(f => `    ${f}`).join("\n")}`);
  if (other.length) console.log(`  ${other.length} changed file(s) elsewhere: ${other.join(", ")}`);
  if (pkgChanged) console.log("  package.json: scripts and devDependencies from this repo; the name and other keys stay");
  if (ignoreAdd.length) console.log(`  .gitignore: adds ${ignoreAdd.join(", ")}`);
  if (links.length) console.log(`  new link(s): ${links.join(", ")}`);

  if (!o.write) {
    console.log(`\nNothing changed. Changed files are replaced, so copy out any edits you made to them in this deck.
Then run: npm run upgrade -- ${positionals[0]} --write`);
    return;
  }

  for (const rel of [...added, ...changed]) {
    await mkdir(dirname(join(target, rel)), { recursive: true });
    await cp(join(fresh, rel), join(target, rel));
  }
  if (pkgChanged) await writeFile(pkgPath, JSON.stringify(nextPkg, null, 2) + "\n");
  if (ignoreAdd.length) await writeFile(ignorePath, ignore + (ignore && !ignore.endsWith("\n") ? "\n" : "") + ignoreAdd.join("\n") + "\n");
  for (const l of links) {
    await mkdir(dirname(join(target, l)), { recursive: true });
    await symlink(l === "CLAUDE.md" ? "AGENTS.md" : "../skills", join(target, l));
  }
  console.log(`\nDone. In ${target}, run npm install if the devDependencies changed, then npm run qa.`);
}

const fresh = await mkdtemp(join(tmpdir(), "deck-upgrade-"));
try { await upgrade(fresh); } finally { await rm(fresh, { recursive: true, force: true }); }

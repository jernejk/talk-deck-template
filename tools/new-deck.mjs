import { cp, readFile, writeFile, readdir, access, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";

const USAGE = `Usage: npm run new -- <dir> --title "Big words.|Real demos.|*Honest fallbacks.*" [options]

  --title    Talk title. "|" starts a new cover line; *word* is the accent.
  --event    Event line on the cover, e.g. "Codex Community Brisbane · Lightning talk"
  --date     Date line on the cover, e.g. "Tuesday 20 October 2026"
  --speaker  Your name on the cover
  --brand    Footer text (default: "<speaker> · <event>")
  --theme    Theme in site/themes (default: community)
  --url      Where the slides will live, e.g. https://my-talk.surge.sh (sets the QR code and CNAME)`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" }, event: { type: "string" }, date: { type: "string" },
    speaker: { type: "string" }, brand: { type: "string" }, theme: { type: "string", default: "community" },
    url: { type: "string" }, help: { type: "boolean", short: "h" }
  }
});

const fail = msg => { console.error(msg); process.exit(1); };
if (o.help || positionals.length !== 1 || !o.title) { console.log(USAGE); process.exit(o.help ? 0 : 1); }

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(positionals[0]);
if (target === repo || target.startsWith(repo + sep)) fail("Pick a folder outside the template.");
if (await access(target).then(() => true, () => false) && (await readdir(target)).length) fail(`${target} is not empty.`);
const themes = (await readdir(join(repo, "site/themes"))).map(f => f.replace(/\.css$/, ""));
if (!themes.includes(o.theme)) fail(`Unknown theme "${o.theme}". Pick one of: ${themes.join(", ")}`);
const url = o.url ? new URL(o.url) : null;

const SKIP = new Set(["node_modules", "qa", "docs", ".git", "README.md", join("tools", "new-deck.mjs")]);
const keep = src => {
  const rel = relative(repo, src);
  return !SKIP.has(rel) && !rel.split(sep).some(part => part === ".DS_Store" || SKIP.has(part));
};
await cp(repo, target, { recursive: true, verbatimSymlinks: true, filter: keep });

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = o.title.replace(/\|/g, " ").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const coverTitle = o.title.split("|").map(part => {
  const t = part.trim();
  const whole = t.match(/^\*([^*]+)\*$/);
  if (whole) return `<em>${esc(whole[1])}</em>`;
  return `<span>${esc(t).replace(/\*([^*]+)\*/g, "<em>$1</em>")}</span>`;
}).join("");
const brand = o.brand ?? [o.speaker, o.event].filter(Boolean).join(" · ");

const indexPath = join(target, "site/index.html");
let html = await readFile(indexPath, "utf8");
const config = JSON.parse(html.match(/<script type="application\/json" id="deck-config">([\s\S]*?)<\/script>/)[1]);
config.title = plain;
if (brand) config.brand = brand;
html = html
  .replace(/<script type="application\/json" id="deck-config">[\s\S]*?<\/script>/, () => `<script type="application/json" id="deck-config">\n${JSON.stringify(config, null, 2).replace(/</g, "\\u003c")}\n</script>`)
  .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(plain)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*/, (_, a) => a + esc([plain, o.event].filter(Boolean).join(" · ")))
  .replace(/href="themes\/[\w-]+\.css" id="theme"/, () => `href="themes/${o.theme}.css" id="theme"`)
  .replace(/(<section class="slide slide--cover" id="cover"[^>]*data-title=")[^"]*/, (_, a) => a + esc(plain))
  .replace(/(<h1 class="title" data-fill="title">)[\s\S]*?(<\/h1>)/, (_, a, b) => a + coverTitle + b);
for (const [key, value] of Object.entries({ event: o.event, speaker: o.speaker, date: o.date })) {
  if (value) html = html.replace(new RegExp(`(data-fill="${key}">)[^<]*`, "g"), (_, a) => a + esc(value));
}
if (url) {
  const shown = (url.host + url.pathname).replace(/\/$/, "");
  html = html
    .replace(/(<a class="close-qr" href=")[^"]*/, (_, a) => a + esc(url.href))
    .replace(/(<span class="qr-url">)[^<]*/, (_, a) => a + esc(shown));
  await writeFile(join(target, "site/CNAME"), url.host + "\n");
}
await writeFile(indexPath, html);

const presenterPath = join(target, "PRESENTER.md");
const fills = { title: plain, event: o.event, date: o.date, url: url?.href };
let guide = await readFile(presenterPath, "utf8");
for (const [key, value] of Object.entries(fills)) if (value) guide = guide.replaceAll(`{{${key}}}`, () => value);
await writeFile(presenterPath, guide);

const pkgPath = join(target, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
pkg.name = basename(target).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "talk-deck";
delete pkg.scripts.new;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

if (url) {
  const qr = join(target, "site/assets/qr-slides.png");
  try {
    execFileSync("swift", [join(target, "tools/qr.swift"), url.href, qr], { stdio: "inherit" });
  } catch {
    await rm(qr, { force: true });
    console.error(`The QR code wasn't generated, so the sample one was removed. Make ${qr} for ${url.href} with any QR tool and scan it before the talk.`);
    process.exitCode = 1;
  }
}

console.log(`\nNew deck in ${target}\n  open ${join(target, "site/index.html")}\n  cd ${target} && npm install && npm run qa`);

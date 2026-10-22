import { access, cp, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_SECTIONS = { Welcome: 1, "The hook": 1, Demo: 2, "How it works": 4, "Push for more": 3, Takeaway: 1, Extras: 0 };

export const exists = path => access(path).then(() => true, () => false);
export const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const inside = (path, root) => path === root || path.startsWith(root + sep);
export const fail = msg => { console.error(msg); process.exit(1); };

export async function templates(root = REPO) {
  const dir = join(root, "templates");
  const out = [];
  for (const id of (await readdir(dir)).sort()) {
    if (!await exists(join(dir, id, "theme.css"))) continue;
    const meta = await exists(join(dir, id, "template.json")) ? JSON.parse(await readFile(join(dir, id, "template.json"), "utf8")) : {};
    out.push({ id, name: meta.name || id, description: meta.description || "", extends: meta.extends || null, slides: meta.slides || [] });
  }
  return out;
}

export async function patterns() {
  const index = JSON.parse(await readFile(join(REPO, "slides/index.json"), "utf8"));
  return Promise.all(index.map(async p => ({ ...p, html: (await readFile(join(REPO, "slides", `${p.name}.html`), "utf8")).trim() })));
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];

export function slideSections(html) {
  const out = [];
  for (const m of html.matchAll(/<section\b[^>]*>/gi)) {
    const tag = m[0];
    if (!(attr(tag, "class") || "").split(/\s+/).includes("slide")) continue;
    const close = html.indexOf("</section>", m.index);
    out.push({ start: m.index, end: close < 0 ? html.length : close + "</section>".length, tag, id: attr(tag, "id") || "", hidden: /\sdata-hidden\b/i.test(tag) });
  }
  return out;
}

export function uniqueId(id, taken) {
  let next = id;
  for (let n = 2; taken.has(next); n++) next = `${id}-${n}`;
  taken.add(next);
  return next;
}

export function withId(slideHtml, id) {
  return slideHtml.replace(/^(<section\b[^>]*?\sid\s*=\s*)(["']).*?\2/i, (_, a, q) => `${a}${q}${id}${q}`);
}

export function assetRefs(html) {
  return [...new Set([...html.matchAll(/(?:src|poster|href)="(assets\/[^"#?]+)[^"]*"/g)].map(m => m[1]))];
}

export function sectionsOf(slides) {
  const seen = [];
  for (const html of slides) {
    const m = html.match(/data-section="([^"]+)"/);
    if (m && !seen.includes(m[1])) seen.push(m[1]);
  }
  return Object.fromEntries(seen.filter(s => s in DEFAULT_SECTIONS).map(s => [s, DEFAULT_SECTIONS[s]]));
}

export function deckHtml({ title, description = "", brand = "", template, lib, slides, sections, lang = "en-AU" }) {
  const main = slides.filter(s => !/^<section[^>]*\bdata-hidden\b/.test(s));
  const extras = slides.filter(s => /^<section[^>]*\bdata-hidden\b/.test(s));
  const config = JSON.stringify({ title, brand, sections: sections ?? sectionsOf(slides) }, null, 2).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${lib}core/deck.css">
<link rel="stylesheet" href="${lib}components/components.css">
<link rel="stylesheet" href="${lib}templates/${template}/theme.css" id="theme">
<script src="${lib}core/theme.js"></script>
<script type="application/json" id="deck-config">
${config}
</script>
</head>
<body>

<main id="deck">

${main.join("\n\n")}
${extras.length ? `\n<!-- Presenter extras -->\n\n${extras.join("\n\n")}\n` : ""}
</main>

<script src="${lib}core/deck.js"></script>
<script src="${lib}components/components.js"></script>
</body>
</html>
`;
}

export function readDeck(html) {
  const config = JSON.parse(html.match(/<script type="application\/json" id="deck-config">([\s\S]*?)<\/script>/)?.[1] || "{}");
  const theme = html.match(/href="([^"]*?)templates\/([\w-]+)\/theme\.css" id="theme"/);
  return { config, lib: theme?.[1] ?? "", template: theme?.[2] ?? null };
}

export async function deckIndex(path) {
  const abs = resolve(path);
  if (abs.endsWith(".html")) return abs;
  for (const candidate of [join(abs, "index.html"), join(abs, "site/index.html")]) if (await exists(candidate)) return candidate;
  fail(`No deck at ${path}: expected index.html or site/index.html.`);
}

export function routeTable(slides) {
  const rows = slides.filter(s => !/^<section[^>]*\bdata-hidden\b/.test(s)).map((s, i) => {
    const title = s.match(/data-title="([^"]*)"/)?.[1] ?? "";
    const clock = s.match(/<b>(\d+:\d\d–\d+:\d\d)\.<\/b>/)?.[1] ?? "";
    const live = s.match(/data-live="([^"]*)"/)?.[1];
    return `| ${i + 1} | ${title} | ${clock} | ${live ? `**Live:** ${live}` : "Slide"} |  |`;
  });
  const extras = slides.filter(s => /^<section[^>]*\bdata-hidden\b/.test(s)).map(s => `| ${s.match(/data-title="([^"]*)"/)?.[1].replace(/^Extra: /, "") ?? ""} |  |`);
  return { route: rows.join("\n"), extras: extras.join("\n"), main: rows.length, extraCount: extras.length };
}

export async function copyAssets(html, deckDir, { overwrite = false } = {}) {
  const copied = [];
  for (const ref of assetRefs(html)) {
    const from = join(REPO, "slides", ref);
    const to = join(deckDir, ref);
    if (!await exists(from) || (!overwrite && await exists(to))) continue;
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to);
    copied.push(ref);
  }
  return copied;
}

export async function vendorLib(siteDir) {
  for (const part of ["core", "components", "templates"]) {
    await cp(join(REPO, part), join(siteDir, "lib", part), { recursive: true, filter: src => !src.endsWith(".DS_Store") });
  }
  await cp(join(REPO, "LICENSE"), join(siteDir, "lib", "LICENSE"));
}

async function standaloneGuide() {
  const url = JSON.parse(await readFile(join(REPO, "package.json"), "utf8")).repository?.url;
  const docs = url && `${url.replace(/^git\+/, "").replace(/\.git$/, "")}/blob/main/`;
  const guide = (await readFile(join(REPO, "AGENTS.md"), "utf8"))
    .replace(/<!-- repo-only -->[\s\S]*?<!-- \/repo-only -->(?:\r?\n|$)/g, "")
    .replace(/In the template repo, [^\n]*?`examples\/`\. In a standalone deck the library/, "The library")
    .replaceAll("<deck folder>", "site");
  return docs ? guide.replace(/`((?:docs\/[\w-]+\.md)|docs\/showcase\/|examples\/catalog\/index\.html)`/g, (_, f) => `[\`${f}\`](${docs}${f})`) : guide;
}

export async function writeTooling(root, name) {
  await mkdir(join(root, "tools"), { recursive: true });
  for (const f of ["tools/qa.mjs", "tools/qr.swift", "package-lock.json"]) await cp(join(REPO, f), join(root, f));
  await writeFile(join(root, "AGENTS.md"), await standaloneGuide());
  await symlink("AGENTS.md", join(root, "CLAUDE.md"));
  const { type, scripts, devDependencies } = JSON.parse(await readFile(join(REPO, "package.json"), "utf8"));
  const pkg = { name: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "talk-deck", private: true, type, scripts: { qa: scripts.qa }, devDependencies };
  await writeFile(join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  await writeFile(join(root, ".gitignore"), "node_modules/\nqa/\n.DS_Store\n");
}

export function libPrefix(deckDir) {
  return inside(deckDir, REPO) ? relative(deckDir, REPO).split(sep).join("/") + "/" : "lib/";
}

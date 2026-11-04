// Build one self-contained HTML file from a deck: stylesheets (with @import), scripts, fonts, images, video and embedded pages inlined.
// usage: npm run inline -- examples/my-talk [out.html]   (default: <deck>/standalone.html; in a standalone deck the path is optional)
// The deck's own index.html keeps linking the shared library. Rebuild this file after every edit.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { REPO, deckIndex, exists, fail } from "./lib.mjs";

// A standalone deck has no examples/, so the deck is the folder this tool lives in.
const standalone = !await exists(join(REPO, "examples"));
const [deckArg = standalone ? REPO : undefined, outArg] = process.argv.slice(2);
if (!deckArg) fail("Usage: npm run inline -- <deck> [out.html]");
const index = await deckIndex(deckArg);
const out = resolve(outArg || join(dirname(index), "standalone.html"));

const TYPES = { ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".html": "text/html" };
const remote = u => /^(data:|https?:|#|\/\/)/.test(u);
const dataUri = async file => {
  const type = TYPES[extname(file).toLowerCase()] || fail(`No media type for ${file}`);
  return `data:${type};base64,${(await readFile(file)).toString("base64")}`;
};

async function css(file, seen = new Set()) {
  if (seen.has(file)) return "";
  seen.add(file);
  let text = await readFile(file, "utf8");
  const parts = [];
  for (const m of text.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)\s*;/g)) parts.push([m[0], await css(resolve(dirname(file), m[1]), seen)]);
  for (const [from, to] of parts) text = text.replace(from, to);
  // Quote-aware, so a url() nested inside an SVG data URI stays part of that URI.
  const URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/g;
  const urls = new Map();
  for (const m of text.matchAll(URL_RE)) {
    const u = m[1] ?? m[2] ?? m[3];
    if (!remote(u) && !urls.has(u)) urls.set(u, await dataUri(resolve(dirname(file), u.split(/[?#]/)[0])));
  }
  return text.replace(URL_RE, (all, a, b, c) => { const u = a ?? b ?? c; return urls.has(u) ? `url("${urls.get(u)}")` : all; });
}

const base = dirname(index);
let html = await readFile(index, "utf8");
const swaps = [];
for (const m of html.matchAll(/<link\b[^>]*>/g)) {
  const tag = m[0], href = tag.match(/href="([^"]+)"/)?.[1];
  if (!href || remote(href)) continue;
  const file = resolve(base, href);
  if (/rel="stylesheet"/.test(tag)) {
    const id = tag.match(/id="([^"]+)"/)?.[1];
    swaps.push([tag, `<style${id ? ` id="${id}"` : ""}>\n${await css(file)}\n</style>`]);
  } else swaps.push([tag, tag.replace(href, await dataUri(file))]);
}
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)) {
  if (remote(m[1])) continue;
  const js = (await readFile(resolve(base, m[1]), "utf8")).replace(/<\/script/gi, "<\\/script");
  swaps.push([m[0], `<script>\n${js}\n</script>`]);
}
// img/video/audio/source src, video poster and the embed component's lazy iframe data-src.
for (const m of html.matchAll(/<(?:img|video|audio|source|iframe)\b[^>]*>/g)) {
  let tag = m[0];
  for (const a of tag.matchAll(/\b(?:src|data-src|poster)="([^"]+)"/g)) if (!remote(a[1])) tag = tag.replace(a[0], a[0].replace(a[1], await dataUri(resolve(base, a[1]))));
  if (tag !== m[0]) swaps.push([m[0], tag]);
}
// ponytail: plain string swaps; fine while each tag appears once or identical tags map to the same file
for (const [from, to] of swaps) html = html.split(from).join(to);

const left = [...html.matchAll(/(?:src|href|data-src|poster)="(?!data:|https?:|#|mailto:)([^"]+)"/g)].map(m => m[1]);
if (left.length) fail(`Still links local files: ${[...new Set(left)].join(", ")}`);
await writeFile(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB), no local links left.`);

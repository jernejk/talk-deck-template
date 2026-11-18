// Build one offline HTML file from a deck's supported static resources.
import { readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPO, deckIndex, esc, exists, fail } from "./lib.mjs";
import { attributes, attributeTokens, htmlTags } from "./qa-scope.mjs";

const standalone = !await exists(join(REPO, "examples"));
const [deckArg = standalone ? REPO : undefined, outArg] = process.argv.slice(2);
if (!deckArg) fail("Usage: npm run inline -- <deck> [out.html]");
const index = await deckIndex(deckArg);
const out = resolve(outArg || join(dirname(index), "standalone.html"));

const TYPES = { ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".html": "text/html" };
const routes = /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i;
const local = value => value && (!routes.test(value) || /^file:/i.test(value));
const urlFrom = (value, file) => new URL(value.replace(/&amp;/g, "&"), pathToFileURL(file));
const data = (type, body) => 'data:' + type + ';base64,' + Buffer.from(body).toString("base64");

async function media(url) {
  const file = fileURLToPath(url);
  const type = TYPES[extname(file).toLowerCase()];
  if (!type || type === "text/html") throw new Error("Unsupported static media: " + file);
  return data(type, await readFile(file)) + url.hash;
}

// A quoted image-set option is itself a URL. Quotes inside url() and type()
// belong to those functions and keep their existing handling.
function stringImageSet(text) {
  const sets = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|((?:-webkit-)?\bimage-set\s*\()/gi;
  const tokens = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[()]/g;
  for (const set of text.matchAll(sets)) {
    if (!set[1]) continue;
    tokens.lastIndex = set.index + set[0].length;
    let depth = 1;
    for (let token; depth && (token = tokens.exec(text));) {
      const value = token[0];
      if (depth === 1 && /^["']/.test(value)) return true;
      if (value === "(") depth++;
      if (value === ")") depth--;
    }
  }
  return false;
}

async function cssText(text, file, ancestors) {
  if (stringImageSet(text)) throw new Error(file + ": unsupported string-form image-set(); use url() for image options.");
  const imports = /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)|"([^"]*)"|'([^']*)')([^;]*);/gi;
  const urls = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/gi;
  let result = "", at = 0;
  for (const m of text.matchAll(imports)) {
    result += await cssUrls(text.slice(at, m.index), file, urls);
    const ref = m.slice(1, 6).find(v => v !== undefined);
    if (local(ref)) {
      if (m[6].trim()) throw new Error(file + ": unsupported conditional local @import " + ref);
      result += await stylesheet(urlFrom(ref, file), ancestors);
    } else result += m[0];
    at = m.index + m[0].length;
  }
  return result + await cssUrls(text.slice(at), file, urls);
}

async function cssUrls(text, file, urls) {
  let result = "", at = 0;
  const inlined = new Map();
  for (const m of text.matchAll(urls)) {
    const ref = m[1] ?? m[2] ?? m[3];
    if (!local(ref)) continue;
    if (!inlined.has(ref)) inlined.set(ref, await media(urlFrom(ref, file)));
    result += text.slice(at, m.index) + 'url("' + inlined.get(ref) + '")';
    at = m.index + m[0].length;
  }
  return result + text.slice(at);
}

async function stylesheet(url, ancestors) {
  const file = fileURLToPath(url), actual = await realpath(file);
  if (ancestors.has(actual)) return ""; // CSS ignores circular imports.
  return cssText(await readFile(file, "utf8"), file, new Set([...ancestors, actual]));
}

async function inlineDocument(file, ancestors = new Set()) {
  const actual = await realpath(file);
  if (ancestors.has(actual)) throw new Error("Circular iframe reference to " + file);
  const chain = new Set([...ancestors, actual]);
  const html = await readFile(file, "utf8");
  const edits = [];
  const tags = [...htmlTags(html)];
  for (const [i, token] of tags.entries()) {
    if (token.closing) continue;
    const { name, tag } = token;
    const attrs = attributes(tag);
    if (name === "base" && attrs.has("href") || name === "iframe" && attrs.has("srcdoc") ||
        ["srcset", "imagesrcset"].some(attr => attrs.get(attr))) {
      throw new Error(file + ": unsupported offline resource markup " + tag);
    }
    if (name === "script" && attrs.get("type")?.toLowerCase() === "module") {
      throw new Error(file + ": bundle module scripts into classic scripts before inlining.");
    }
    if (name === "style" && !(token.namespace !== "html" && /\/>$/.test(tag))) {
      const end = token.contentEnd ?? tags.slice(i + 1).find(t => t.closing && t.name === "style" && t.namespace === token.namespace)?.start;
      if (end === undefined) throw new Error(file + ": unclosed foreign <style>.");
      const text = html.slice(token.end, end);
      const rewritten = await cssText(text, file, new Set());
      if (text !== rewritten) edits.push([token.end, end, rewritten]);
    }
    const attrsToEdit = [];
    for (const attr of attributeTokens(tag)) {
      const ref = attr.value.trim(), key = attr.name;
      let replacement;
      if (key === "style" && /(?:url|image-set)\s*\(/i.test(ref)) {
        const css = ref.replace(/&quot;|&#0*34;|&#x0*22;/gi, '"').replace(/&apos;|&#0*39;|&#x0*27;/gi, "'");
        const rewritten = await cssText(css, file, new Set());
        if (rewritten !== css) replacement = rewritten;
      } else if (key === "src" && name === "script" && local(ref)) {
        replacement = data("text/javascript;charset=utf-8", await readFile(urlFrom(ref, file)));
      } else if (key === "href" && name === "link" && local(ref) && attrs.get("rel")?.toLowerCase() === "stylesheet") {
        replacement = data("text/css;charset=utf-8", await stylesheet(urlFrom(ref, file), new Set()));
      } else if (name === "iframe" && (key === "src" || key === "data-src") && local(ref)) {
        const url = urlFrom(ref, file), child = fileURLToPath(url);
        if (url.search || url.hash || !/\.html?$/i.test(child)) throw new Error(file + ": unsupported iframe URL " + ref);
        replacement = data("text/html;charset=utf-8", await inlineDocument(child, chain));
      } else if (local(ref) && (
        key === "href" && name === "link" ||
        ["src", "data-src", "poster"].includes(key) && ["img", "video", "audio", "source"].includes(name)
      )) {
        replacement = await media(urlFrom(ref, file));
      } else if (local(ref) && ["src", "data-src", "poster", "href", "xlink:href", "data", "action", "formaction"].includes(key) &&
          (key !== "data" || name === "object")) {
        throw new Error(file + ": unsupported local reference " + key + '="' + ref + '"');
      }
      if (replacement !== undefined) attrsToEdit.push([attr.start, attr.end, key + '="' + esc(replacement) + '"']);
    }
    if (attrsToEdit.length) edits.push([token.start, token.end, applyEdits(tag, attrsToEdit)]);
  }
  return applyEdits(html, edits);
}

function applyEdits(text, edits) {
  let result = "", at = 0;
  for (const [start, end, value] of edits) {
    result += text.slice(at, start) + value;
    at = end;
  }
  return result + text.slice(at);
}

try {
  const html = await inlineDocument(index);
  await writeFile(out, html);
  console.log('Wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB), with static local resources inlined.');
} catch (e) { fail(e.message); }

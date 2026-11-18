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
const urlFrom = (value, file) => new URL(value, pathToFileURL(file));
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

const cssComment = /\/\*[\s\S]*?(?:\*\/|$)/.source;
const cssEscape = /\\(?:[0-9a-f]{1,6}(?:\r\n|[ \t\r\n\f])?|\r\n|[\s\S])/.source;
const cssString = /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n\f])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n\f])*'/.source;
const cssName = "(?:" + /[-\w\u0080-\uffff]/.source + "|" + cssEscape + ")+";
const cssTrivia = "(?:[ \\t\\r\\n\\f]+|" + cssComment + ")*";

function unescapeCss(value) {
  return value.replace(/\\(?:([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|(\r\n|[\s\S]))/gi, (_, hex, escaped) => {
    if (!hex) return /[\r\n\f]/.test(escaped) ? "" : escaped;
    const point = Number.parseInt(hex, 16);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : "\ufffd";
  });
}

function* cssReferences(text, imports) {
  // Consume complete names, comments and strings before looking for another token.
  const tokens = new RegExp(cssComment + "|" + cssString + "|[@#]?" + cssName + "|[{}]", "gi");
  const urlArgs = new RegExp("\\(([ \\t\\r\\n\\f]*)(?:(" + cssString + ")" + cssTrivia +
    "|((?:" + cssEscape + "|" + /[^"'()\\ \t\r\n\f]/.source + ")*)[ \\t\\r\\n\\f]*)\\)", "iy");
  const importSource = new RegExp(cssTrivia + "(" + cssString + "|" + cssName + ")", "iy");
  const importTail = new RegExp("(?:" + cssComment + "|" + cssString + "|" + cssEscape +
    "|" + /[^;{}"'\\/]|\/(?!\*)/.source + ")*(?:;|$)", "iy");
  function urlAt(at) {
    urlArgs.lastIndex = at;
    const url = urlArgs.exec(text);
    if (!url) return null;
    const arg = url[2] ?? url[3], start = at + 1 + url[1].length;
    return { start, end: start + arg.length, next: urlArgs.lastIndex, ref: unescapeCss(url[2]?.slice(1, -1) ?? arg) };
  }
  let depth = 0;
  for (let token; (token = tokens.exec(text));) {
    const value = token[0];
    if (value === "{") { depth++; continue; }
    if (value === "}") { depth = Math.max(0, depth - 1); continue; }
    if (/^["']|^\/\*/.test(value)) continue;
    const name = unescapeCss(value).toLowerCase();
    if (imports && depth === 0 && name === "@import") {
      importSource.lastIndex = tokens.lastIndex;
      const source = importSource.exec(text);
      if (!source) continue;
      const [, specifier] = source, end = importSource.lastIndex;
      const url = /^["']/.test(specifier)
        ? { start: end - specifier.length, end, next: end, ref: unescapeCss(specifier.slice(1, -1)) }
        : unescapeCss(specifier).toLowerCase() === "url" ? urlAt(end) : null;
      if (!url) continue;
      importTail.lastIndex = url.next;
      const tail = importTail.exec(text);
      if (!tail) continue;
      tokens.lastIndex = importTail.lastIndex;
      yield { ...url, importTail: tail[0].replace(/;$/, "") };
    } else if (name === "url") {
      const url = urlAt(tokens.lastIndex);
      if (!url) continue;
      tokens.lastIndex = url.next;
      yield url;
    }
  }
}

async function cssEdits(text, file, ancestors, { imports = true } = {}) {
  if (stringImageSet(text)) throw new Error(file + ": unsupported string-form image-set(); use url() for image options.");
  const edits = [], inlined = new Map();
  for (const { start, end, ref, importTail } of cssReferences(text, imports)) {
    if (!local(ref)) continue;
    if (importTail !== undefined) {
      if (importTail.replace(new RegExp(cssComment, "g"), "").trim()) {
        throw new Error(file + ": unsupported conditional local @import " + ref);
      }
      const css = await stylesheet(urlFrom(ref, file), ancestors);
      edits.push([start, end, JSON.stringify(data("text/css;charset=utf-8", css))]);
    } else {
      if (!inlined.has(ref)) inlined.set(ref, await media(urlFrom(ref, file)));
      edits.push([start, end, JSON.stringify(inlined.get(ref))]);
    }
  }
  return edits;
}

// Decode resource syntax at the HTML boundary, leaving CSS file text literal.
const htmlEntities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: "\u00a0",
  AMP: "&", QUOT: '"', LT: "<", GT: ">", colon: ":", sol: "/", period: ".", num: "#", semi: ";", equals: "=", Tab: "\t", NewLine: "\n" };
function decodeAttribute(text, record = () => {}) {
  return text.replace(/&(?:#(x[0-9a-f]+|\d+);?|([a-z][a-z\d]*);)/gi, (entity, numeric, named, offset) => {
    let value;
    if (numeric) {
      const hex = /^x/i.test(numeric);
      const point = Number.parseInt(hex ? numeric.slice(1) : numeric, hex ? 16 : 10);
      value = point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : "\ufffd";
    } else if (Object.hasOwn(htmlEntities, named)) value = htmlEntities[named];
    else return entity;
    record(offset, entity.length, value.length);
    return value;
  });
}

function refreshTarget(content) {
  const target = /^\s*\d+(?:\.\d*)?\s*[;,]\s*(?:url\s*=\s*)?([\s\S]*)$/i.exec(content)?.[1].trim();
  if (!target || !/^["']/.test(target)) return target;
  const close = target.indexOf(target[0], 1);
  return target.slice(1, close < 0 ? undefined : close);
}

async function inlineStyleAttribute(tag, attr, file) {
  const raw = attr.value;
  // Decode quotes for the CSS scan, then map resource offsets back into the HTML
  // attribute so untouched comments, strings and entities keep their spelling.
  const entities = [];
  let shift = 0;
  const css = decodeAttribute(raw, (offset, length, decodedLength) => {
    const at = offset - shift;
    shift += length - decodedLength;
    entities.push({ at, shift });
  });
  const edits = await cssEdits(css, file, new Set(), { imports: false });
  if (!edits.length) return [];
  const rawOffset = at => at + (entities.findLast(entity => entity.at < at)?.shift ?? 0);
  const encoded = edits.map(([start, end, value]) => [rawOffset(start), rawOffset(end), esc(value).replace(/'/g, "&#39;")]);
  const source = tag.slice(attr.start, attr.end);
  const quote = /=\s*(["'])?/.exec(source)?.[1];
  const valueStart = attr.end - raw.length - (quote ? 1 : 0);
  if (quote) return encoded.map(([start, end, value]) => [valueStart + start, valueStart + end, value]);
  return [[valueStart, attr.end, '"' + applyEdits(raw, encoded) + '"']];
}

async function stylesheet(url, ancestors) {
  const file = fileURLToPath(url), actual = await realpath(file);
  if (ancestors.has(actual)) return ""; // CSS ignores circular imports.
  const text = await readFile(file, "utf8");
  return applyEdits(text, await cssEdits(text, file, new Set([...ancestors, actual])));
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
    const attrs = new Map([...attributes(tag)].map(([key, value]) => [key, decodeAttribute(value)]));
    if (name === "base" && attrs.has("href") || name === "iframe" && attrs.has("srcdoc") ||
        ["srcset", "imagesrcset"].some(attr => attrs.get(attr))) {
      throw new Error(file + ": unsupported offline resource markup " + tag);
    }
    if (name === "meta" && attrs.get("http-equiv")?.trim().toLowerCase() === "refresh" && local(refreshTarget(attrs.get("content") ?? ""))) {
      throw new Error(file + ": unsupported meta refresh to a local page.");
    }
    if (name === "script" && attrs.get("type")?.trim().toLowerCase() === "module") {
      throw new Error(file + ": bundle module scripts into classic scripts before inlining.");
    }
    if (name === "style" && !(token.namespace !== "html" && /\/>$/.test(tag))) {
      const end = token.contentEnd ?? tags.slice(i + 1).find(t => t.closing && t.name === "style" && t.namespace === token.namespace)?.start;
      if (end === undefined) throw new Error(file + ": unclosed foreign <style>.");
      const text = html.slice(token.end, end);
      const css = await cssEdits(text, file, new Set());
      if (css.length) edits.push([token.end, end, applyEdits(text, css)]);
    }
    const attrsToEdit = [];
    for (const attr of attributeTokens(tag)) {
      const key = attr.name, ref = decodeAttribute(attr.value).trim();
      let replacement;
      if (key === "style" && ref) {
        attrsToEdit.push(...await inlineStyleAttribute(tag, attr, file));
      } else if (key === "src" && name === "script" && local(ref)) {
        replacement = data("text/javascript;charset=utf-8", await readFile(urlFrom(ref, file)));
      } else if (key === "href" && name === "link" && local(ref) && attrs.get("rel")?.toLowerCase().split(/[ \t\r\n\f]+/).includes("stylesheet")) {
        if (attrs.get("integrity")?.trim()) throw new Error(file + ": unsupported integrity metadata on local stylesheet " + ref);
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

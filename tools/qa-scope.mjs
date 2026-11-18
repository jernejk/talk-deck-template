// Scope decisions shared by QA and the integrator's acceptance command.
export function selectSlides(ids, selectors) {
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error("Every section.slide needs a non-empty, unique id.");
  if (selectors === undefined || selectors === null) return [...ids];
  const picks = Array.isArray(selectors) ? selectors : selectors.split(",").map(s => s.trim());
  if (!picks.length || picks.some(p => !p)) throw new Error("--slides needs at least one non-empty selector.");
  const chosen = new Set();
  for (const pick of picks) {
    if (ids.includes(pick)) { chosen.add(pick); continue; }
    const range = /^(\d+)(?:-(\d+))?$/.exec(pick);
    if (!range) throw new Error(`--slides: unknown slide "${pick}".`);
    const from = Number(range[1]), to = Number(range[2] ?? range[1]);
    if (from < 1 || to < from || to > ids.length) throw new Error(`--slides: "${pick}" is outside slides 1–${ids.length}.`);
    for (let n = from; n <= to; n++) chosen.add(ids[n - 1]);
  }
  return ids.filter(id => chosen.has(id));
}

export function* attributeTokens(tag) {
  const pairs = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  pairs.lastIndex = /^<\s*[\w:-]+/.exec(tag)?.[0].length ?? tag.length;
  for (let match; (match = pairs.exec(tag));) {
    const [, name, double, single, bare] = match;
    yield { name: name.toLowerCase(), value: double ?? single ?? bare ?? "", start: match.index, end: pairs.lastIndex };
  }
}

export function attributes(tag) {
  const attrs = new Map();
  for (const { name, value } of attributeTokens(tag)) if (!attrs.has(name)) attrs.set(name, value);
  return attrs;
}

// Retain offsets in the original HTML and skip tag-looking text in raw-text elements.
export function* htmlTags(html, { strict = true } = {}) {
  const tags = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[|<(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  const foreign = [];
  let templateDepth = 0;
  for (let match; (match = tags.exec(html));) {
    const tag = match[0];
    const parent = foreign.at(-1);
    if (tag === "<![CDATA[" && parent && parent.namespace !== "html") {
      const end = html.indexOf("]]>", tags.lastIndex);
      tags.lastIndex = end === -1 ? html.length : end + 3;
      continue;
    }
    const element = /^<\s*(\/\s*)?([a-z][\w:-]*)(?=[\s/>])/i.exec(tag);
    if (!element) continue;
    const [, closing, rawName] = element, name = rawName.toLowerCase();
    const outer = parent?.namespace ?? "html";
    let namespace = outer;
    if (closing) {
      const at = foreign.findLastIndex(node => node.name === name);
      if (at >= 0) namespace = foreign.splice(at)[0].namespace;
    } else {
      // SVG and MathML integration points can contain HTML or a nested foreign subtree.
      if (parent?.htmlChildren || parent?.mathText && !/^(mglyph|malignmark)$/.test(name)) namespace = "html";
      if (namespace === "html" && /^(svg|math)$/.test(name)) namespace = name;
      if (parent?.name === "annotation-xml" && outer === "math" && name === "svg") namespace = "svg";
    }
    const token = { name, namespace, inert: templateDepth > 0, closing: !!closing, tag, start: match.index, end: tags.lastIndex };
    if (namespace === "html" && name === "template") templateDepth = Math.max(0, templateDepth + (closing ? -1 : 1));
    if (!closing && namespace === "html" && /^(script|style|title|textarea)$/.test(name)) {
      const end = new RegExp("</" + name + "(?=[\\t\\n\\f\\r />])" + /(?:[^<>"']|"[^"]*"|'[^']*')*>/.source, "ig");
      end.lastIndex = tags.lastIndex;
      const close = end.exec(html);
      if (!close && strict) throw new Error('Unclosed <' + name + '>.');
      token.contentEnd = close?.index ?? html.length;
      tags.lastIndex = close ? end.lastIndex : html.length;
    } else if (!closing && (parent || namespace !== "html")) {
      const empty = namespace === "html"
        ? /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name)
        : /\/>$/.test(tag);
      if (!empty) {
        const htmlChildren = namespace === "svg" && /^(title|desc|foreignobject)$/.test(name) ||
          namespace === "math" && name === "annotation-xml" && /^(text\/html|application\/xhtml\+xml)$/i.test(attributes(tag).get("encoding") ?? "");
        const mathText = namespace === "math" && /^(mi|mo|mn|ms|mtext)$/.test(name);
        foreign.push({ name, namespace, htmlChildren, mathText });
      }
    }
    yield token;
  }
}

// QA requires a well-formed hierarchy and unique IDs. Authoring also reads
// drafts without IDs and keeps their opening tags and hidden state.
export function slideSections(html, { strict = true } = {}) {
  const stack = [], out = [];
  const record = (open, end) => {
    if (open.slide) out.push({ id: open.id, start: open.start, end, ...(strict
      ? { html: html.slice(open.start, end) }
      : { tag: open.tag, hidden: open.hidden }) });
  };
  for (const token of htmlTags(html, { strict })) {
    if (token.name !== "section" || token.namespace !== "html" || token.inert) continue;
    if (token.closing) {
      if (!/^<\s*\/\s*section\s*>$/i.test(token.tag)) continue;
      const open = stack.pop();
      if (open) record(open, token.end);
      else if (strict) throw new Error("Unmatched </section>.");
    } else {
      const attrs = attributes(token.tag);
      const slide = (attrs.get("class") || "").split(/\s+/).includes("slide");
      if (strict && slide && stack.some(s => s.slide)) throw new Error("A section.slide cannot contain another section.slide.");
      stack.push({ ...token, slide, id: attrs.get("id") || "", hidden: attrs.has("data-hidden") });
    }
  }
  if (strict && stack.length) throw new Error("Unclosed <section>.");
  stack.forEach(open => record(open, html.length));
  out.sort((a, b) => a.start - b.start);
  if (strict) selectSlides(out.map(s => s.id));
  return out;
}

export function outsideSlides(html, owned) {
  const sections = slideSections(html), ids = sections.map(s => s.id);
  for (const id of owned) if (!ids.includes(id)) throw new Error(`Owned slide #${id} is missing.`);
  let out = "", end = 0;
  for (const s of sections.filter(s => owned.includes(s.id))) {
    out += html.slice(end, s.start) + `\u0000OWNED:${s.id}\u0000`;
    end = s.end;
  }
  return out + html.slice(end);
}

export function insertFragment(html, id, fragment) {
  const sections = slideSections(fragment);
  if (sections.length !== 1 || sections[0].id !== id || fragment.slice(0, sections[0].start).trim() || fragment.slice(sections[0].end).trim()) throw new Error(`Return exactly one section.slide with id="${id}" and no other content.`);
  const target = slideSections(html).find(s => s.id === id);
  if (!target) throw new Error(`Slide #${id} is missing.`);
  return html.slice(0, target.start) + sections[0].html + html.slice(target.end);
}

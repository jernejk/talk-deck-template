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

function attribute(tag, key) {
  const m = new RegExp(`\\s${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? m[1] ?? m[2] ?? m[3] : "";
}

// Keep original bytes outside owned sections. Ignore section-looking text in
// comments, scripts and styles; count nested sections rather than truncating them.
export function slideSections(html) {
  const tags = /<!--[\s\S]*?-->|<(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  const stack = [], out = [];
  for (let match; (match = tags.exec(html));) {
    const tag = match[0];
    if (tag.startsWith("<!--")) continue;
    const start = /^<\s*(script|style)\b/i.exec(tag);
    if (start) {
      const end = new RegExp(`<\\/\\s*${start[1]}\\s*>`, "ig");
      end.lastIndex = tags.lastIndex;
      const close = end.exec(html);
      if (!close) throw new Error(`Unclosed <${start[1]}>.`);
      tags.lastIndex = end.lastIndex;
      continue;
    }
    if (/^<\s*section\b/i.test(tag)) {
      const slide = attribute(tag, "class").split(/\s+/).includes("slide");
      if (slide && stack.some(s => s.slide)) throw new Error("A section.slide cannot contain another section.slide.");
      stack.push({ slide, id: attribute(tag, "id"), start: match.index });
    } else if (/^<\s*\/\s*section\s*>/i.test(tag)) {
      const open = stack.pop();
      if (!open) throw new Error("Unmatched </section>.");
      if (open.slide) out.push({ id: open.id, start: open.start, end: tags.lastIndex, html: html.slice(open.start, tags.lastIndex) });
    }
  }
  if (stack.length) throw new Error("Unclosed <section>.");
  out.sort((a, b) => a.start - b.start);
  selectSlides(out.map(s => s.id));
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

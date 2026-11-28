import test from "node:test";
import assert from "node:assert/strict";
import { lint } from "../lint.mjs";

const slide = (id, { layout, notes = "<p><b>0:00–1:00.</b> Line.</p>", body = '<h2 class="title">A <em>b</em></h2>', hidden = false } = {}) =>
  `<section class="slide" id="${id}"${layout ? ` data-layout="${layout}"` : ""}${hidden ? " data-hidden" : ""}>${body}<aside class="notes">${notes}</aside></section>`;
const deck = slides => `<main id="deck">${slides.join("")}</main>`;
const clock = (i, extra = "") => `<p><b>${i}:00–${i + 1}:00.</b> Line.${extra}</p>`;

test("private-data skips loopback but still flags private networks and emails", { timeout: 60000 }, async () => {
  const found = await lint(deck([
    slide("a", { layout: "statement", notes: clock(0, " Point it at <code>http://localhost:5173</code> or 127.0.0.1:8080.") }),
    slide("b", { layout: "media", notes: clock(1, " Our box is 10.1.2.3 and 192.168.0.4.") }),
    slide("c", { layout: "split", notes: clock(2, " Mail jk@corp.io, not me@example.com.") })
  ]));
  const priv = found.filter(w => w.check === "private-data");
  assert.deepEqual(priv.map(w => w.slide), ["b", "c"]);
  assert.match(priv[0].message, /10\.1\.2\.3, 192\.168\.0\.4/);
  assert.match(priv[1].message, /jk@corp\.io$/);
});

test("layout-variety says when untagged slides go unchecked, and still compares tagged neighbours", { timeout: 60000 }, async () => {
  const untagged = await lint(deck([slide("a", { notes: clock(0) }), slide("b", { notes: clock(1) }), slide("x", { hidden: true, notes: clock(9) })]));
  assert.deepEqual(untagged.filter(w => w.check === "layout-variety").map(w => [w.slide, w.message.split(",")[0]]), [[null, "some main slides have no data-layout"]]);
  const partly = await lint(deck([slide("a", { layout: "media", notes: clock(0) }), slide("b", { notes: clock(1) })]));
  assert.deepEqual(partly.filter(w => w.check === "layout-variety").map(w => w.message), untagged.filter(w => w.check === "layout-variety").map(w => w.message), "same message, so a lint baseline sees no new warning");
  const tagged = await lint(deck([slide("a", { layout: "media", notes: clock(0) }), slide("b", { layout: "media", notes: clock(1) }), slide("c", { layout: "split", notes: clock(2) })]));
  assert.deepEqual(tagged.filter(w => w.check === "layout-variety").map(w => w.slide), ["b"]);
  const catalog = await lint(deck([slide("a", { notes: clock(0) }), slide("b", { notes: clock(1) })]), { catalog: true });
  assert.deepEqual(catalog.filter(w => w.check === "layout-variety"), []);
});

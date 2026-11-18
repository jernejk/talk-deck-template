import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, dirname, extname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { chromium, webkit } from "playwright";
import { acquireResourceLock } from "../qa-lock.mjs";
import { readySlide, watchPage } from "../qa-features.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const html = body => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workshop regression</title><script id="deck-config" type="application/json">{"title":"Workshop regression","sections":{"Test":1}}</script><link rel="stylesheet" href="/core/deck.css"><link id="theme" rel="stylesheet" href="/templates/community/theme.css"><link rel="stylesheet" href="/components/components.css"><body>${body}<script src="/core/deck.js"></script><script src="/components/components.js"></script></body></html>`;
const slide = (id, body, attrs = "") => `<section class="slide" id="${id}" data-title="${id}" data-section="Test" ${attrs}><h2 class="title">${id}</h2>${body}</section>`;
const clip = n => `<figure class="video"><video muted loop playsinline preload="none" poster="/slides/assets/sample/demo-poster.png" src="/slides/assets/sample/demo.mp4?clip=${n}"></video></figure>`;
const embed = src => `<figure class="embed" data-step><div class="embed-bar"><span class="embed-url">Local demo</span></div><div class="embed-view"><iframe class="embed-frame" data-src="${src}" title="Workshop example"></iframe></div></figure>`;
const controls = '<textarea id="text"></textarea><select id="select"><option>One</option></select><div contenteditable="true" id="editor"><span id="editable-child">Edit</span></div><div role="slider" tabindex="0" id="slider" aria-valuenow="0" aria-valuemin="0" aria-valuemax="10">Slider</div><div data-deck-interactive tabindex="0" id="custom">Custom editor</div><button id="button">Action</button><a id="link" href="#intro">Link</a><video id="native-video" controls></video><figure class="video"><video id="plain-clip" src="/slides/assets/sample/demo.mp4" muted loop playsinline preload="none"></video></figure><p id="ordinary">Slide body</p>';
const fixture = html(slide("intro", controls) + slide("clips", `<div data-step>${clip(1)}</div><figure class="video" data-step>${clip(2).match(/<video[\s\S]*<\/video>/)[0]}</figure>`) + slide("nested", embed("/child.html")) + slide("live", embed("/child.html").replace(" data-step", ' data-cap="1"').replace('<iframe', '<img class="embed-shot" src="/slides/assets/sample/demo-poster.png" alt="Local fallback"><iframe')) + slide("timed", '<div data-step><span data-type="A long typed workshop example that keeps going." data-delay="1"></span></div><strong data-step data-count="100">100</strong>') + slide("image", '<figure class="shot"><img src="/slides/assets/sample/demo-poster.png" alt="Local screenshot"></figure>') + slide("close", ""));
let browser, safari, server, base, lease;
const sockets = new Set();
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".mp4": "video/mp4", ".woff2": "font/woff2" };
let many, youtube, lifecycle;

test.before(async () => {
  lease = await acquireResourceLock({ kind: process.env.WORKSHOP_TEST_EXCLUSIVE ? "perf" : "qa", slots: 2 });
  const figures = await Promise.all(["video", "player"].map(async name => (await readFile(join(ROOT, `slides/${name}.html`), "utf8")).match(/<figure[\s\S]*?<\/figure>/)[0].replaceAll('="assets/', '="/slides/assets/')));
  youtube = html(slide("youtube", (await readFile(join(ROOT, "slides/youtube.html"), "utf8")).match(/<figure[\s\S]*?<\/figure>/)[0].replaceAll('="assets/', '="/slides/assets/')) + slide("close", ""));
  many = html(slide("intro", "") + Array.from({ length: 12 }, (_, i) => slide(`v${i}`, figures[i % 2].replace("demo.mp4", `demo.mp4?clip=${i}`))).join("") + Array.from({ length: 12 }, (_, i) => slide(`e${i}`, embed(`/child.html?child=${i}`).replace(" data-step", ""))).join("") + Array.from({ length: 36 }, (_, i) => slide(`s${i}`, "", i === 35 ? "data-hidden" : "")).join("") + slide("close", ""));
  const fallback = embed("/child.html").replace('<iframe', '<img class="embed-shot" src="/slides/assets/sample/demo-poster.png" alt="Local fallback"><iframe');
  lifecycle = html(
    slide("timer", '<div class="timer" data-time="0:05" data-autostart></div>') +
    slide("stepped", '<div data-step>' + fallback + '</div>') +
    slide("loading", embed("/slow-demo.html")) +
    slide("scrub", figures[1]) +
    slide("travel", '<svg viewBox="0 0 100 10"><g class="mx-travel" style="--t:4s"><path d="M0 5H100"/><circle r="2"/></g></svg>') +
    slide("extra", "", "data-hidden")
  ).replace('"sections":{"Test":1}', '"sections":{"Test":1},"idle":1');
  server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://fixture.test").pathname);
    if (path === "/lifecycle.html") { res.setHeader("Content-Type", "text/html"); res.end(lifecycle); return; }
    if (path === "/fixture.html" || path === "/many.html" || path === "/youtube.html" || path === "/child.html") { res.setHeader("Content-Type", "text/html"); res.end(path === "/fixture.html" ? fixture : path === "/many.html" ? many : path === "/youtube.html" ? youtube : '<!doctype html><title>Child</title><p>Ready.</p>'); return; }
    const file = resolve(ROOT, "." + path);
    if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { const data = await readFile(file); res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      res.setHeader("Accept-Ranges", "bytes");
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
      if (range) {
        const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
        if (start >= data.length || end < start) { res.writeHead(416).end(); return; }
        res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": end - start + 1 }).end(data.subarray(start, end + 1));
      } else res.end(data); } catch { res.writeHead(404).end(); }
  });
  server.on("connection", s => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  safari = await webkit.launch();
});
test.after(async () => {
  await Promise.all([browser?.close(), safari?.close()]);
  for (const s of sockets) s.destroy();
  if (server) await new Promise(r => server.close(r));
  await lease?.();
});
async function pageFor(t, engine = browser, options = {}) {
  const context = await engine.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce", ...options });
  t.after(() => context.close());
  return context.newPage();
}
const go = async (p, id, end = false) => p.evaluate(([id, end]) => Deck.goTo(document.getElementById(id), { stepMode: end ? "end" : "start" }), [id, end]);

test("compact landscape and portrait keep workshop content reachable without horizontal clipping", async t => {
  for (const engine of [browser, safari]) {
    const p = await pageFor(t, engine);
    await p.goto(`${base}/examples/workshop/index.html?res=auto`);
    for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [915, 412], [932, 430]]) {
      await p.setViewportSize({ width, height });
      for (const id of ["agenda-schedule", "cli-run", "code", "pipeline", "takeaways", "speaker-card"]) {
        await go(p, id, true);
        const result = await p.evaluate(() => {
          const s = Deck.current(); s.scrollTop = 0;
          const title = s.querySelector("h1,h2").getBoundingClientRect();
          const code = s.querySelector(".code ol");
          s.scrollTop = s.scrollHeight;
          const foot = s.querySelector(".slide-foot")?.getBoundingClientRect();
          return { titleTop: title.top, horizontal: s.scrollWidth - s.clientWidth, code: code ? code.scrollWidth - code.clientWidth : 0, footBottom: foot?.bottom ?? 0, height: innerHeight };
        });
        assert.ok(result.titleTop >= -1 && result.horizontal <= 1 && result.code <= 1 && result.footBottom <= result.height + 1, JSON.stringify({ width, height, id, result }));
      }
    }
  }
});

test("reversing a video step resets only the hidden clip; reduced motion stays paused", async t => {
  for (const engine of [browser, safari]) {
    const p = await pageFor(t, engine, { reducedMotion: "no-preference" });
    await p.goto(`${base}/fixture.html?res=auto#clips`);
    await p.evaluate(() => Deck.next());
    await p.waitForFunction(() => !Deck.current().querySelectorAll("video")[0].paused);
    await p.evaluate(() => Deck.next());
    await p.waitForFunction(() => !Deck.current().querySelectorAll("video")[1].paused);
    await p.evaluate(() => Deck.prev());
    const states = await p.locator("#clips video").evaluateAll(v => v.map(x => ({ paused: x.paused, time: x.currentTime })));
    assert.equal(states[0].paused, false); assert.equal(states[1].paused, true); assert.equal(states[1].time, 0);
    await p.waitForTimeout(100);
    assert.equal(await p.locator("#clips video").nth(1).evaluate(v => v.currentTime), 0);
    await p.evaluate(() => Deck.next());
    await p.waitForFunction(() => Deck.current().querySelectorAll("video")[1].currentTime > 0);
    await go(p, "close");
    assert.ok(await p.locator("#clips video").evaluateAll(v => v.every(x => x.paused && x.currentTime === 0)));
    await p.emulateMedia({ reducedMotion: "reduce" });
    await go(p, "clips", true);
    assert.ok(await p.locator("#clips video").evaluateAll(v => v.every(x => x.paused)));
  }
});

test("editable and custom demo controls own keys and swipes; ordinary slide gestures still navigate", async t => {
  for (const engine of [browser, safari]) {
    const p = await pageFor(t, engine);
    await p.goto(`${base}/fixture.html?res=auto`);
    for (const id of ["text", "select", "editable-child", "slider", "custom", "button", "link", "native-video", "plain-clip", "ordinary"]) {
      await go(p, "intro");
      await p.evaluate(id => {
        const el = document.getElementById(id);
        for (const [type, x] of [["touchstart", 220], ["touchend", 40]]) {
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.assign(event, { touches: type === "touchstart" ? [{ clientX: x, clientY: 100 }] : [], changedTouches: [{ clientX: x, clientY: 100 }] }); el.dispatchEvent(event);
        }
      }, id);
      assert.equal(await p.evaluate(() => Deck.current().id), ["ordinary", "plain-clip"].includes(id) ? "clips" : "intro", `swipe on ${id}`);
    }
    for (const id of ["text", "editor", "slider", "custom"]) {
      await go(p, "intro"); await p.locator(`#${id}`).focus(); await p.keyboard.press("ArrowRight");
      assert.equal(await p.evaluate(() => Deck.current().id), "intro", `key on ${id}`);
    }
    await p.locator("#ordinary").evaluate(el => el.closest("section").focus()); await p.keyboard.press("ArrowRight");
    assert.equal(await p.evaluate(() => Deck.current().id), "clips");
  }
});

test("readiness waits only for revealed embeds, then checks live children on every reveal", async t => {
  const p = await pageFor(t); const requests = []; const problems = [], warnings = [];
  p.on("request", req => { if (req.url().includes("child.html")) requests.push(req.url()); });
  const flush = watchPage(p, "step readiness", problems, warnings);
  await p.goto(`${base}/fixture.html?res=auto#nested`);
  await readySlide(p, "nested", 800); assert.equal(requests.length, 0);
  await p.evaluate(() => Deck.next()); await readySlide(p, "nested", 1500); assert.equal(requests.length, 1);
  await p.evaluate(() => Deck.prev()); await readySlide(p, "nested", 800);
  assert.equal(await p.locator("#nested iframe").getAttribute("src"), "about:blank");
  await p.evaluate(() => Deck.next()); await readySlide(p, "nested", 1500); assert.equal(requests.length, 2);
  await p.evaluate(() => { Deck.prev(); document.querySelector("#nested iframe").dataset.src = "/missing-child.html"; Deck.next(); });
  await p.waitForLoadState("networkidle"); await flush();
  assert.ok(problems.some(x => JSON.stringify(x).includes("404")), JSON.stringify(problems));
});

test("62-slide workshop stays lazy on HTTP and offline files; visited trimmed players and embeds still work", async t => {
  for (const name of ["video", "player"]) assert.match(await readFile(join(ROOT, `slides/${name}.html`), "utf8"), /preload="none"/);
  const temp = await mkdtemp(join(tmpdir(), "workshop-offline-")); t.after(() => rm(temp, { recursive: true, force: true }));
  const local = pathToFileURL(ROOT + sep).href;
  await writeFile(join(temp, "child.html"), '<!doctype html><title>Offline child</title><p>Local.</p>');
  await writeFile(join(temp, "index.html"), many.replaceAll('="/', `="${local}`).replaceAll(`${local}child.html`, pathToFileURL(join(temp, "child.html")).href));
  for (const engine of [browser, safari]) for (const [url, offline] of [[`${base}/many.html?res=auto`, false], [pathToFileURL(join(temp, "index.html")).href + "?res=auto", true]]) {
    const p = await pageFor(t, engine); await p.context().setOffline(offline); const requested = [];
    p.on("request", req => { if (req.url().includes("demo.mp4")) requested.push(req.url()); });
    await p.goto(url); await p.waitForTimeout(150);
    assert.equal(await p.locator("section.slide").count(), 62);
    const initialRequests = requested.length;
    const fileHintOnly = offline && engine === safari;
    if (!fileHintOnly) assert.equal(initialRequests, 0);
    else {
      assert.ok(await p.locator("video").evaluateAll(v => v.every(x => x.paused && x.currentTime === 0)));
      console.log(`WebKit file preload hint: ${initialRequests} local media request events before visiting, ready states ${await p.locator("video").evaluateAll(v => v.map(x => x.readyState).join(","))}. HTTP lazy loading is checked separately.`);
    }
    await go(p, "v1"); await p.locator("#v1 video").evaluate(v => { window.videoEvents = []; for (const type of ["play", "pause", "ended", "loadedmetadata", "seeking", "seeked"]) v.addEventListener(type, () => window.videoEvents.push([type, v.currentTime, v.paused])); }); await p.locator("#v1 .player-big").click();
    await p.waitForFunction(() => document.querySelector("#v1 video").currentTime >= 1.05);
    await p.waitForFunction(() => { const v = document.querySelector("#v1 video"); return v.paused && v.currentTime >= 3.9 && v.currentTime <= 4.1; }, null, { timeout: 6000 }).catch(async e => { throw new Error(e.message + JSON.stringify(await p.locator("#v1 video").evaluate(v => ({ time: v.currentTime, paused: v.paused, duration: v.duration, error: v.error?.message, hidden: document.hidden, url: location.href, events: window.videoEvents })))); });
    for (const id of ["e0", "e3", "e7"]) { await go(p, id); if (offline) await p.frameLocator(`#${id} iframe`).locator("p").waitFor(); else await readySlide(p, id); assert.equal(await p.locator('iframe[data-state="on"]').count(), 1); }
    await go(p, "s35"); await p.locator('[data-action="overview"]').click();
    assert.equal(await p.locator("#overview-list button").count(), 62); await p.keyboard.press("Escape");
    await go(p, "intro"); assert.equal(await p.locator('iframe[data-state="on"]').count(), 0);
    assert.ok(await p.locator("video").evaluateAll(v => v.every(x => x.paused)));
    assert.ok(requested.length <= initialRequests + 2, `${requested.length} unexpected video requests`);
    console.log(`Many-media ${offline ? "offline file" : "HTTP"}: 62 slides, ${initialRequests} initial local/media request events, ${requested.length - initialRequests} more for the one visited clip, zero loaded embeds after departure.`);
  }
});


test("phone overlays, expanded demos and expired countdowns stay usable through rotation", async t => {
  for (const engine of [browser, safari]) {
    const p = await pageFor(t, engine);
    await p.goto(`${base}/fixture.html?res=auto#live`);
    for (const [width, height] of [[320, 568], [568, 320], [390, 844], [844, 390], [915, 412], [932, 430]]) {
      await p.setViewportSize({ width, height });
      await go(p, "live");
      await p.locator("#live .embed-toggle").click();
      await p.waitForFunction(() => document.querySelector("#live .embed").classList.contains("is-over"));
      const bar = await p.locator("#live .embed-bar").evaluate(el => ({ width: el.scrollWidth - el.clientWidth, back: el.querySelector(".embed-toggle").getBoundingClientRect().toJSON() }));
      assert.ok(bar.width <= 1 && bar.back.left >= 0 && bar.back.right <= width + 1 && bar.back.top >= 0 && bar.back.bottom <= height, JSON.stringify({ width, height, bar }));
      await p.setViewportSize({ width: height, height: width });
      await p.locator("#live .embed-toggle").click();
      assert.equal(await p.locator("#live .embed.is-live").count(), 0);
      await p.locator('[data-action="notes"]').click(); await p.keyboard.press("Escape");
      assert.equal(await p.locator("#notes-panel.is-open").count(), 0);
      await p.locator('[data-action="options"]').click(); await p.keyboard.press("Escape");
      assert.equal(await p.locator("#deck-options").isVisible(), false);
      await p.locator('[data-action="overview"]').click();
      assert.equal(await p.locator("#overview").evaluate(el => el.contains(document.activeElement)), true);
      await p.keyboard.press("Escape");
      await p.waitForFunction(() => document.activeElement.dataset.action === "overview");
      await go(p, "image"); await p.locator("#image .image-zoom").click();
      await p.locator('[data-action="next"]').evaluate(el => el.focus());
      assert.equal(await p.locator("#image-viewer").evaluate(el => el.contains(document.activeElement)), true);
      await p.keyboard.press("Escape");
      await p.waitForFunction(() => document.activeElement.classList.contains("image-zoom"));
    }
  }
});


test("typed reveals and counters stop on reverse and start only when revealed", async t => {
  const p = await pageFor(t, browser, { reducedMotion: "no-preference" });
  await p.goto(`${base}/fixture.html?res=auto#timed`);
  await p.evaluate(() => Deck.next());
  await p.waitForFunction(() => document.querySelector("#timed [data-type]").textContent.length > 0);
  await p.evaluate(() => Deck.prev());
  const before = await p.locator("#timed [data-type]").textContent();
  await p.waitForTimeout(180);
  assert.equal(await p.locator("#timed [data-type]").textContent(), before);
  assert.equal(await p.locator("#timed [data-type].is-typing").count(), 0);
  assert.equal(await p.locator("#timed [data-count]").textContent(), "100");
  await p.evaluate(() => { Deck.next(); Deck.next(); });
  await p.waitForFunction(() => Number(document.querySelector("#timed [data-count]").textContent) > 0 && Number(document.querySelector("#timed [data-count]").textContent) < 100);
  await p.evaluate(() => Deck.prev());
  const count = await p.locator("#timed [data-count]").textContent();
  await p.waitForTimeout(180);
  assert.equal(await p.locator("#timed [data-count]").textContent(), count);
});


test("YouTube Play creates an HTTP embed and opens a file fallback without script errors", async t => {
  const temp = await mkdtemp(join(tmpdir(), "workshop-youtube-")); t.after(() => rm(temp, { recursive: true, force: true }));
  await writeFile(join(temp, "index.html"), youtube.replaceAll('="/', `="${pathToFileURL(ROOT + sep).href}`));
  for (const engine of [browser, safari]) for (const [url, disk] of [[`${base}/youtube.html?res=auto`, false], [pathToFileURL(join(temp, "index.html")).href + "?res=auto", true]]) {
    const p = await pageFor(t, engine); const errors = [];
    await p.context().route("https://**/*", route => route.abort());
    p.on("pageerror", e => errors.push(e.message)); await p.goto(url);
    if (disk) {
      const popup = p.waitForEvent("popup", { timeout: 3000 });
      await p.locator("#youtube .player-big").click();
      await (await popup).close();
      assert.equal(await p.locator("#youtube iframe").count(), 0);
    } else {
      await p.locator("#youtube .player-big").click();
      assert.equal(await p.locator('#youtube iframe[src^="https://www.youtube-nocookie.com/embed/"]').count(), 1);
    }
    assert.deepEqual(errors, []);
  }
});

test("a step on the video element itself starts and stops on reveal and reverse", async t => {
  const p = await pageFor(t, browser, { reducedMotion: "no-preference" });
  await p.goto(`${base}/fixture.html?res=auto#clips`);
  await p.evaluate(() => { const fig = document.querySelectorAll("#clips figure.video")[1]; fig.removeAttribute("data-step"); fig.querySelector("video").setAttribute("data-step", ""); });
  await p.evaluate(() => { Deck.next(); Deck.next(); });
  await p.waitForFunction(() => !document.querySelectorAll("#clips video")[1].paused, null, { timeout: 1500 });
  await p.evaluate(() => Deck.prev());
  assert.equal(await p.locator("#clips video").nth(1).evaluate(v => v.paused && v.currentTime === 0), true);
});

test("a refused autoplay leaves native play controls available", async t => {
  const p = await pageFor(t, browser, { reducedMotion: "no-preference" });
  await p.goto(`${base}/fixture.html?res=auto#clips`);
  await p.locator("#clips video").first().evaluate(v => { v.play = () => Promise.reject(new DOMException("Blocked by policy", "NotAllowedError")); });
  await p.evaluate(() => Deck.next());
  await p.waitForFunction(() => document.querySelector("#clips video").controls, null, { timeout: 1000 });
  assert.equal(await p.locator("#clips video").first().evaluate(v => v.muted && v.paused), true);
});

test("deep links enter the requested main or extra slide before an autostart timer", async t => {
  for (const [hash, id] of [["#stepped", "stepped"], ["#6", "extra"], ["#extra", "extra"]]) {
    const p = await pageFor(t);
    await p.goto(base + "/lifecycle.html" + hash);
    assert.equal(await p.evaluate(() => Deck.current().id), id);
    assert.equal(await p.evaluate(() => location.hash), hash);
    assert.match(await p.locator("#timer .timer button").first().textContent(), /Start/);
    await go(p, "timer");
    assert.match(await p.locator("#timer .timer button").first().textContent(), /Pause/);
    await p.close();
  }
});

test("global Live tracks nested reveals and pending iframe unload survives slide leave", async t => {
  for (const [engine, viewport, theme] of [
    [browser, { width: 1920, height: 1080 }, "community"],
    [safari, { width: 390, height: 844 }, "paper"]
  ]) {
    const p = await pageFor(t, engine, { viewport, hasTouch: viewport.width < 400 });
    await p.route("**/slow-demo.html", () => {}); // Hold navigation beyond both unload calls.
    await p.goto(base + "/lifecycle.html?theme=" + theme + "#stepped");
    const live = p.locator(".deck-nav button").filter({ hasText: /^Live/ });
    const fallbackFrame = p.locator("#stepped iframe");
    assert.equal(await live.isHidden(), true);
    await p.keyboard.press("l");
    assert.equal(await fallbackFrame.getAttribute("src"), null);
    await p.evaluate(() => Deck.next());
    assert.equal(await live.isHidden(), true);
    await p.evaluate(() => Deck.next());
    assert.equal(await live.isVisible(), true);
    await p.keyboard.press("l");
    assert.equal(await live.getAttribute("aria-pressed"), "true");
    await p.evaluate(() => Deck.prev());
    assert.equal(await live.isHidden(), true);
    assert.equal(await live.getAttribute("aria-pressed"), "false");
    await p.evaluate(() => Deck.next());
    await live.click();
    assert.equal(await live.getAttribute("aria-pressed"), "true");
    await go(p, "loading");
    await p.evaluate(() => { Deck.next(); Deck.prev(); Deck.next(); Deck.prev(); Deck.goTo(document.querySelector("#scrub")); });
    const frame = p.locator("#loading iframe");
    assert.equal(await frame.getAttribute("data-state"), "unload");
    await p.waitForFunction(() => document.querySelector("#loading iframe").getAttribute("src") === "about:blank");
  }
});

test("player cancellation repaints progress, ignores other pointers and keeps focus on the active slide", async t => {
  for (const engine of [browser, safari]) {
    const p = await pageFor(t, engine);
    await p.goto(base + "/lifecycle.html#scrub");
    const result = await p.evaluate(async () => {
      const slide = Deck.current(), seek = slide.querySelector(".player-seek"), video = slide.querySelector("video");
      const event = (target, type, pointerId) => target.dispatchEvent(new PointerEvent(type, { pointerId, bubbles: true, button: 0 }));
      video.preload = "auto";
      if (video.readyState === 0) await new Promise(resolve => video.addEventListener("loadedmetadata", resolve, { once: true }));
      seek.focus();
      event(seek, "pointerdown", 11);
      event(window, "pointerup", 22);
      video.currentTime = 2;
      video.dispatchEvent(new Event("seeked"));
      const during = seek.value;
      event(window, "pointercancel", 11);
      const cancelled = [seek.value, seek.getAttribute("aria-valuetext"), parseFloat(seek.style.getPropertyValue("--p")), document.activeElement === seek];
      event(seek, "pointerdown", 33);
      Deck.goTo(document.querySelector("#stepped"));
      event(window, "pointerup", 33);
      return { during, cancelled, inactiveFocused: document.activeElement === slide };
    });
    assert.equal(result.during, "0");
    const [value, a11y, progress, seekFocused] = result.cancelled;
    assert.equal(value, "1");
    assert.equal(a11y, "0:01 / 0:03");
    assert.ok(progress > 33 && progress < 34);
    assert.equal(seekFocused, true);
    assert.equal(result.inactiveFocused, false);
  }
});

test("travelling SVG dots suspend at idle, wake at the same phase, and park on reduced motion", async t => {
  const p = await pageFor(t, browser, { reducedMotion: "no-preference" });
  await p.clock.install();
  await p.goto(base + "/lifecycle.html#travel");
  const dot = p.locator(".mx-travel circle");
  await p.clock.runFor(430);
  const moving = await dot.getAttribute("transform");
  assert.notEqual(moving, "translate(0.0 5.0)");
  await p.clock.fastForward(5000);
  assert.ok(await p.locator("html").evaluate(el => el.classList.contains("is-resting")));
  const rested = await dot.getAttribute("transform");
  await p.clock.runFor(250);
  assert.equal(await dot.getAttribute("transform"), rested);
  await p.evaluate(() => document.dispatchEvent(new Event("pointermove")));
  await p.clock.runFor(16);
  assert.equal(await dot.getAttribute("transform"), rested);
  await p.clock.runFor(150);
  assert.notEqual(await dot.getAttribute("transform"), rested);
  async function changeMotion(reducedMotion) {
    await p.evaluate(() => {
      window.motionChanged = new Promise(resolve => {
        matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => resolve(true), { once: true });
      });
    });
    await p.emulateMedia({ reducedMotion });
    await p.evaluate(() => window.motionChanged);
  }
  await changeMotion("reduce");
  await p.clock.runFor(100);
  assert.equal(await dot.getAttribute("transform"), "translate(50.0 5.0)");
  await changeMotion("no-preference");
  await p.clock.runFor(150);
  assert.notEqual(await dot.getAttribute("transform"), "translate(50.0 5.0)");
  await go(p, "scrub");
  const left = await dot.getAttribute("transform");
  await p.clock.runFor(150);
  assert.equal(await dot.getAttribute("transform"), left);
});

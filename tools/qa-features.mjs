// Feature checks run once per deck/browser, never in the template × size matrix.
export async function inspectDeck(html, browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const config = JSON.parse(doc.getElementById("deck-config")?.textContent || "{}");
      return {
        resolution: config.resolution ?? "auto",
        slides: [...doc.querySelectorAll("section.slide")].map(s => ({
          id: s.id,
          features: [".embed, iframe", "video", ".zoom", ".player"].filter(sel => s.querySelector(sel)),
          posters: [...s.querySelectorAll("video[poster]")].map(v => v.getAttribute("poster")),
          qr: !!s.querySelector("a.close-qr, a.qr-link")
        }))
      };
    }, html);
  } finally { await page.close(); }
}

export function featureScope(info, selectedIds) {
  const selected = info.slides.filter(s => selectedIds.includes(s.id));
  const featureIds = selected.filter(s => s.features.length).map(s => s.id);
  const host = info.resolution !== "auto" || featureIds.length > 0;
  return { relevant: host, ids: featureIds.length ? featureIds : host ? selectedIds.slice(0, 1) : [], posterIds: selected.filter(s => s.posters.length).map(s => s.id) };
}

// Reproduced on a bare <video controls> page, without this engine, in macOS
// Playwright WebKit mobile contexts. Keep these diagnostics visible; never
// classify an application console location or other native error this way.
export function nativeWebkitControlDiagnostic(message) {
  return message.type() === "error" && message.location().url === "" &&
    /^Button failed to load, iconName = (invalid|pip|airplay)-placard, layoutTraits = \[MacOSLayoutTraits Inline\], src = blob:https?:\/\/\S+$/.test(message.text());
}

export function watchPage(page, where, problems, warnings = [], nativeWebkitControls = false) {
  const errors = [], requests = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (nativeWebkitControls && nativeWebkitControlDiagnostic(m)) warnings.push({ where, check: "webkit-native-controls", message: m.text() });
    else if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", request => {
    const error = request.failure()?.errorText ?? "unknown failure";
    const cancelled = /^(?:net::)?ERR_ABORTED$|^cancelled$/i.test(error);
    const expected = async () => {
      if (!cancelled) return false;
      const owner = request.frame();
      if (request.resourceType() === "media" && !owner.isDetached() && await owner.evaluate(url => [...document.querySelectorAll("video")].some(v => v.currentSrc === url && v.readyState >= 1 && !v.error), request.url())) return "decoded video metadata";
      return false;
    };
    let timer;
    requests.push(Promise.race([expected().catch(() => false), new Promise(r => { timer = setTimeout(() => r(false), 1000); })]).then(isExpected => {
      clearTimeout(timer);
      if (isExpected) warnings.push({ where, check: "expected-request-cancellation", message: `${isExpected}: cancelled ${request.url()} (${error})` });
      else errors.push(`failed: ${request.url()} (${error})`);
    }));
  });
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  return async () => { await Promise.all(requests); if (errors.length) problems.push({ where, errors: [...new Set(errors.splice(0))] }); };
}

export async function lateErrors(page) {
  try { await page.waitForLoadState("networkidle", { timeout: 1500 }); return "networkidle"; }
  catch { return "bounded-timeout"; }
}

// Wait for active lazy frames, their nested same-origin documents and video
// metadata. about:blank and a completed HTTP error page do not mean ready.
export async function readySlide(frame, id, timeout = 4000) {
  try {
    await frame.waitForFunction(id => {
      const slide = document.getElementById(id);
      if (!slide || window.Deck?.current()?.id !== id) return false;
      let count = 0;
      const ready = (root, depth) => {
        if (depth > 8) return false;
        const hiddenStep = el => el.ownerDocument === slide.ownerDocument && el.closest("[data-step]:not(.is-shown)");
        for (const el of root.querySelectorAll("iframe")) {
          if (hiddenStep(el)) continue;
          if (++count > 32) return false;
          const expected = el.getAttribute("data-src") || el.getAttribute("src");
          if (!expected || expected === "about:blank") continue;
          const embed = el.closest(".embed");
          if (embed?.querySelector(".embed-shot") && !embed.classList.contains("is-live")) continue;
          if (el.matches(".embed-frame") && el.dataset.state !== "on") return false;
          try {
            const doc = el.contentDocument;
            if (!doc || doc.URL === "about:blank" || doc.readyState !== "complete" || !ready(doc, depth + 1)) return false;
          } catch { return false; }
        }
        return [...root.querySelectorAll("video")].every(v => {
          if (hiddenStep(v)) return true;
          // Probe lazy media in this QA context, including nested documents.
          // Changing the hint starts metadata loading without load() aborting
          // an existing request. Runtime/perf still uses the authored policy.
          if (v.preload === "none" && v.readyState === 0 && !v.error) v.preload = "metadata";
          return !v.error && v.readyState >= 1;
        });
      };
      return ready(slide, 0);
    }, id, { timeout });
  } catch {
    const videos = await frame.evaluate(id => [...(document.getElementById(id)?.querySelectorAll("video") || [])].map(v => ({ src: v.currentSrc || v.src, readyState: v.readyState, networkState: v.networkState, error: v.error?.message ?? null })), id).catch(() => []);
    throw new Error(`#${id}: embed/nested-document/video readiness did not complete within ${timeout} ms (same-origin, depth ≤8, frames ≤32).${videos.length ? ` Videos: ${JSON.stringify(videos)}` : ""}`);
  }
}

export async function decodePosters(frame, ids) {
  return frame.evaluate(async ids => {
    const results = [];
    for (const id of ids) for (const video of document.getElementById(id).querySelectorAll("video[poster]")) {
      const poster = video.getAttribute("poster");
      let timer;
      try {
        await Promise.race([
          (async () => {
            if (!poster?.trim()) throw new Error("empty poster");
            const url = new URL(poster, document.baseURI).href;
            const response = await fetch(url);
            if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
            const image = new Image();
            image.src = url;
            await image.decode();
            if (!image.naturalWidth || !image.naturalHeight) throw new Error("zero decoded size");
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("decode timed out after 4000 ms")), 4000); })
        ]);
        results.push({ slide: id, poster, passed: true });
      } catch (e) { results.push({ slide: id, poster, passed: false, error: e.message }); }
      finally { clearTimeout(timer); }
    }
    return results;
  }, ids);
}

async function hostFrame(page, url, touch) {
  await page.goto(url, { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("iframe.res-frame").length === 1, null, { timeout: 4000 });
  const handle = await page.$("iframe.res-frame"), frame = await handle.contentFrame();
  if (!frame) throw new Error("Forced-resolution frame has no document.");
  await frame.waitForFunction(() => !!window.Deck?.current(), null, { timeout: 4000 });
  const shape = await frame.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, framed: new URL(location.href).searchParams.get("framed") }));
  if (shape.width !== 1920 || shape.height !== 1080 || shape.framed !== "1") throw new Error(`Forced-resolution frame geometry is ${JSON.stringify(shape)}, expected 1920×1080 framed=1.`);
  if (touch) {
    const meta = await page.evaluate(() => ({ content: document.querySelector('meta[name="viewport"]')?.content, transform: document.querySelector(".res-frame").style.transform, coarse: matchMedia("(pointer: coarse)").matches }));
    if (!meta.coarse || !meta.content?.includes("minimum-scale=") || /scale\(/.test(meta.transform)) throw new Error(`Touch host did not use native viewport scaling: ${JSON.stringify(meta)}`);
  }
  return frame;
}

async function visit(page, frame, ids) {
  for (const id of ids) {
    await page.evaluate(id => { location.hash = id; }, id);
    await frame.waitForFunction(id => window.Deck?.current()?.id === id, id, { timeout: 4000 });
    await frame.evaluate(id => Deck.goTo(document.getElementById(id), { stepMode: "end" }), id);
    await frame.evaluate(id => document.getElementById(id).querySelectorAll(".embed:not(.is-live)").forEach(fig => { if (fig.querySelector(".embed-shot")) fig.querySelector(".embed-toggle")?.click(); }), id);
    await readySlide(frame, id);
    // Dynamic embed scripts can request images after document.readyState turns
    // complete. Do not unload that frame while its initial requests are active.
    await lateErrors(page);
  }
}

async function lifecycle(page, frame, browserName, ids) {
  const id = ids[0];
  await visit(page, frame, [id]);
  const before = await frame.evaluate(() => ({ id: Deck.current().id, hash: location.hash }));
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
      await cdp.send("Page.setWebLifecycleState", { state: "active" });
    } finally { await cdp.detach(); }
  }
  await frame.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await readySlide(frame, id);
  const after = await frame.evaluate(() => ({ id: Deck.current().id, hash: location.hash }));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Lifecycle changed the active slide/hash: ${JSON.stringify({ before, after })}`);
  return browserName === "chromium" ? "CDP frozen/active plus synthetic events" : "synthetic events only";
}

async function zoomGuard(page, frame) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await page.waitForFunction(() => Deck.previewZoomed(), null, { timeout: 2000 });
    const id = await frame.evaluate(() => Deck.current().id);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 290, y: 180 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 90, y: 180 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    if (await frame.evaluate(() => Deck.current().id) !== id) throw new Error("A swipe navigated while the host was pinch-zoomed.");
    return "visualViewport zoom observed; CDP swipe kept active slide";
  } finally { await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }); await cdp.detach(); }
}

export async function checkFeatures({ browser, browserName, deck, base, scope }) {
  const found = { problems: [], warnings: [], checks: [], checkedIds: scope.ids, completed: true };
  if (!scope.relevant) { found.checks.push({ check: "features", state: "not-applicable", reason: "No resolution/embed/video/zoom/player feature in scope." }); return found; }
  const where = `${deck.name} features ${browserName}`;
  const url = `${base}${deck.path}?res=1920x1080&theme=${encodeURIComponent(deck.themes[0])}`;
  // Reuse one page at a time, so each feature task consumes one reserved slot.
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: touch ? { width: 393, height: 852 } : { width: 1280, height: 720 }, reducedMotion: "reduce", ...(touch ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const flush = watchPage(page, `${where} ${touch ? "touch" : "host"}`, found.problems, found.warnings, browserName === "webkit" && touch);
    try {
      const frame = await hostFrame(page, url, touch);
      found.checks.push({ check: touch ? "touch-host" : "host", state: "passed" });
      await visit(page, frame, scope.ids);
      found.checks.push({ check: "nested-readiness", state: "passed", slides: scope.ids, touch });
      if (!touch) {
        const posters = await decodePosters(frame, scope.posterIds);
        found.checks.push({ check: "posters", state: posters.every(p => p.passed) ? "passed" : "failed", posters });
        for (const p of posters.filter(p => !p.passed)) found.problems.push({ where: `${where} #${p.slide}`, check: "poster-decode", errors: [`${p.poster}: ${p.error}`] });
        const mode = await lifecycle(page, frame, browserName, scope.ids);
        found.checks.push({ check: "lifecycle", state: "passed", mode });
      } else if (browserName === "chromium") {
        found.checks.push({ check: "zoom-guard", state: "passed", mode: await zoomGuard(page, frame) });
      } else found.checks.push({ check: "zoom-guard", state: "unverified", reason: "No CDP pinch control in Playwright WebKit; physical pinch remains manual." });
      found.checks.push({ check: "late-errors", state: await lateErrors(page), touch });
    } catch (e) { found.problems.push({ where, check: touch ? "touch-contract" : "host-contract", errors: [e.message] }); found.completed = false; }
    finally { await flush(); await context.close(); }
  }
  return found;
}

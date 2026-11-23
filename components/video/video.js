const videosIn = root => root.matches?.(".video video") ? [root] : [...root.querySelectorAll(".video video")];
const states = new WeakMap();
let activeDeck;
const eligible = (v, deck) => v.closest(".slide") === deck.current() && !v.closest("[data-step]:not(.is-shown)");
const blocked = deck => deck.reducedMotion() || document.documentElement.classList.contains("is-resting");
function stateFor(v) {
  if (states.has(v)) return states.get(v);
  const s = { owned: false, suspended: false, pending: false, version: 0, pauses: 0 };
  states.set(v, s);
  v.addEventListener("pause", () => {
    if (s.pauses) { s.pauses--; return; }
    s.owned = s.suspended = false;
    s.version++;
  });
  // A user start after fallback controls were exposed belongs to the user.
  v.addEventListener("play", () => {
    if (!s.pending) s.owned = s.suspended = false;
  });
  return s;
}
function pause(v, s) {
  if (!v.paused) { s.pauses++; v.pause(); }
}
function start(v, deck, s) {
  if (!eligible(v, deck) || blocked(deck) || s.pending) return;
  const version = ++s.version;
  s.owned = s.pending = true;
  s.suspended = false;
  v.muted = true;
  v.play().then(() => {
    if (version !== s.version || !eligible(v, deck) || (v.loop && blocked(deck))) {
      pause(v, s);
      if (!eligible(v, deck)) v.currentTime = 0;
    }
  }).catch(e => {
    if (version !== s.version) return;
    s.owned = s.suspended = false;
    if (e.name === "NotAllowedError") v.controls = true;
    else if (e.name !== "AbortError") console.error(`Video didn't start: ${e.message}`);
  }).finally(() => {
    s.pending = false;
    if (s.suspended && s.owned && eligible(v, deck) && !blocked(deck)) start(v, deck, s);
  });
}
function play(root, deck) {
  activeDeck = deck;
  videosIn(root).forEach(v => {
    const s = stateFor(v);
    if (!eligible(v, deck)) return;
    if (blocked(deck)) { s.owned = s.suspended = v.loop && v.muted; return; }
    if (s.pending) { s.owned = s.suspended = true; return; }
    start(v, deck, s);
  });
}
function reconcile(deck) {
  if (!deck) return;
  videosIn(deck.current()).forEach(v => {
    const s = stateFor(v);
    if (!s.owned || !v.loop || !v.muted) return;
    if (blocked(deck)) {
      if (!v.paused || s.pending) { s.suspended = true; s.version++; pause(v, s); }
    } else if (s.suspended && eligible(v, deck)) start(v, deck, s);
  });
}
function stop(root) {
  videosIn(root).forEach(v => {
    const s = stateFor(v);
    s.version++; s.owned = s.suspended = false;
    pause(v, s); v.currentTime = 0;
  });
}
Deck.use({
  name: "video",
  enter(slide, deck) { play(slide, deck); },
  step(els, slide, deck) { els.forEach(el => play(el, deck)); },
  rest(slide, deck) { reconcile(deck); },
  wake(slide, deck) { reconcile(deck); },
  motion() { reconcile(activeDeck); },
  unstep(els) { els.forEach(stop); },
  leave(slide) { stop(slide); }
});

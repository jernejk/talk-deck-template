const LABELS = { queued: "Queued", thinking: "Thinking", coding: "Coding", blocked: "Blocked", done: "Done" };
const POSES = { queued: "wave", thinking: "thinking", coding: "coding", blocked: "facepalm", done: "wave" };

function sync(slide, deck, hop) {
  slide.querySelectorAll(".agent").forEach(agent => {
    const lines = Array.from(agent.querySelectorAll(".agent-log [data-state]"));
    const now = lines.filter(li => !li.closest("[data-step]:not(.is-shown)")).pop();
    lines.forEach(li => li.classList.toggle("is-now", li === now));
    const state = now?.dataset.state || "queued";
    agent.dataset.state = state;
    agent.querySelector(".agent-state").textContent = LABELS[state] || state;
    const pet = agent.querySelector(".pet");
    const pose = now?.dataset.pose || POSES[state] || "wave";
    if (!pet || pet.dataset.pose === pose) return;
    pet.dataset.pose = pose;
    if (hop && !deck.reducedMotion()) pet.animate([{ translate: "0 0" }, { translate: "0 -12%" }, { translate: "0 0" }], { duration: 380, easing: "ease-out" });
  });
}

Deck.use({
  name: "agents",
  init(slide, deck) {
    slide.querySelectorAll(".agent").forEach(agent => {
      if (agent.querySelector(".agent-state")) return;
      const chip = document.createElement("span");
      chip.className = "agent-state";
      (agent.querySelector(".agent-head") || agent).append(chip);
    });
    sync(slide, deck, false);
  },
  enter(slide, deck) { sync(slide, deck, false); },
  step(els, slide, deck) { sync(slide, deck, true); },
  unstep(els, slide, deck) { sync(slide, deck, true); }
});

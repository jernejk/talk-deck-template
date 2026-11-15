---
name: deck-story
description: Shape a talk deck into a story that people remember, not a list of slides. Use when the user says "make it flow", "the start needs more punch", "it's too wordy", "how do I lead into the demo", "make it more interesting", "it feels like a list", "less text, more show", or after a first draft and before the polish. Covers the one idea, the arc from hook to close, the bridge between slides, show-not-tell, delight that stays light, fitting the room, and honesty.
---

# Shape the story

The tools make a deck look right. This skill makes it land. The audience must leave with one idea that they can use, and each slide must move them toward it.

## Read first

- The deck's `PRESENTER.md`: the audience, the slot, the venue and the decisions so far.
- `AGENTS.md`, sections "Rules" and "Telling the story".
- `arc.md` in this folder: a real 13-minute talk, slide by slide, with the job of each slide.

## 1. Find the one idea

Write one sentence: what the audience can do or believe after the talk that they could not before. Put it at the top of `PRESENTER.md`. Test each main slide against it. A slide that does not serve it becomes a presenter extra (`data-hidden`) or goes.

## 2. Build the arc

A good default for a 10 to 20 minute talk:

1. **Hook**, in the first minute: the most surprising real thing you have. A clip, a number, a confession or a joke on yourself. Not the agenda, not the bio.
2. **Stakes**: what it took, or what goes wrong without it, with real numbers.
3. **Speaker**: one breath, after the hook.
4. **The problem, felt**: show the pain before you name the fix. An animated mess beats a bullet that says "it is hard".
5. **The turn**: the fix in one line.
6. **How it works**: the smallest demo that proves it (`deck-demo`).
7. **Proof**: real results, and one thing that went wrong.
8. **Takeaway**: one thing to adopt, written as an action.
9. **The way in**: a link or a QR to the thing they can take today.
10. **Close**: thanks, socials and the slides QR. Put a bonus after it for when there is time.

A workshop changes the middle, not the hook or the close.

## 3. Bridge every slide

End each slide's notes with the line that leads into the next slide, so the next slide answers a question the room now has. Then read the titles in order, in the route table (`npm run route`) or the overview (O). They must read as a story without the slides.

## 4. Show, don't tell

Look at each main slide. If it has more than about 25 visible words or more than three items, change it:

- a screenshot or a short clip of the real thing;
- a drawn app (`.threads`, `.mock`, `.composer`, `.cli`) or an animated simulation (`deck-demo`);
- one big number that counts up (`data-count`), or a before and after;
- reveals on Space (`data-step`), so the room reads one thing at a time.

The words that you take off the slide go into the notes.

## 5. Make it feel alive

- Give each section one moment of delight: a reveal, a number that counts up, a pet or mascot pose, a small motion.
- Keep backgrounds quiet and in the theme's colours. Nothing busy behind text.
- One line of humour on yourself works better than three jokes. A gag must read as a gag.
- Motion must earn its cost. The deck runs for an hour on a laptop or a phone (`deck-perf`).

## 6. Fit the room

- Speak to what this room cares about. At a meetup about a tool, lead with that tool.
- Make the content big for the back row. Use the vertical space, and check the deck at the projector size (`?res=1920x1080`).
- Fit the clocks to the slot with a minute spare. Write in `PRESENTER.md` which slides to skip if you run long.

## 7. Stay honest

You can tidy the story: simulate a demo, round a number, move a time or rename a project. The slide or the notes must say so, and `PRESENTER.md` "What's real" must list it. Never invent a result.

## Done when

- The one-idea sentence is in `PRESENTER.md`, and each main slide serves it.
- The titles read as a story in order.
- Each slide's notes end with a bridge to the next slide.
- No main slide is a paragraph or a long list.
- Then use `deck-coach` to show the draft, and `deck-check` before you call it done.

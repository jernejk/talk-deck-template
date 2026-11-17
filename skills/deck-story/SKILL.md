---
name: deck-story
description: Shape a talk deck into a story that people remember, not a list of slides. Use when the user says "make it flow", "the start needs more punch", "it's too wordy", "how do I lead into the demo", "make it more interesting", "it feels like a list", "less text, more show", or after a first draft and before the polish. Covers the one idea, the arc from hook to close, each slide's job and bridge, open loops (mystery boxes), dense-but-calm diagrams, show-not-tell, delight that stays light, fitting the room, and honesty.
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

## 3. Give every slide a job, and bridge it

Before a slide earns its place, write its job in one line: what the room should take away, and why it comes now. The job is the second sentence of the notes, after the clock. If you can't write it, the slide has no job: cut it, or merge it into a neighbour.

- **Split** a slide that does two jobs. Two or three short slides read faster than one crowded one.
- **Merge** neighbours that do one job between them, and then tell the point once.
- End each slide's notes with the line that leads into the next slide, so the next slide answers a question the room now has.

Then read the titles in order, in the route table (`npm run route`) or the overview (O). They must read as a story without the slides.

## 4. Open loops: plant a mystery, pay it off

People stay with a talk when it leaves a question open. Show the result before you show how it works, and let the "how" arrive slide by slide.

- **The hook as the mystery box.** Open with the finished thing working: the run, the number, the report. Don't explain it yet. The middle of the talk opens the box.
- **Tease, build, reveal.** Show a detail a few slides early without its explanation, such as a strange line in the output or a badge on a screenshot. Build up to it, then call back: "Remember this line? Here is where it comes from."
- **Keep it subtle.** No literal boxes or question marks. Show the effect now and the cause later.
- **Pay off every loop.** Keep a short "Open loops" table in `PRESENTER.md`: what you plant, on which slide, and where you pay it off. Hold at most two or three loops open at once. A loop that is never paid off feels like a mistake.

## 5. Show, don't tell

Look at each main slide. If it has more than about 25 visible words or more than three items, change it:

- a screenshot or a short clip of the real thing;
- a drawn app (`.threads`, `.mock`, `.composer`, `.cli`) or an animated simulation (`deck-demo`);
- one big number that counts up (`data-count`), or a before and after;
- reveals on Space (`data-step`), so the room reads one thing at a time.

The words that you take off the slide go into the notes.

### Dense, but calm

A slide can hold a lot of information without feeling crowded, if it has one place to look first:

- **One focal point.** The thing you are talking about is bright and large. Everything else is quieter: muted, smaller, thinner lines. Context can stay on screen without getting in the way.
- **A picture for each mechanism.** When you explain how something works, draw it: boxes, arrows and the data that moves between them. Bullets are for lists, not for how things work.
- **Reveal in the order you speak.** Use `data-step` to build a diagram one part at a time. The final frame can be dense because the room watched it grow.
- **Label in place.** Put labels next to the thing they name. Avoid legends and footnotes.
- **Motion that explains.** Animate what really moves: a request travelling a pipeline, a loop going round, a gate closing. Use the `motion` component (`docs/motion.md`). Drop motion that is only decoration.
- **Reuse a diagram.** Draw the system once, then come back to the same drawing with a different part lit. The room learns the map once and then follows you around it.

## 6. Make it feel alive

- Give each section one moment of delight: a reveal, a number that counts up, a pet or mascot pose, a small motion.
- Keep backgrounds quiet and in the theme's colours. Nothing busy behind text.
- One line of humour on yourself works better than three jokes. A gag must read as a gag.
- Motion must earn its cost. The deck runs for an hour on a laptop or a phone (`deck-perf`).

## 7. Fit the room

- Speak to what this room cares about. At a meetup about a tool, lead with that tool.
- Make the content big for the back row. Use the vertical space, and check the deck at the projector size (`?res=1920x1080`).
- Fit the clocks to the slot with a minute spare. Write in `PRESENTER.md` which slides to skip if you run long.

## 8. Stay honest

You can tidy the story: simulate a demo, round a number, move a time or rename a project. The slide or the notes must say so, and `PRESENTER.md` "What's real" must list it. Never invent a result.

## Done when

- The one-idea sentence is in `PRESENTER.md`, and each main slide serves it.
- The titles read as a story in order.
- Each slide's notes open with its job and end with a bridge to the next slide.
- Every open loop in `PRESENTER.md` is paid off.
- Each mechanism the talk explains has a diagram.
- No main slide is a paragraph or a long list.
- Then use `deck-coach` to show the draft, and `deck-check` before you call it done.

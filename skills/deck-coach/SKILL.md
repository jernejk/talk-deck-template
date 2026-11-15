---
name: deck-coach
description: Work with the presenter to turn a first draft into their best talk. Use when you start a deck for someone, when you are about to hand over a draft, when the user sends feedback (screenshots with notes, "this is cut off", "the start needs more punch", a long voice note), or when they ask for "v2". Covers what to ask before you build, how to show a draft, how to take feedback, versions, polish passes and the last checks before the talk.
---

# Work with the presenter

A good first draft gets most of the way. The presenter's stories and taste make the rest. Plan for rounds of feedback, and make each round cheap for the presenter.

## Before you build

Ask once, in one message, for what only the presenter has. Then build. Use clear placeholders for what is missing, and list them in `PRESENTER.md` under "Open questions". Do not put placeholders in the notes: the notes ship with the slides.

- The one idea, and the audience: who, how many, what they know already.
- The slot length, the venue (projector, phone, screen share) and the other speakers.
- Their current title, logos, a portrait, socials and the slides URL.
- Real numbers, real stories and the joke that they like to tell.
- The demos: what is live, what is recorded, and what you can simulate.
- The look: a template, a brand, or a deck or site that they like.

## Show a draft

1. Build the whole deck end to end before you polish one slide (`deck-story` for the arc).
2. Run `deck-check`, and read every screenshot yourself. The presenter must never be the first to see a cut-off title, a logo that clashes with the background, or an unflattering photo.
3. Send the URL or the path, the contact sheet (`qa/<deck>/<template>/sheet-1920x1080.png`) and three questions:
   - Does the hook land?
   - Which slide drags?
   - What do only you know that is missing?
4. If someone watches the work as it happens, post screenshots as you go.

## Take feedback

- Feedback comes as screenshots, short notes and voice transcripts. Find the slide in each screenshot, and name it by its id when you reply.
- A long or rambling message can hold many requests. List them back, then do them all, the small ones too. Say which ones you did not do, and why.
- A request that makes the story tidier than the facts (a rounded number, a moved time, a simulated demo) is fine with a disclosure. Do it, say where you disclosed it, and add it to "What's real" in `PRESENTER.md`.
- Write each decision in `PRESENTER.md`, so that a later agent does not undo it.
- A change of focus is a new version. Put v2 in its own folder or at its own URL, and keep v1 until the presenter chooses (`deck-publish`).

## Polish

When the presenter agrees the story, do one pass for each concern:

1. Story and titles (`deck-story`).
2. Pictures and layout: read the contact sheet as a whole.
3. Motion and performance (`deck-perf`).
4. Notes, clocks and extras (`deck-notes`).

For a second opinion, ask a model from a different lab to read the contact sheet and the notes for taste and facts. Treat its answer as advice, not as orders.

## Before the talk

- Check the deck where it will be shown: the projector size (`?res=1920x1080`), and the presenter's phone if they will present or share from it.
- Each live beat has a screenshot and a reset step in `PRESENTER.md` (`deck-demo`).
- Rehearse with the T timer. Write in `PRESENTER.md` which slides to skip if the talk runs long.
- Publish only after a clear yes (`deck-publish`).

## Done when

- The presenter has the URL or the path, the contact sheet and the open questions.
- Each point of feedback is done, or you said why not.
- `PRESENTER.md` holds the decisions, the open questions and "What's real".

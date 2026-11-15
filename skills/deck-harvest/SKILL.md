---
name: deck-harvest
description: Bring reusable work from a finished talk deck back into the template's library. Hand-built widgets become components and patterns, and fixes made in a deck's site/lib go back to core/ and components/. Use in the template repo when the user says "take anything from that deck into the engine", "what should we upstream", "bring the fixes back", "should these be widgets", or after a talk.
---

# Harvest a deck

Each talk teaches the library something. This skill finds what a deck built for itself and turns the reusable parts into components and patterns. Use it only in the template repo.

## Read first

- `deck-library`, and `AGENTS.md`, section "Changing the library".
- `MAINTAINING.md`.
- `docs/agent-index.md`, to see what the library has already.

## 1. Find what the deck added

1. **Library drift.** Compare the deck's copy of the library with this repo:
   `diff -rq <deck>/site/lib/core core`, and the same for `components` and `templates`.
   The deck can be behind (an older copy) or ahead (a fix made there). For each file that differs, look at the diff and at `git log -1 -- <file>` before you decide which side is newer.
2. **Hand-built widgets.** Read the deck's own `<style>` and `<script>` blocks in `index.html`. Group the rules by class prefix, and find the slide that uses each group.
3. **Repeats.** Look at other decks, if the user has them. A trick that two decks built is a strong candidate.

## 2. Choose

Take a widget when:

- it is useful outside this talk;
- the template tokens can colour it;
- no component already does the same job.

Skip zoom and position tweaks for one deck, brand assets and one-off content. Show the user the candidates, each with its slide, before you build more than two.

## 3. Generalise

1. Give it a generic name. The root class is the folder name, and the other classes start with `<name>-`.
2. Change fixed colours to tokens: palette slots, or the `--ui-*` tokens for a drawn app. Give each new token a fallback.
3. Move words out of CSS `content` and into the markup.
4. Add the reduced-motion and portrait rules. Put behaviour in `Deck.use`, and stop it on `leave`.
5. Write a slide pattern with placeholder copy that teaches. If the figures are a sample, the slide and the notes say so.
6. If it is drawn, add its class where the other drawn classes are listed: `DRAWN_CLASSES` and the live-beat fallbacks in `tools/lint.mjs`, `CHECKED` in `tools/qa.mjs`, and the docs (search for `.composer`).

## 4. Check

1. `npm run build`, then `npm run build -- --check`.
2. `npm run qa -- examples/catalog --slides <ids> --sizes 1920x1080,1280x720,390x844`. Read the screenshots in a light and a dark template.
3. For a drawn component, put it on a test slide with no "drawn" caption. `npm run lint` must warn.
4. For an engine fix, test it on the device or browser where the deck found the bug.

## 5. Leave the deck alone

Do not change the deck. It keeps its own copy of the library. Tell the user that `npm run upgrade -- <deck>` can refresh it after the talk, not just before it.

## Done when

- The user agreed on the list of widgets and fixes.
- Each new component has a pattern, a row in `docs/components.md`, and a row in `docs/slides.md` for its pattern.
- `npm run build -- --check` passes, and QA reports no problems in every template.

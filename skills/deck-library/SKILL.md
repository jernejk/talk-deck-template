---
name: deck-library
description: Change the shared library of the talk-deck template repo, not a single deck. Use when the user asks to "add a component", "add a slide pattern", "add a template", "change the engine", "fix the build" or "update the catalog or showcase". Covers the recipe in AGENTS.md "Changing the library", npm run build, the generated files, QA and the showcase.
---

# Change the library

Use this skill only in the template repo, which has `core/`, `components/`, `slides/` and `templates/`. A standalone deck has a copy of the library in `site/lib/`. Do not use this skill there.

## Read first

- `AGENTS.md`, section "Changing the library".
- The doc for the part you change. Read only that doc:
  - component: `docs/components.md`, section "Adding a component";
  - slide pattern: `docs/slides.md`, sections "Writing a pattern" and "Layouts";
  - template: `docs/styles.md` (or use `deck-style`).
- Two or three existing items of the same kind. Match them. `components/cli/` is a small example of a component.

## Steps

1. Do not edit the generated files: `components/components.css`, `components/components.js`, `examples/catalog/`, `examples/index.html` and `docs/agent-index.md`. `npm run build` makes them.
2. Make the change:
   - **Component:** `components/<name>/<name>.css`, with a root class named after the folder. Use theme tokens with fallbacks and set `--rise:1`. Add reduced-motion and portrait rules. Put behaviour in `<name>.js` through `Deck.use`. Use the component in a slide pattern. Add a row to `docs/components.md`.
   - **Slide pattern:** `slides/<name>.html` with a `data-layout`. Add an entry in `slides/index.json` with the same `layout`. Add a row to `docs/slides.md`.
   - **Template:** `templates/<name>/theme.css` and `template.json`.
3. Run `npm run build`. It fails when a component, pattern or layout has no doc row, or when a component is not used in a pattern.
4. Run `npm run build -- --check`. It fails when a generated file is stale.
5. Run `npm run qa`. This checks every example, the catalog in every template and the build. While you work, use `npm run qa -- examples/catalog --theme <name> --slides <ids> --fast`.
6. Read the catalog screenshots of the slides you changed, in every template: `qa/catalog/<template>/`.
7. If a pattern or template looks different, run `npm run showcase`. To make only some sheets again, run `npm run showcase -- <sheet>`.
8. Update the README pattern count and the pattern table if you added a pattern.

## Done when

- `npm run build -- --check` passes.
- `npm run qa` reports no problems, and you read the screenshots in every template.
- The generated files are in the same commit as the change. If you ran `npm run showcase`, the new pictures are in it too.

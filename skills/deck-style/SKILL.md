---
name: deck-style
description: Change how a talk deck from this repo looks, from a brand colour to a full template. Use when the user asks to "use our brand colours", "make a colourway", "add a template", "change the font", "make it look like…", "fix the contrast" or "add our mascot or pet". Covers the four levels of change in docs/styles.md, the tokens, the contrast targets and the template QA.
---

# Colourways and templates

## Read first

- `docs/styles.md`. It has the four levels, the tokens and "Rules that bite". This skill does not copy it.
- `docs/showcase/README.md`, section "Colourways": six colourways, each with its CSS.

## Steps

1. Start at the lowest level that gets the look. Levels are from `docs/styles.md`:
   1. Tweak a template: `@import` it and set a few tokens.
   2. Re-skin: copy `templates/community/theme.css` and change the values.
   3. Re-style components: add rules below the tokens.
   4. Bring your own assets: mascots, pet poses, fonts and textures.
2. Make `templates/<name>/theme.css` and `templates/<name>/template.json`. Set `extends` to the base template.
3. Use the tokens. Do not change slide HTML for a new look. Slides use `var(--a1)` to `var(--a6)`, so a template recolours them.
4. Check the contrast against `--bg`:
   - 4.5:1 for small text: `--a0` to `--a5`, `--muted` and `--signal`;
   - 3:1 for big titles.
5. Keep the QR plain: dark modules on a white card.
6. Add a reduced-motion rule for each animation.
7. In this repo, run `npm run build`. This adds the template to the gallery.
8. To see a deck in the template without a change to it, add `?theme=<name>` to its URL.

## Check

```sh
npm run qa -- examples/catalog --theme <name>
npm run qa -- examples/catalog --theme <name> --motion --sizes 1280x720
```

Read every screenshot in `qa/catalog/<name>/`, or the contact sheets beside them. A standalone deck has no catalog. In its folder, run `npm run qa -- --theme <name>`.

If you changed how an existing template or pattern looks in this repo, run `npm run showcase` to refresh the pictures in `docs/showcase/`.

## Done when

- QA on the catalog in the template reports no problems.
- You read the screenshots, and the small text meets the contrast targets.
- In this repo, `npm run build -- --check` passes.

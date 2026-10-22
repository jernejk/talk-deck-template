# Contributing

Thanks for helping. Issues and pull requests are welcome: bugs, new slide patterns, components and templates.

## Set up

```sh
npm install
npx playwright install chromium
```

## Before you open a pull request

1. Read `AGENTS.md`. It holds the authoring rules for people and coding agents.
2. Add a component, pattern or template the way `README.md` ("Extend it") describes, and document it in `docs/`.
3. Run `npm run build`. Don't edit the generated files (`components/components.css`, `components/components.js`, `examples/catalog/`, `examples/index.html`) by hand.
4. Run `npm run qa`. It must report no problems. Look at the `qa/` screenshots of what you changed, in every template.
5. If a pattern or template looks different, run `npm run showcase` and commit the new pictures.

Keep pull requests small and focused, and say in the description what you checked.

## Assets

Only add images, fonts and other assets you made yourself or that are licensed for redistribution, and credit them in `README.md`. No external scripts, styles or fonts: decks must run offline.

By contributing, you agree that your contributions are licensed under the MIT License.

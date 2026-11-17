# Hand a slide to another agent

Delegate only when it saves time after you count the brief, the wait, your review, any repair and the merge. Scripts beat agents for anything mechanical: running QA, sorting its output, refreshing the route table, copying files.

## Do it yourself when

- there are one or two items, or the brief would be longer than the change;
- it's a look, adjust, look loop on one slide;
- it touches the deck's shared `<style>`, `<script>` or `#deck-config`, `site/lib/`, or the engine;
- it's the hardest item in the batch. Take it yourself while helpers take the short, separate ones;
- the deadline is close.

## What a helper can take

Short, separate items with a fixed result and one check that a script can run:

- supplied wording into named slides: titles, notes, captions, alt text;
- a lint fix the check names exactly, such as `curly-quotes`, or `clock-order` with the durations given;
- reading that returns findings in a fixed shape, such as a first pass over screenshots or matching each number on a slide to `PRESENTER.md`. This adds to your own read; it never replaces it.

Story, titles and copy choices, layouts and patterns, colours and crops, which `<em>` stays, what counts as real or drawn, privacy, phone and performance diagnosis, and signing off anything visual stay with the lead. Don't make the smallest or cheapest model the default for any kind of task until a trial on your own decks shows it meets the bar for that kind, with review and repair time counted. Even then, keep checking its results.

## The brief

Keep it short, with the fixed parts first and the task last:

```
ROLE    Edit one fragment of a talk deck. Change nothing else.
FILES   Edit: <fragment file holding one <section>>.
        Read: AGENTS.md, "Rules" and "Slide anatomy". Nothing else.
        Never: index.html, site/lib/, any <style> or <script>, PRESENTER.md.
TASK    <one change, stated as the result. Supplied text is final: copy it exactly.>
CHECK   <one command that prints PASS or the failures>. Fix and run it once more.
STOP    Stop and report, changing nothing further, if the check still fails after one retry,
        the title needs a third line, you need a new class, style, asset or file,
        a fact or slide id in this brief is missing or looks wrong, or you aren't sure it's done.
REPORT  JSON only: {"status": "done" | "stopped", "ids": [...], "check": "PASS" | "FAIL", "stop_reason": "..."}
```

## Accept the result yourself

The helper's `done` is a claim, not evidence. Before you accept it:

1. Freeze supplied targets with `npm run accept -- fragment-out <deck> --slides <id> --text <targets.json> --out <new-contract-folder>`. Give the helper its fragment only. Insert with `fragment-in --contract <contract.json> --fragment <returned.html>`; a changed integration base requires a reviewed new contract. Helpers never edit `index.html` or shared files.
2. Check that only the owned `<section>` elements changed, that supplied text appears exactly, and that `site/lib/` and generated files didn't change.
3. Run the check yourself: `npm run qa -- <deck> --slides <ids> --out <new folder>` with no problems, no "no slide matches" warning, and one screenshot for each slide and size. Then read those screenshots.
4. Compare selected lint checks with the saved baseline (`--baseline`), then run `npm run accept -- check --contract <contract.json> --receipt <current-receipt.json>`. `--allow-pending` can report mechanical acceptance while full QA and senior visual review remain due; `complete` remains false.

## Limits

- At most four results wait for your review at a time. Your review is the limit, not the machine.
- One retry with the failure text, then the item comes back to you.
- Helpers don't start helpers.
- Each helper's browser checks use their own `--out` and `--jobs 1`. Perf never runs alongside them.

Stop fanning out and work directly when a problem shows only on a phone or in WebKit, QA flags a slide nobody owned, two results conflict, the task needs shared style, script, config or the engine, the wording or a fact is ambiguous, the result needs a taste call, or an item has taken twice its estimate.

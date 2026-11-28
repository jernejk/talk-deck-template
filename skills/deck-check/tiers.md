# What to check now, and what can wait

Every change has a tier. The tier says which checks to run while you iterate and which must pass before the batch is done. A check can wait. It can't disappear: write it down when you put it off, and clear it only with its output.

## Tiers

| Tier | What changed | While you iterate | Before the batch is done |
|---|---|---|---|
| T0 prose | Text nothing reads or copies: README, CONTRIBUTING, MAINTAINING, reports, `PRESENTER.md` outside the route table | Read it | Nothing more. No browser |
| T0 generated | Text that tools read or copy: `AGENTS.md`, `skills/`, `docs/components.md`, `docs/slides.md`, the route table | Read it | In the template repo `npm run build -- --check`; for the guide or a skill, a scratch deck from `npm run new` and a read of its copy; `npm run route -- <deck> --check`. No browser unless a page changed |
| T1 wording | Words, notes, captions and alt text inside existing slides, with no new class, style, script or media | `npm run lint -- <deck>` and `npm run qa -- <deck> --slides <ids> --fast` | Full QA of the deck, and the screenshots of every slide you touched, from that run |
| T2 structure | Adding, moving or removing slides; media, steps, `data-live`, a QR code or a URL | The T1 checks, plus `--slides <ids>` without `--fast` into a new `--out` folder, and `--motion` for a slide that moves | As T1, plus `npm run route -- <deck> --check`, and the QR check for a new QR |
| T3 shared | A deck's own `<style>`, `<script>` or `#deck-config`; embedded pages and replays, and whatever builds them; `site/lib/`; the engine and its tools | The checks for the part you're changing | Full QA; every check `MAINTAINING.md` or the deck's own notes list for that part; generated-output checks; perf, run alone, when motion or cost could change; the phone row |
| Release | Publishing | | Everything above passed on the exact files you publish. The phone row is printed as it stands |

Partial evidence stays partial. `--slides`, `--fast` or an earlier run never stand in for a full run, and neither does a clean Git tree: gate on the files you checked, not on whether they're committed.

## How to read the results

- `--fast` defers full offline/keyboard gates and writes no normal screenshots, except for slides with a QR code. To look at slides, run without `--fast` and read what that run wrote. Every run has a fresh artifact directory and manifest; read the receipt’s paths rather than ambient images.
- The lint is advisory by default. Save `npm run lint -- <deck> --out <baseline.json>`, then opt into `--baseline <baseline.json> --slides <ids> --checks <check-ids>` to reject new selected warnings. QA offers `--lint-baseline` and `--lint-checks`; historical warnings stay advisory.
- Functional checks may run side by side, each with its own `--out`, sharing one machine-wide browser budget (the core count minus two, from 4 to 16 slots; `TALK_DECK_BROWSER_SLOTS` sets it). Give helpers `--jobs 1`; a default full QA reserves the whole budget, so other checks queue for up to 180 seconds (`TALK_DECK_RESOURCE_WAIT_MS` sets the bound). Timeout is an explicit failure, never completion. Perf and any real-time smoothness pass run alone, with no QA, demo checks or other browsers at the same time; numbers taken alongside other work are noise.
- One person builds and writes generated files at a time. Nothing reads generated output while a build writes it.
- Refreshing a standalone deck with `npm run upgrade` is one person's job in a batch: a dry run, a read of the list, then `--write`, never while someone is changing the engine's tools.
- Seeking a replay or an animation proves a state, not smoothness. Keep one real-time pass for the motion itself.

## The pending record

Keep local `PENDING.json` beside `PRESENTER.md` and ignore it in Git; evidence paths may contain private local locations. For library or tooling work, keep it at the root of your checkout, and don't commit it to the template repo. One row for each check you owe:

```json
{
  "checks": [
    { "id": "deck-qa-full", "tier": "T1", "change": "#kickoff wording", "check": "npm run qa -- --out <new folder>",
      "added": "2026-11-17", "status": "pending", "evidence": null },
    { "id": "physical-phone", "tier": "release", "manual": true, "check": "Pinch-zoom and drag on the demo slides",
      "added": "2026-11-17", "status": "unverified", "evidence": null }
  ]
}
```

- `status` is `pending`, `passed`, `failed`, or `unverified` for a manual row.
- `passed` and `failed` need `evidence`, a path to the output that shows it, made after the row was added, and a `cleared` date.
- Write the row when you put the check off, not at the end. Never delete an open row. A batch with a `pending` or `failed` row is still in progress, and its report lists every open row under "Outstanding".
- A worker's report is not evidence. Whoever leads the batch clears a row from output they can read.
- The physical phone is a manual row. Add it for every release and for any T3 change to the resolution preview, embeds, video or zoom. Desktop, emulated, WebKit and simulator checks never clear it: it stays `unverified` until someone tries a real phone and writes down what they saw. A release prints it, and it doesn't block one.

For one-fragment mechanical gates, `npm run accept` maintains a sealed `talk-deck-pending/v1` record beside its contract. It derives QA completion only from matching current receipts and retains manual review rows. A deck-specific batch `PENDING.json` also records standalone, perf, independent review and phone evidence; its checker must bind passed rows to current input and evidence hashes. The two records cover different scopes, and neither clears the other implicitly.

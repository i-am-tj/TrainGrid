# Shared content: maintaining TrainGrid routines

The **TrainGrid** routines every member sees (scope `GLOBAL`) are written as Markdown in
`data/templates/*.md`. Those files are the only editorial source. Everything else is generated
from them:

| File | Made by | Purpose |
| --- | --- | --- |
| `data/templates/<slug>.md` | You | One routine: front matter plus one `## ` section per item |
| `supabase/seed.sql` | `npm run seed:generate` | Idempotent SQL that creates or updates the GLOBAL routines |
| `data/templates/seed-ids.json` | `npm run seed:generate` | The id lock: which exercise every item id belongs to |

Never edit the two generated files by hand. Unit tests fail if either is out of date with the
templates.

## A template

```markdown
---
id: lower-b                 # the slug; never change it for an existing routine
name: Lower B
type: strength              # running | strength | plyometrics | other
description: Hinge-pattern lower body.
---

## Deadlift

3 × 4–6
Rest: 3 min
Target: RPE 7–8

Neutral spine. Push the floor away.

Equipment: Barbell
```

Within a section: the first paragraph is the **instruction**, and later paragraphs are **notes**.
`Rest:`, `Target:` (or `Intensity:`), `Equipment:` and `Video:` (YouTube only) become their own
fields. `Key:` controls the item's id (below). Only add a video or equipment you have checked;
do not invent sets, reps or claims.

## Item ids never move (E2-D11)

Every item has a fixed id. Scheduled sessions record the id of the item they were copied from, so
an id must always mean the same exercise. By default an id comes from the item's **position** in
the file. That is safe for edits in place and for adding items **at the end**. For anything else,
use `Key:`:

| Change | What to do |
| --- | --- |
| Edit an item's text, rest, target, equipment or video | Just edit it. |
| Rename an exercise in place | Edit it, then run `npm run seed:generate -- --accept-renames`. |
| Add an item at the end | Just add it. |
| Add an item anywhere else | Give the new item a word key, `Key: good-morning`, **and** pin every existing item after it to its original position, `Key: 2`, `Key: 3`, … (positions count from 0, in the file as it was). |
| Reorder items | Pin each moved existing item to its original position: `Key: 4`. |
| Remove an item | Remove it, pin every existing item after it to its original position, then run `npm run seed:generate -- --accept-removals`. |

If you forget, `npm run seed:generate` refuses and lists each id that would point at a different
exercise, and nothing is written. A key never changes once given. Two items in one routine can
never share a key or a pinned position.

## Workflow

1. Edit or add `data/templates/<slug>.md`.
2. `npm run seed:generate`. Read its output: new, renamed and removed counts, or a refusal.
3. Review the SQL effects: `git diff supabase/seed.sql data/templates/seed-ids.json`.
   - Changed rows should be only the items you meant to change.
   - Ids in `seed-ids.json` must keep their exercise names, except for renames you accepted.
   - The seed creates or updates GLOBAL routines and their items, and deletes items no longer in
     a template. It never touches personal routines, scheduled sessions, profiles or invitations.
4. Test locally: `npm run db:reset` (applies migrations and the seed to the **local** database
   only), then `npm test` and `npm run db:test`. Open the routine in the app and check it.
5. Open a pull request. CI runs the same unit tests: the seed and the id lock must match the
   templates.

## Applying it to production (owner only, deliberately)

The seed is **not** applied by merging and **not** by a plain `npx supabase db push`, which applies
migrations only. Apply it explicitly, after a dry run:

```bash
npx supabase db push --remote --include-seed --dry-run
npx supabase db push --remote --include-seed
```

- Only when shared content actually changed. Nothing in the app needs a seed run otherwise.
- **Never** run `supabase db reset` against production: it would destroy every member's data.
- Sessions already scheduled keep their own snapshot. Changing a routine does not change them, by
  design.

## Removing a whole routine

Deleting a template file does **not** delete the GLOBAL routine: the seed leaves routines without
a template in place. Retiring a routine needs its own reviewed procedure: check who has scheduled
it, decide what members should see, and write a one-off migration. Until that procedure exists,
keep the template.

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

**Every section is a step you do.** The workout screen asks for each item to be ticked off (or
logged set by set), and its totals count them. Advice is not a step: write it as notes on the step
it belongs to. In the running plans, advice for the run goes in **Main**'s notes, advice for later
runs as a note starting `Next time:`, and the recovery between repetitions as **Main**'s `Rest:`
(PRODUCT_AUDIT F9). A unit test holds the running plans to Warm-up, Main and Cooldown.

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
migrations only.

**An updated seed must be run by hand.** `npx supabase db push --remote --include-seed` runs a seed
file only the first time the project sees it. Once it has run, a changed `supabase/seed.sql` is
listed as `(hash update)`: the CLI records the new hash and does **not** run the file, so
production keeps the old content while the CLI reports success. To apply a change:

1. Merge the pull request, so `main` holds the seed you mean to apply.
2. In Supabase → **SQL Editor** on the production project, paste the whole of `supabase/seed.sql`
   from `main` and run it. It is one transaction and idempotent, so running it again is harmless;
   if any statement fails, nothing changes.
3. Check the result, for example that a routine you changed has the items you expect:

   ```sql
   select r.slug, string_agg(i.name, ' > ' order by i.sort_order)
     from public.routines r join public.workout_items i on i.routine_id = r.id
    where r.scope = 'GLOBAL' and r.slug = 'easy-run'
    group by r.slug;
   ```

4. Optionally record the new hash, so later dry runs stay quiet:
   `npx supabase db push --remote --include-seed` (from an up-to-date `main` checkout; it lists
   `supabase/seed.sql (hash update)` and runs nothing).

On a project that has never been seeded, `npx supabase db push --remote --include-seed` (after
`--dry-run`) does run the file.

- Only when shared content actually changed. Nothing in the app needs a seed run otherwise.
- Run seed and migration commands from a checkout of the latest `main`. From an older branch the
  CLI reports "Remote migration versions not found in local migrations directory" and suggests
  `supabase migration repair --status reverted …`. **Do not run that**: it marks migrations that
  production already has as reverted. Update the checkout instead.
- **Never** run `supabase db reset` against production: it would destroy every member's data.
- Sessions already scheduled keep their own snapshot. Changing a routine does not change them, by
  design.

## Removing a whole routine

Deleting a template file does **not** delete the GLOBAL routine: the seed leaves routines without
a template in place. Retiring a routine needs its own reviewed procedure: check who has scheduled
it, decide what members should see, and write a one-off migration. Until that procedure exists,
keep the template.

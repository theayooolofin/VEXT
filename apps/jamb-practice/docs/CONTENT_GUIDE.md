# Content guide (for the owner and the teacher)

Lessons live as files in the code, not in the admin page. That way a teacher's approval is tied to the exact words students see, and every change is recorded.

```
content/jamb-english/
  topics.json          the allowed topics and their names
  diagnostic.json      the 10-question free check
  lessons/day-01.json  one file per day, up to day-14.json
  review.json          teacher approvals (written by a command, never by hand)
```

`content/jamb-english/_fixtures/` holds fake test lessons. They never appear on the live site.

## Style guide

- Plain language. One rule per day.
- Explanations: at most two short lines (300 characters is the hard limit).
- Exactly 10 questions a day, four options A to D, one correct answer. Aim for 4 easy, 4 medium, 2 hard.
- No trick questions. Original questions only; do not copy past papers or textbooks.
- Never promise marks or results.
- Text marks you can use: `**bold**`, `*italic*`, and `[[underlined words]]` (for "the underlined word" questions). Phonetic symbols such as /θ/ and /ʃ/ can be typed directly.

## Writing lessons in a spreadsheet

Make two sheets and save each as CSV (File → Download → CSV in Google Sheets).

**lessons.csv**, one row per question:

| day | question_no | stem | A | B | C | D | answer | explanation | difficulty | topic_tag | passage_id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | 1 | Each of the girls ___ a bag. | have | has | are | were | B | 'Each' is singular, so it takes 'has'. | easy | concord | |

**rules.csv**, one row per day:

| day | title | topic_tag | rule_text | example_text |
| --- | --- | --- | --- | --- |
| 4 | Concord with "each" and "every" | concord | ... | ... |

Topic tags must be one of: `concord`, `tenses`, `prepositions_articles`, `vocabulary`, `oral_forms`, `error_spotting` (see `topics.json`; ask the developer to add a new one).

Then, in the `apps/jamb-practice` folder:

```
npm run content:import -- path/to/lessons.csv path/to/rules.csv
```

This writes the lesson files, raises a lesson's version number when its content changed, and checks everything. It never approves anything. Passages (for comprehension questions) are added to the lesson file by hand for now: a `passages` list of `{ "id": "p1", "title": "...", "body": "..." }`, then put `p1` in the question's `passage_id`.

## Checking content

```
npm run content:validate
```

It lists every day as `missing`, `draft`, `approved`, `edited_after_approval` or `invalid`, and explains every problem in plain words (for example "Day 4 question d04-q03: answer "E" is not one of the options"). Fix the file and run it again until it says "Content is valid."

## Approving a day (the safety gate)

The live site only shows a day after a teacher has approved its exact text.

1. The teacher reads the day in a preview (the developer can share a preview link, where unreviewed lessons are visible).
2. Then run:
   ```
   npm run content:approve -- --day 4 --reviewer "Teacher's name"
   ```
   For the free check use `--day diagnostic`.
3. Commit and deploy (RUNBOOK 2).

**Any later edit to an approved file withdraws its approval automatically.** The admin content page then shows "edited after approval" and the day disappears from the site until it is approved again.

## Releasing a correction

When a student reports a problem (admin → Content → open reports):

1. Edit the lesson file (or re-import the spreadsheet).
2. `npm run content:validate`
3. Teacher re-checks, then `npm run content:approve -- --day N --reviewer "Name"`
4. Commit and deploy.
5. On the admin content page, mark the reports **Fixed** with a short note.

Students who already answered keep their old scores; new answers are recorded against the new version.

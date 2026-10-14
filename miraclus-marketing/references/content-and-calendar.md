# Content strategy and the calendar

## Pillars

Pick 3–5 themes the brand can speak about with authority and its audience cares about, e.g. the
problem space, how-to and practice, the product at work, proof and customers, the team and the
thinking behind it. Each post belongs to one pillar; the mix keeps the page from becoming an ad
stream. A useful starting mix: mostly useful/insight posts, some product, a little promotion.

## Ideas — score before you write

| Criterion | Ask |
|---|---|
| Audience value | Would the reader save or share it even if they never buy? |
| Fit | Does it lead naturally to what the product does? |
| Proof | Can we show it (screen, number, customer)? |
| New | What does it add that the reader can't get from the usual posts on this topic? If nothing, don't write it. |
| Effort | Can it be made well with what we have? |

Give the owner the top few with one-line reasons; recommend one.

## Repurpose

Every long piece (blog post, webinar, meeting with a customer, launch) contains several posts:
a quote, a story, a tip, a number, a before/after. Plan them when the piece is made.

## Cadence and timing

- New page: 2 posts a week is a sustainable start; consistency beats volume.
- Post when the audience is at work, on its working days — check the market's weekend. With
  several markets whose work weeks differ (e.g. Sunday–Thursday vs Monday–Friday), choose days
  that are working days in **all** of them (Monday–Thursday), unless the owner targets one.
- One page, two languages: separate the languages by a few hours on the same day so they don't
  compete (e.g. one language in the morning, the other early afternoon).
- Space posts at least a few hours apart on the same page; Miraclus warns when they are too close.
- Use `publishing_set_posting_hours` on a page so the calendar warns outside them.
- **Time zone**: always confirm it. `scheduled_for` / `when` are ISO times — write them with an
  explicit offset or in UTC, and state the local time back to the person ("Monday 09:00, Gulf time").
- **When the person names a time** ("9am") and your advice differs (a weekend, two languages at
  once): recommend once with the reason, and keep their time if they confirm. Their call, your
  advice.

## The calendar in Miraclus

- A post can be **planned** before any page is connected: set `params.scheduled_for` per variant
  with `composer_edit_variant`. It appears on the calendar as `planned`.
- Planned ≠ scheduled. The calendar's "Not scheduled yet" strip lists planned posts too — that is
  expected, not missing data. Month view shows the whole run.
- Read it back with `composer_calendar` and check warnings.

# From draft to live

## The states

draft → in review → approved → scheduled → posting → posted (or failed / cancelled).
**Planned** is a draft with a date and no schedule yet. Only **approved** variants can be
scheduled. Changing approved words sends them back to review.

## Step by step

1. **Preview** — `composer_preview_piece`; the owner sees exactly the text and card.
2. **Destination** — `publishing_list_destinations`. If the page isn't there, connecting it is a
   sign-in the person does in the Miraclus app; you can't do it for them.
3. **Review** — `composer_submit_for_review`; an allowed approver runs `composer_approve`. Never
   approve on someone's behalf, and never change approval rules (`publishing_set_approval`,
   `brands_set_approval`) to get round review. If the person in the conversation **is** an allowed
   approver and says "approve it" to the exact preview you showed, you may call `composer_approve`
   with their access — Miraclus still refuses self-approval where the page forbids it; then they
   approve in the app.
4. **Dry run** — `composer_schedule_piece` (or `composer_publish_piece`) with `confirm=false`. Show
   the result: each destination, account, language, exact text, time.
5. **Go** — the same call with `confirm=true`, only after a yes to exactly that.
6. **Verify** — `composer_calendar` / `publishing_post_status`; say "scheduled" only after the tool
   confirms it.

"I trust you, no need to show me" covers the drafting. Publishing still gets one short preview
and one yes — it is the brand speaking in public.

## Urgent requests ("post it now, skip review")

Find out what is actually possible (destination, approval rules), show the preview, and offer the
fastest legitimate path: the right person approves, then publish with a dry run. Point out side
effects (e.g. posting out of a series' order).

## Manual fallback

If the page can't be connected in time, the person can post by hand. For each due post, hand over
the final text in each language and the card file (the preview shows both). After they post one
manually, take that variant off the calendar (`composer_edit_variant` with `clear_schedule`) so it
can never go out twice.

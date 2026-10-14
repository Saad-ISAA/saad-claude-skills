# Miraclus quirks and limits

| Symptom | Meaning | What to do |
|---|---|---|
| `confirm_required` | Dry run needed | Show the dry run; confirm only on a yes. |
| "It is being written; wait" | Piece locked while `composer_write_variants` runs | Poll `composer_get_piece`; edit after. |
| Writing or check fails: "used up its allowance… resets at …" | Writing model at its usage limit | Pass another model in `params.models` (see `models_list_choices`) or wait. |
| "spent its whole reply allowance thinking" | A thinking model ran out of room | Use a different model for that call. |
| Empty answer / "answer was not JSON" | Model returned nothing | Retry once, then switch model. |
| HTTP 429 | Rate limit (calls per minute) | Back off and retry; batch reads. |
| HTTP 503 "restarting" | Server deploying | Safe to retry after the `Retry-After`. |
| Kit update "too long" | A field line exceeds its limit (the error states it) | Split into several short facts. |
| Template renders with wrong logo/font | Template reset after a redeploy | Re-read the spec, restore ids, re-render. |
| Screenshot cut in a card | Picture slot aspect ≠ screenshot aspect | Make the slot's aspect match the crop. |
| `bad_model` | That model can't do that task | Pick from `models_list_choices`. |
| Calendar shows posts as "Not scheduled yet" | They are planned, not scheduled | Expected until a page is connected and posts are approved. |
| File links in tool answers | Signed, short-lived | Download immediately to look at them. |

Diagnose from the failing call's own response before blaming anything else; nearby log warnings
are often unrelated.

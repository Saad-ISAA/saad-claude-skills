# Miraclus tool map — by job

Tool names are `mcp__miraclus__<area>_<action>`. Most write tools take their fields inside
`params`. The server's own guide is `guides_read {"slug": "mcp"}` — read it once per session when
the tools may have changed; it is generated from the live server.

## Orient (read-only, start of every session)

| Job | Tool | Notes |
|---|---|---|
| Brands and products | `brands_list_companies`, `brands_get_company` | The default company comes first. |
| What generators follow | `brands_get_kit {"ref": {"company_id": C}, "effective": true}` | Voice EN/AR, dialect, facts, names, approved lines, banned terms. |
| Where posts can go | `publishing_list_destinations` | No LinkedIn page yet = everything stays planned. |
| Where new posts go | `composer_prefill`, `brands_get_routing` | |
| Card templates | `templates_list_templates {"company_id": C}`, `templates_get_template` | Slots, sizes, picture slots. |
| What is planned | `composer_calendar {"start","end","zone"}` | Includes `planned` entries without a page. |
| Model choices | `models_list_choices` | Writing, checking, image models. |

## Brand

| Job | Tool | Notes |
|---|---|---|
| Draft a kit from a site/files | `brands_add_company_from_url`, `brands_build_kit_from_sources` | Draft waits for review → `brands_apply_draft`. |
| Change kit fields | `brands_update_kit {"ref":…, "params": {"fields": {…}}}` | Fields go under `params.fields`. Lists (facts, banned, names, approved_lines) are **replaced**, so read, modify, write back. Each fact has a length limit (the error states it). |
| Names in other scripts | `fields.names: ["Brand = الاسم", "Product = …"]` | The writer uses these spellings; the Arabic check never flags them. |
| Lines the writers may use verbatim | `fields.approved_lines` | Taglines and claims in both languages. |

## Write

| Job | Tool | Notes |
|---|---|---|
| New post | `composer_create_piece {"params": {"title","company_id","source": {"kind": "brief"/"url"/"campaign"/"blog_post", "text"…}, "slots": [{"provider": "linkedin", "language": "en"}, …]}}` | `slots` with `provider` only works before a page is connected; add `destination_id` once it is. |
| Draft the words | `composer_write_variants {"piece_id", "params": {"style": "story"/"breakdown", "depth", "models"}}` | Runs in the background; poll `composer_get_piece` until each variant's `writing` is done. The piece is locked while writing. |
| Fix the brief later | `composer_update_source {"piece_id", "params": {"text"}}` | The check and rewrites read the new brief; words are unchanged until rewritten. |
| Set words, picture, time | `composer_edit_variant {"piece_id","variant_id","params": {"text", "media": {"asset_id"}, "scheduled_for", "first_comment"}}` | Changing approved words sends them back for review. |
| Proposed rewrite (diff, not saved) | `composer_rewrite_variant` | Accept with `composer_edit_variant`. |
| Arabic check | `composer_check_variant {"piece_id","variant_id","params": {"models": {"social": …}}}` | Lists problems, never changes words. Read warnings in `composer_preview_piece`. |
| Network rules | `publishing_validate` | Length, fold, link placement. |
| See it as it will look | `composer_preview_piece` | Always before showing the owner. |
| Delete a draft | `composer_delete_piece` | Dry run first. |

## Visual

| Job | Tool | Notes |
|---|---|---|
| Card from a template | `templates_render_template {"template_id", "params": {"size": "4:5", "language", "words": {slot: text}, "pictures": {"screenshot": asset_id}, "folder_id"}}` | Arabic card = same template mirrored; pass the Arabic screenshot. Refuses words that don't fit. |
| Card straight onto a post | `composer_use_brand_card {"piece_id","variant_id","params": {"template_id", "words", "pictures"}}` | Without `words` it uses the post **plan's** words (title/subtitle) and the approved tagline; pass `words` to control exactly what the card says. Uses the attached screenshot if no `pictures` given. |
| Make/adjust a template | `templates_create_template`, `templates_update_template` | Send the whole spec on update. Per-size picture placement is `{"key": {x,y,width,height}}`. |
| Upload a file | `library_upload_asset {"params": {"file_name","data": base64,"folder_id"}}` | Large files in parts. Tag with `library_tag_asset`. |
| Edit a picture | `images_crop_image`, `images_place_text`, `images_add_logo`, `images_cut_out` | `images_add_logo` places the real file; never let a model draw a logo. |
| Generate a picture | `images_generate_image` | Rarely right for brand posts — see `visual-cards.md`. Dry run shows model and cost. |

## Plan and publish

| Job | Tool | Notes |
|---|---|---|
| Plan a date (no page needed) | `composer_edit_variant` with `params.scheduled_for` | Shows as `planned` on the calendar. |
| Review flow | `composer_submit_for_review` → `composer_approve` / `composer_request_changes` | |
| Schedule | `composer_schedule_piece {"piece_id","params": {"when","variant_ids"},"confirm"}` | Approved variants only; dry run first. |
| Post now | `composer_publish_piece` | Dry run first. |
| Move / cancel / retry | `composer_reschedule_variant`, `composer_cancel_piece`, `composer_retry_variant` | |
| Results | `composer_results {"scope": "piece"/"brand"/"workspace"}`, `publishing_refresh_metrics` | |

## Library

`library_list_folders`, `library_create_folder`, `library_move_assets`, `library_list_assets
{"unused": true, "tag", "q"}`, `library_get_asset` (what uses it), `library_delete_assets`
(dry run first). See `library-hygiene.md` before any delete.

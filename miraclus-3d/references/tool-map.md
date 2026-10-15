# Tool map: Miraclus 3D (`mcp__miraclus__*`)

All of these work in the token's workspace. Ids are library asset ids.

## Reading (free)

| Tool | What you get |
|---|---|
| `geometry_model_options` | Formats, units, up axes, the edit menu with its fields, materials, camera paths, the photo-to-3D models with their prices, and whether photo to 3D is set up |
| `geometry_model_info` | One model: `preview` (`status`, `thumbnail_url`, `view_url`, `facts` with `size_m` [x, y, z], `faces`, `materials`), `made_from`, and `versions` (oldest first, `current`, `made_by`) |
| `geometry_drawing_info` | One drawing: picture, `layers` (name and count), `units`, `size_m`, and the guessed `wall_layers` and `opening_layers` |
| `library_list_assets` | `kind="model"` or `kind="drawing"` lists them; each carries its `preview` |

## Free work (Mac CPU, seconds to minutes)

| Tool | Notes |
|---|---|
| `library_upload_asset` | Its preview is made in the background; `geometry_model_info` shows `pending`, then `ready` or `failed` with the reason |
| `geometry_prepare_model` | Remakes a preview now |
| `geometry_export_model` | `format`: fbx, obj (a zip of model, materials and textures), glb, stl, ply. `units`: m, cm or mm, for obj, stl and ply only. `up`: z or y. Saved to the Library, tagged *export* |
| `geometry_plan_edit` | Words become operations from the menu, plus `unsupported`. Nothing changes |
| `geometry_edit_model` | `ops` from the menu (below), applied in order; `with_asset_ids` for `combine`. Makes a new version |
| `geometry_camera_path` | `path`, `seconds` (1–10), `width`, `height`, `quality` (samples: 16 is a guide, 48 is clean), `eye_height`, `keyframes` (2–6). Returns `keyframes`, `first`, `last` and a `preview` mp4 |
| `geometry_convert_drawing` | DWG to DXF |
| `geometry_plan_to_model` | `wall_layers`, `opening_layers` (each guessed when left out), `height` (2.8 m), `thickness` (0.15 m). Makes a GLB shell: walls, cut-outs for doors and windows, a floor |
| `geometry_plan_from_picture` | `asset_id` (a library picture of a plan), `width_m` (outside wall to outside wall). A DXF with hatched walls on A-WALL; text, dimensions and furniture dropped, doors and windows left as gaps. Refuses plans drawn in hairlines |
| `geometry_find_shots` | `count` (2–12, default 10), `quality`, `eye_height` (1.5 m). Stills of views across the whole model: per room from a corner, then outside and from above; a single object gets product angles. Each with `label`, `kind`, `sees_m2` |
| `geometry_interior_start` | `asset_id` (the photo), `shell_asset_id` (optional raised plan), `name`. Free; reads depth, names and measures every object in the background |
| `geometry_interior_get` | `scene_id`. Status (reading, draft, building, ready, failed), the plan (room, objects with box/size_m/position_m/turn_deg/source/same_as), `open_questions`, `to_make`, progress, `result`, `view` |
| `geometry_interior_update` | `scene_id`, `params`: `scale_object` + `scale_width_m`, `objects` edits, `add` [{label, box, on}], `remove`, `room`, `answered`. Free |
| `geometry_interior_build` | `scene_id`, `confirm`. Charged per object made (copies once), refunded per failure; reruns reuse what was made |
| `geometry_interior_list` | The workspace's scenes |
| `geometry_section_to_dxf` | A model cut at `height` m, as a DXF plan for AutoCAD |

## The edit menu (`geometry_edit_model` ops)

| Op | Fields | Use |
|---|---|---|
| `set_size` | `axis` (longest, x, y, z), `metres` | Real size. x is width, y depth, z height |
| `scale` | `factor` | |
| `rotate` | `axis`, `degrees` | z turns it on the floor |
| `mirror` | `axis` | |
| `recolour` | `colour` (#rrggbb), `material` (index, or leave it out for all) | Replaces the texture with a flat colour |
| `material` | `name`, `material` | walnut, oak, white_marble, black_marble, concrete, matte_black, matte_white, brushed_steel, brass, gold, chrome, glass, grey_fabric, beige_fabric, leather_brown, white_plastic |
| `reduce_faces` | `ratio` | Lighter files for the web or a phone |
| `cut` | `shape`, `center`, `size` (shares of the model's own size) | |
| `arrange` | `pattern` (row, grid, circle), `count`, `spacing` | Chairs round a table |
| `combine` | `gap` | Puts the other models in `with_asset_ids` beside it |
| `on_floor` | | Centres it and stands it on the floor |
| `smooth` | `angle` | |

## Charged (confirm first)

| Tool | Cost and time |
|---|---|
| `geometry_generate_model` | `asset_id` (one object, the whole of it in view), `model` (pixal3d is closer to the photo; trellis2), `detail` (light 60k faces, standard 200k, high 600k). Two to five minutes |
| `geometry_generate_model_from_prompt` | One picture plus one model. The picture is kept |
| `geometry_rebuild_from_picture` | One picture edit plus one model; a new version |
| `images_change_image` | One picture; to make keyframes photoreal |
| `films_render_film` | Charged per shot second |

## Films around 3D

- `films_create_film`: `asset_ids` are the keyframes in order. Set `preset`, `aspect_ratio`, `resolution`, and a `brief` saying they are frames of one camera move and that the shape must be kept.
- `films_approve_shots`: shots by id, from `films_get_film`.
- `films_check_film`: run the check after stitching again. `checks.problems` lists what it found.
- `films_update_film`: `spend_cap` caps what a render may cost.

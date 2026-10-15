---
name: miraclus-3d
description: Use when working with 3D models or CAD drawings through the Miraclus MCP server (mcp__miraclus__geometry_* tools) - making a 3D model from a product photo or a description, changing one, exporting it for 3ds Max, Blender, AutoCAD, the web or 3D printing, a product 360 or turntable, a walkthrough of a floor plan (DWG or DXF), an off-plan property film, or when someone hands over a .max, .skp or .rvt file. Also when deciding whether an ad should go through 3D at all.
---

# Miraclus 3D

## Overview

Miraclus keeps 3D models (GLB, glTF, FBX, OBJ, STL, PLY) and CAD drawings (DXF, DWG) in the Library and can make,
change, export and film them. Every result is a new library file made from the one before; nothing is overwritten.

**Core principle: 3D is for when the same object or space must stay exactly the same from shot to shot, and for
handing a model to someone. Size it, look at it, and confirm every charge before it goes anywhere.**

## Should this go through 3D at all?

| Use 3D | Do not use 3D |
|---|---|
| Off-plan property from its floor plan, interiors, architecture | People, faces, emotion, lifestyle, food, mood |
| A product 360 or turntable, packaging, a product that must not warp | Anything a picture-to-video film already does well |
| A model for a 3ds Max, Blender or AutoCAD user | A "premium feel" request with no object or space to keep |

Not 3D? Say so in one line and use Studio or Films instead.

## Rules that are easy to miss

1. **Real size before handing a model over.** A model made from a photo has an arbitrary size. Ask for the real
   size, or read it from the product page, then `geometry_edit_model` with `set_size` (metres, longest side or
   one axis). A designer receiving a 4 m chair loses an hour.
2. **The right export for the program.**
   - 3ds Max: FBX, up `z` (the textures are inside the file, and the unit is in it).
   - OBJ, STL and PLY have no unit: set `units` to what the other person works in, usually `cm` for Max, `mm` for printing.
   - The web: GLB.
3. **Order of changes:** `geometry_rebuild_from_picture` makes a new shape from a changed picture and loses earlier
   exact edits. Rebuild first, then `set_size`, `material` and `recolour` on the rebuilt version.
4. **Words go through the plan.** Use `geometry_plan_edit` → show the steps → `geometry_edit_model`. What the menu cannot do (add a part, longer legs) is a
   rebuild from the picture (charged) or a 3D artist's job, never a whole-model scale that fakes it.
5. **Look before you hand over.** Check the thumbnail and facts (`geometry_model_info`: size, faces) after every
   make or change, and the keyframes after every camera path. A bad result is not sent on.
6. **Charged calls are confirmed.** `geometry_generate_model`, `geometry_generate_model_from_prompt`,
   `geometry_rebuild_from_picture` and `films_render_film` go `confirm=false` first; show the summary and price;
   `confirm=true` only after a yes. "Don't ask me questions" covers free steps, never spending.
7. **Closed files are not opened.** A .max, .skp, .rvt, .blend or .c4d file is refused at upload. Ask for an FBX,
   glTF/GLB or OBJ export from that program, and carry on with what you have (a floor plan, a photo).
8. **You cannot send files anywhere.** Give the download link and say plainly that it has not been sent.

## An interior from a photo

1. `geometry_interior_start` with the photo (and `shell_asset_id` to furnish a raised plan). Free; it reads in the
   background: poll `geometry_interior_get` until `status` is `draft` (about two minutes).
2. Show the person the proposal: the room, each object with its size and place and its `source` (measured, guess,
   yours), and `open_questions`. Ask them the questions, the scale one first ("do you know the real width of the
   counter?"); one real width rescales everything. Never invent their answers: what they skip keeps the proposal.
3. Apply answers with `geometry_interior_update`: `scale_object` + `scale_width_m`; object edits (`make`, `size_m`,
   `position_m`, `turn_deg`, `same_as` to make copies once); `add` for things missed (a box in photo fractions);
   `remove`; `answered` with the question ids dealt with.
4. `geometry_interior_build` with `confirm=false`, show the price (one model per object made), `confirm=true` after a
   yes. Poll `geometry_interior_get` until `ready`; `result` is the scene model (export it, film it), `view` the
   render from the photo's camera to show beside the photo, `parts` each object alone at real size
   (`geometry_interior_export_parts` zips them as FBX). All of a scene's files are in its Library folder
   (`folder_id`), under 3D.

## The film route (property, product 360)

1. A model: from a photo, a prompt, an upload, or `geometry_plan_to_model` from a DXF or DWG plan (check the layers
   with `geometry_drawing_info` first). A plan that is only a picture: `geometry_plan_from_picture` with its real width
   in metres (ask; never guess it) makes the DXF first. It needs filled or hatched walls and refuses hairline plans.
   For a whole property or a 3ds Max scene, `geometry_find_shots` offers views across every room and the outside;
   show the labels, let the person pick and order them, and pass those picture ids to `films_create_film` (step 4)
   instead of a single camera move.
2. `geometry_camera_path`: orbit or half_orbit for products, push_through or walkthrough for spaces. For a thin or flat
   product (a blade, a phone, a board) use half_orbit or dolly_in: a full orbit passes the edge-on view, where the video
   model loses the shape (the check after stitching flags it). A move is at most
   10 s, so a longer film is several *different* moves (push_through then walkthrough; orbit then dolly_in):
   the same path twice gives the same move, since the route is chosen from the model. `keyframes` (2–6) are the pictures kept.
3. A shell from a plan is plain white. Before filming, offer to make the keyframes photoreal with `images_change_image`
   ("photoreal interior, real materials, natural light, keep the walls, openings and camera exactly"). It is charged
   per picture, so confirm first. Restyle keyframe 1 first, then pass it as `reference_asset_ids` when restyling the
   others: restyled one by one, each frame gets different furniture and the film dissolves between them.
4. `films_create_film` with the keyframes in order, the preset (`property` or `product`), and the destination's shape
   (`9:16` for Reels, Stories and TikTok, `1:1` or `4:5` for the feed, `16:9` for YouTube and the web). The film is free until it renders.
5. `films_approve_shots`, then `films_render_film` with `confirm=false` → a yes → `confirm=true`. After it is
   stitched, read `checks` on the film and tell the person what it found.

Details and every tool's fields: `references/tool-map.md`. When it goes wrong: `references/troubleshooting.md`.

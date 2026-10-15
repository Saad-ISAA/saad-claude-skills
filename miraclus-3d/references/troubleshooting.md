# When it goes wrong

| What you see | What it means | What to do |
|---|---|---|
| Upload refused, `closed_format` | .max, .skp, .rvt, .blend, .c4d, Maya or USD | Ask for an FBX, GLB or OBJ export from that program |
| Preview `failed`: "points at another file" | A glTF or GLB that names files beside it (a separate .bin or textures) | Ask for one self-contained GLB with everything embedded |
| Preview `failed`: "no 3D surfaces" | An empty file, or only cameras and lights | Ask for the model again |
| Preview `pending` for minutes | The 3D worker is busy or down | Wait, then `geometry_prepare_model`; if that fails too, tell an admin |
| `not_set_up` on photo to 3D | The second render server (on the Spark) is off | Tell the person; uploads, edits and exports still work |
| `failed`, "not charged" | The render server could not make the model | Try once more; a busy or cluttered photo fails more often. Use one object on a plain background |
| A model looks melted or blobby | The photo showed a part side-on, or the object was cut off | Use a three-quarter photo with the whole object in view, or `detail: high` |
| A model is huge or tiny | Photo models have no real size | `set_size` with the real measurement |
| Raised plan has no walls, or walls everywhere | The wrong layers were used | `geometry_drawing_info`, then pass `wall_layers` and `opening_layers` explicitly |
| A walkthrough shows only a wall | The space is too small or has no clear line | Use push_through, or raise the plan with thinner walls |
| `over_cap` on a film render | The film's spend cap is lower than the render | Shorten or drop shots, or ask the person to raise the cap |
| `checks.problems` after a film | What the check after stitching found | Tell the person, and suggest re-rendering only the shots named |

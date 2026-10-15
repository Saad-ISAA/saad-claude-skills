# miraclus-3d

`/miraclus-3d`: 3D models and CAD drawings through the Miraclus MCP server. Make a model from a product
photo or a description, change it, export it for 3ds Max, Blender, AutoCAD, the web or 3D printing, raise
a DWG or DXF floor plan into a 3D shell, and film a product 360 or a walkthrough as a Miraclus film.

## What it changes

Tested against an agent that had the tools but no skill (2026-10-15). Without it, the agent:

- exported a photo-made model to a 3ds Max designer at whatever size it came out;
- ignored the 9:16 shape for Reels and the 10-second limit of one camera move;
- would film a plain white shell straight from a floor plan;
- applied walnut and then rebuilt the model from its picture, which threw the walnut away.

With it, the agent sets the real size, picks the right export, rebuilds before exact edits, makes the
keyframes photoreal before filming, looks at every result, and confirms every charge.

## Setup

The same Miraclus MCP server as `miraclus-marketing` (see that skill's README). Photo to 3D needs the
Miraclus server's second render server; uploads, edits, exports, drawings and camera moves do not.

## Contents

| File | Purpose |
|---|---|
| `SKILL.md` | When to use 3D (and when not), the rules that are easy to miss, the film route |
| `references/tool-map.md` | Every geometry tool, the edit menu, what is charged |
| `references/troubleshooting.md` | What each failure means and what to do |
| `evals/evals.json` | The four scenarios the skill was tested with |

# Library hygiene

## Folders

One parent folder per brand, e.g.

```
<Brand>
  Brand
    Logos & fonts
    Template backgrounds
    Product screenshots      (sources, tagged `source`)
  <Series or campaign>
    01 · <post title>        (only the cards that post uses)
```

Pass `folder_id` when rendering and uploading so files land in place as they are made.

## Tags

`logo`, `font`, `template`, `brand` for brand assets; `screenshot` + `source` for capture sources;
`card` for rendered cards.

## Cleanup — the trap

`library_list_assets {"unused": true}` lists files **no post, template or kit currently points
to**. That includes the sources you need to re-render cards: a rendered card is a flat image, so
the screenshot it was made from looks unused. It can also include logos and fonts.

So:
1. List unused files.
2. **Exclude** anything tagged `source`, `logo`, `font`, `template`, and brand originals.
3. Dry run `library_delete_assets` (`confirm=false`); show the list and the size.
4. Delete on a yes. Deletion is permanent.

Prefer deleting what you created and replaced (old card versions, test renders) right after
replacing it, so cleanups stay small.

## Don't create clutter

Render only the cards posts use. Don't pre-render every size "for later" — templates make any size
in seconds when needed, and stored copies go stale when wording changes.

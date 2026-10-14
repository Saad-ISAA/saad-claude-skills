# Visual cards — design from the brand

The card is the first thing the feed shows. It must look like the brand at phone size, in both
languages, and show something true.

## What to use

| Post type | Visual |
|---|---|
| Introduction, story, opinion, invitation, trust/data topics | **Intro card**: brand background, logo, eyebrow, headline, subtitle, tagline. |
| Feature or how-it-works | **Feature card**: same frame plus a **real product screenshot** in a picture slot. |
| Numbers | A stat layout: one large number, a context line, a source. Only real numbers. |
| Multi-step or list content | A carousel (one template, slide 1 works alone, one CTA at the end). |

Build these as Miraclus templates once per brand (`templates_create_template`) from the brand's
own colours, fonts and logos; then every card is one `templates_render_template` call.

## Never

- **AI-generated landmarks, skylines, flags, traditional dress, coffee pots, deserts** or other
  cultural props to signal a market. They are clichés, frequently wrong, and tie the brand to a
  place it may not want.
- A model drawing the **logo**, the **product UI** or **words**. Place the real logo
  (`images_add_logo` or the template's logo slot); use real screenshots; set text in the template.
- Stock-style scenes that could advertise any product.

If the brand wants imagery, use a deliberate brand motif (a pattern from the logo's shapes, an
abstract line drawing) baked into the template background — made once, reused, never a per-post
generation. A motif showing a **real place** (a skyline, a landmark) is a place claim: use it only
if the owner chose that framing, knowingly, and flag it in reviews when the brand sells beyond
that place.

## Shape and layout

- **LinkedIn feed: portrait 4:5** (1080×1350). Square is acceptable; landscape 1.91:1 is for link
  previews, which come from the website's own `og:image`, not from uploaded cards.
- Render **only the shape a post uses**, per language. Other shapes take seconds when needed.
- **Safe margins**: at least ~50 px clear on every edge; keep logo and key text away from corners
  the platform overlays.
- **Text limits**: headline about 6 words per line, at most 3 lines; nothing smaller than ~20 px at
  1080 wide; one focal point. If a line breaks badly ("on-" / "premises"), shorten the words — the
  template refuses text that won't fit, it does not fix awkward breaks.
- **Contrast** at least 4.5:1 for every line, including muted secondary colours and text near a
  screenshot.
- **Arabic card** = the same template mirrored, Arabic logo, Arabic font, Arabic screenshot.

## Templates in practice

- `templates_get_template` before editing; send the **whole spec** to `templates_update_template`.
- Re-check the template after any platform redeploy (logo and font ids) — a reset template still
  renders, just wrong.
- Brand fonts: upload the font file to the library and set the template's font; use a variable
  font file so every weight renders.
- Picture slot: the slot's aspect should match the screenshot crop (e.g. 16:9) or the screenshot
  gets cut.

## Look at it

Download the rendered file (`library_get_asset` link) and **look** at both languages before
attaching. Check: logo complete, fonts right, nothing cut, no orphan words, screenshot readable,
Arabic shaping correct. A render that passes the tool can still be visually wrong.

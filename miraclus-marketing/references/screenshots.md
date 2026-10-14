# Product screenshots for marketing

A real screen is the strongest proof a feature post has. It is also the easiest way to leak a
customer's data or ship a broken-looking product.

## Data

- Capture from a **demo workspace with invented content** — never a real customer's project,
  names, amounts, emails or meeting text.
- Build the demo deliberately: realistic titles, sensible dates, a believable spread of statuses.
  Avoid states that look broken (everything overdue, empty columns, "Untitled").
- Demo content in each language you post in. An Arabic card needs an Arabic screen with Arabic
  data, not an Arabic interface around English demo text.
- Neutral examples: no real companies, cities or countries unless the brand chose them.

## No demo workspace or screens yet?

Say so and plan it: a feature post without a real screen uses the intro card (no screenshot), or
waits until the owner provides screens or a demo workspace. Never mock up product UI or have a
model draw it.

## The capture

1. **Theme**: match the cards (usually the light theme). Set it explicitly; don't inherit whatever
   the browser had.
2. **Language**: switch the interface language for the capture only, then switch it back.
3. **Hide personal context**: collapse sidebars that list recent items or workspaces; close banners
   (beta notices, trial counters); move the pointer out of frame; no notifications or avatars of
   real people.
4. **Browser translation off**: an auto-translating browser turns an Arabic UI back into English.
5. **Size**: a consistent window (e.g. 1600×1000) at 2× pixel density.
6. **Crop to the slot's shape** (e.g. 16:9 from the top so the page header shows).
7. **Look at it** at full size: labels translated, no raw ids, nothing red that shouldn't be, no
   leftover English in an Arabic screen.
8. **Readable at phone size**: a card is seen about 400 px wide. A whole page shrinks to noise —
   crop to the one region that proves the point (two board columns, one section, one answer),
   ideally at 2× zoom, so its text is still legible on the card.
9. **No people or internals**: no real person's name or avatar (log in as a demo user), no
   developer or integration labels, no half-finished states ("Choose a board", empty fields)
   unless the point of the post is that state.

## When the product is the problem

If a screen shows a bug (untranslated labels, raw ids, wrong colours), **don't paper over it in the
picture**. Log it for the product team, choose another screen, or wait for the fix. Never claim a
capability in the post that the screen doesn't show working.

## Storing

Upload to the brand's screenshots folder, tag `screenshot` + `source`, name by screen and language
(`screen-board-ar.png`). These are sources for re-rendering cards — see `library-hygiene.md`.

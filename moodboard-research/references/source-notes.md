# Source Notes

Per-source notes on what works, what doesn't, and how each scraper behaves. Updated when sources change.

## Pinterest (`sources/pinterest.js`)
- **Runtime:** Playwright. Anonymous (login wall is dismissed via `Escape`).
- **Quirks:** Sparse / SEO-spammy alt-text. Scoring undershoots. Scraper falls back to **threshold ≥ 6/12** and tags those entries `"relaxed": true`.
- **Image URL trick:** thumbnails like `/236x/...` resolve to high-res at `/originals/...`. Try `/originals/`, fall back to the largest size that returns 200.

## ArchDaily (`sources/archdaily.js`)
- **Runtime:** Playwright (search pages are JS-rendered; project pages are server-rendered).
- **Image hosting:** `images.adsttc.com/media/images/<hash>/<size>-<slug>.jpg`. Sizes: `thumb_jpg / medium_jpg / large_jpg / newsletter / big`. Prefer `big`, fall back to `large_jpg`.
- **Filter:** Reject project titles containing "villa", "penthouse", "mansion", "luxury", "tower" before opening.

## ArtStation (`sources/artstation.js`)
- **Runtime:** Playwright.
- **Caveat:** Returns 3D archviz renders, NOT photographs. The contact sheet labels this section "ArtStation (3D renders)".
- **Image hosting:** `cdna.artstation.com/p/assets/images/.../{4k,large,medium}.jpg`. Try `4k.jpg`, fall back to `large.jpg`.
- **Aggressive AVOID filtering:** "luxury", "penthouse", "fantasy", "sci-fi", "futuristic", "marble", "gold" are auto-rejected at the title/tag layer.

## Unsplash (`sources/unsplash.js`)
- **Runtime:** Playwright. Plain HTTP returns 401.
- **Image URL trick:** Append `?w=2400&q=85` to get high-res.

## Pexels (`sources/pexels.js`)
- **Runtime:** Plain HTTP works (`fetch`).
- **Image URL trick:** Listing thumbnails are downsized; replace `?auto=...` query with `?cs=srgb&dl=...&fm=jpg&w=2400` or use the `/large/` / `/original.jpg` variants.

## Are.na (`sources/arena.py`)
- **Runtime:** Python, public JSON API, no auth.
- **Caveat:** `/v2/search/blocks` started returning 403 without auth in early 2025. Scraper falls back to **channels-only**: search channels, pick top-relevance, fetch their contents, filter `class: "Image"` blocks.
- **Quality:** Highest avg score of any source in tests — channels are already curated.

## Dezeen (`sources/dezeen.js`)
- **Runtime:** Playwright (HTTP returns 403).
- **Image hosting:** `static.dezeen.com/uploads/YYYY/MM/<slug>-<size>.jpg`. Sizes include `sq2`, plain (full), and various widths. Prefer plain.
- **Filter:** Reject titles containing "luxury villa", "penthouse", "tower". Editorial site, generally on-brief.

## Houzz (`sources/houzz.js`)
- **Runtime:** Playwright.
- **Image hosting:** `st.hzcdn.com/.../...jpg`. Filter out `apple-touch-icon`, `sprite`, and small thumb sizes.
- **Quirks:** Heavy lazy-loading; scroll 4–6 times.

## Dwell (`sources/dwell.js`)
- **Runtime:** Playwright.
- **Image hosting:** `images.dwell.com/photos/.../large.jpg`. Mind the path structure — `large` not always available, try `xlarge` / `original`.

## Reddit (`sources/reddit.py`)
- **Runtime:** Python, JSON API (`/r/<sub>/top.json?t=year`). No auth needed.
- **Subs queried:** `CozyPlaces`, `InteriorDesign`, `Houseporn`, `centuryhomes`, `midcenturymodern`, `AmateurRoomPorn`, `malelivingspace`, `femalelivingspace`. Configurable inside the script.
- **Gallery posts:** When `is_gallery: true`, follow `https://www.reddit.com/<permalink>.json` to extract image URLs from `media_metadata`.
- **NSFW filter:** Posts with `over_18: true` are dropped.
- **Image quality:** Reddit images are user-uploaded — score on the post title text. Original-quality URLs are at `i.redd.it/...jpeg` (no transformation needed).

## Dropped / failed sources (don't reintroduce without re-testing)
- **Behance** — Blocks downloads from authenticated CDN URLs; search filter `field=interior-design` doesn't actually filter.
- **Dribbble** — Content is illustration/UI/3D-cartoon, not on-brief for photographic moodboards. (Removed at user request.)
- **The Modern House** — Image URLs use a non-standard CDN pattern; not worth the scraping effort.
- **Apartment Therapy** — Returns 403 to Playwright; aggressive Cloudflare.
- **Flickr** — Search page is JS-rendered behind authentication; results are thin without an API key.
- **Est Living** — URLs changed; current entry points unstable.

## Adding a new source

1. Add an entry to `scripts/sources.json` with `id`, `runner` (`node` or `python`), `script` (relative path), `target`, `min_threshold`.
2. Write the scraper at the script path. It MUST:
   - Read `MB_OUTPUT_DIR`, `MB_LOG_FILE`, `MB_QUERIES`, `MB_TARGET`, `MB_MIN_THRESHOLD` from env.
   - Write images to `MB_OUTPUT_DIR/<source>_NN_three-word-slug.<ext>`.
   - Write `MB_OUTPUT_DIR/manifest.json` as a JSON array following the schema in SKILL.md.
3. Update this file with notes.
4. Run an end-to-end test against a known brief before committing.

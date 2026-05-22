---
name: moodboard-research
description: Build a visual moodboard for any creative brief by gathering 100+ curated reference images from 9 image sources (Pinterest, ArchDaily, ArtStation, Unsplash, Pexels, Are.na, Dezeen, Houzz, Dwell, Reddit) in parallel, then producing a self-contained HTML contact sheet. Use when the user asks for inspiration images, references, moodboard, visual research, or to "gather pictures" for a theme, mood, or design brief.
---

# Moodboard Research Skill

A multi-agent visual-research pipeline. Given a creative brief (subject + mood + style + palette + avoid list), the skill gathers ~100–200 curated reference images from 9 sources in parallel, scores each against a 6-axis rubric, deduplicates, and produces an HTML contact sheet.

## When to invoke

- User asks for "inspiration images" / "references" / "moodboard" / "visual research" / "ideas for X"
- User wants "pictures of X" for design / decor / branding / film / illustration purposes
- User mentions building a Pinterest-like board for a creative project

## Workflow

```
1. Bootstrap environment  →  ./scripts/bootstrap.sh
2. Capture brief          →  prompt user, write to <output-root>/_brief.md
3. Run source agents      →  ./scripts/orchestrate.js
4. Aggregate              →  ./scripts/aggregate.js
5. Report                 →  print top 10 + open contact sheet
```

## Step 1 — Bootstrap environment

Run `./scripts/bootstrap.sh` from the skill directory. It will:
- Check for Node.js ≥ 18; if missing, instruct the user how to install (does NOT auto-install Node — sudo-free install is unreliable; clear instructions are safer).
- Check for Python 3.9+; uses system `python3` on macOS, otherwise instructs the user.
- Create a Python venv at `.venv/` and `pip install requests Pillow` into it.
- Run `npm install` in the skill dir (installs `playwright` and `sharp` locally).
- Run `npx playwright install chromium` (downloads ~150MB browser binary).
- Verify everything with a smoke test.

Bootstrap is idempotent — safe to re-run.

## Step 2 — Capture the brief

If the user gave a one-line theme ("modern apartment"), expand it into the full brief format using `templates/brief-template.md` as a guide. Ask the user to confirm or edit before proceeding. The brief MUST capture:

- **Subject** — what the images are *of*
- **Mood / atmosphere** — how they should *feel*
- **Style references** — named styles, eras, movements
- **Color palette** — words like "earthy", "muted", "high-contrast"
- **Avoid** — concrete patterns the user does NOT want (e.g. "luxury", "AI-art look", "stock-photo clichés")

Then derive **8–12 search queries** that hit the brief from different angles: literal subject, mood, color, composition, style, named references. Save the brief to `<output-root>/_brief.md`.

## Step 3 — Run source agents

Invoke `./scripts/orchestrate.js <output-root>`. The orchestrator:
- Reads `<output-root>/_brief.md` (queries section)
- Spawns each source's scraper concurrently (Node.js child processes)
- Each scraper writes images + a `manifest.json` to its own subfolder
- Logs go to `<output-root>/_logs/<source>.log`

Sources (configured in `scripts/sources/`):

| Source | File | Runtime | Notes |
|---|---|---|---|
| Pinterest | `pinterest.js` | Playwright | Anonymous; login-modal dismissed |
| ArchDaily | `archdaily.js` | Playwright | Editorial apartments |
| ArtStation | `artstation.js` | Playwright | 3D renders (flag in UI) |
| Unsplash | `unsplash.js` | Playwright | Stock photography |
| Pexels | `pexels.js` | HTTP | Stock photography |
| Are.na | `arena.py` | Python | Public JSON API |
| Dezeen | `dezeen.js` | Playwright | Highest-yield editorial |
| Houzz | `houzz.js` | Playwright | Photographic |
| Dwell | `dwell.js` | Playwright | Editorial photography |
| Reddit | `reddit.py` | Python | Multi-sub JSON API |

To skip a source, pass `--skip=pinterest,houzz` or edit `scripts/sources.json`.

## Step 4 — Aggregate

Invoke `./scripts/aggregate.js <output-root>`. The aggregator:
- Reads every per-source `manifest.json`
- Computes a perceptual hash (dHash, 64-bit) for each image
- Deduplicates across sources at Hamming distance ≤ 6 (keep higher-scoring copy)
- Writes `<output-root>/_master_manifest.json`
- Writes `<output-root>/_contact_sheet.html` (self-contained, dark theme, ⭐ top-10 row pinned)

## Step 5 — Report

Print:
- Per-source counts + avg scores
- Cross-source duplicates dropped
- Wall-clock time
- Any source that returned thin results or was blocked
- Top 10 picks across the whole pool, with the 1-sentence description from the manifest

Then `open <output-root>/_contact_sheet.html` (macOS) or print the path for Linux.

## Scoring rubric

Every candidate is scored 0–2 on six axes (full text in `references/scoring-rubric.md`):

| Axis | What it measures |
|---|---|
| subject | does the image actually show the subject? |
| mood | warmth / atmosphere alignment |
| composition | intentional framing? |
| color | palette match |
| style | medium / aesthetic match |
| originality | NOT a stock cliché |

Keep only images with **total ≥ 8/12** AND **≥ 1 on at least 4 axes**.

If a source can't reach 20 survivors above threshold, that's OK — return what passes and note it. Quality over quantity. (Pinterest historically returns thinner due to sparse alt-text; the Pinterest scraper falls back to a relaxed 6/12 threshold and flags those entries in the manifest.)

## Standard manifest schema

Every per-source `manifest.json` MUST be a JSON array of objects with these keys:

```json
{
  "filename": "<source>_NN_three-word-slug.jpg",
  "source_url": "https://...image.jpg",
  "page_url": "https://...page-the-image-was-found-on",
  "query": "the search query that surfaced this",
  "description": "one-sentence description of what's in the image",
  "score": 10,
  "score_breakdown": {
    "subject": 2, "mood": 2, "composition": 2,
    "color": 2, "style": 1, "originality": 1
  },
  "dimensions": "2400x1600"
}
```

The aggregator tolerates legacy field names (`file`, `image_url`, `project_url`, `axes`, `title`) for backward compatibility, but new scrapers SHOULD use the schema above.

## Rules

- **Realistic User-Agent** on every request. Rate-limit 1–2 req/sec. Respect `robots.txt`.
- **No anti-bot evasion** (no captcha solving, no proxy rotation). If a source blocks, LOG and skip.
- **Personal moodboard use only** — manifests preserve `page_url` so attribution is possible later. Don't commit downloaded images to public repos.
- **Every saved image needs a written description and score breakdown** — no blind scraping.

## File map

```
moodboard-research/
├── SKILL.md                          ← this file
├── package.json                      ← Node deps (playwright, sharp)
├── requirements.txt                  ← Python deps (requests, Pillow)
├── scripts/
│   ├── bootstrap.sh                  ← environment setup
│   ├── orchestrate.js                ← entry point
│   ├── aggregate.js                  ← dedupe + contact sheet
│   ├── _phash.js                     ← perceptual-hash helper
│   ├── sources.json                  ← which scrapers are enabled
│   └── sources/
│       ├── pinterest.js
│       ├── archdaily.js
│       ├── artstation.js
│       ├── unsplash.js
│       ├── pexels.js
│       ├── arena.py
│       ├── dezeen.js
│       ├── houzz.js
│       ├── dwell.js
│       └── reddit.py
├── templates/
│   ├── brief-template.md
│   └── README.md                     ← what these templates are for
└── references/
    ├── scoring-rubric.md             ← the 6-axis rubric
    └── source-notes.md               ← per-source quirks & known issues
```

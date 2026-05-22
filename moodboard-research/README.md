# moodboard-research

A Claude skill that builds a visual moodboard for any creative brief — gathers ~50–80 curated reference images from 9 sources in parallel, scores each against a 6-axis rubric, deduplicates, and produces a single HTML contact sheet.

(Want more or fewer images? Edit the per-source `target` values in `scripts/sources.json`. Defaults sum to ~80–90 candidates, ~50–80 surviving after scoring and dedup.)

## Supported platforms

- **macOS** — works natively. Use the install steps below.
- **Linux** — works natively. Use the install steps below. (On Debian/Ubuntu you may need `sudo apt-get install python3-venv` first.)
- **Windows** — install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) first, then run everything below from inside WSL. See the [Windows section](#windows-installing-via-wsl2) at the bottom. (No native PowerShell support yet.)

## Install

### Step 1 — Drop the skill into your Claude skills directory

User-level (recommended — available in every Claude Code session):

```bash
SKILL=moodboard-research
mkdir -p ~/.claude/skills
curl -L "https://github.com/Saad-ISAA/saad-claude-skills/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1 -C ~/.claude/skills "saad-claude-skills-main/$SKILL"
```

Or project-level (only inside one project):

```bash
cd /path/to/your/project
SKILL=moodboard-research
mkdir -p .claude/skills
curl -L "https://github.com/Saad-ISAA/saad-claude-skills/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1 -C .claude/skills "saad-claude-skills-main/$SKILL"
```

### Step 2 — One-time bootstrap

Unlike most skills, `moodboard-research` runs real code (Playwright + Python scripts), so it needs a one-time environment setup. The first time you ask Claude to use this skill, it will automatically run the bootstrap; you can also run it yourself ahead of time:

```bash
bash ~/.claude/skills/moodboard-research/scripts/bootstrap.sh
```

The bootstrap is idempotent and:

- Verifies **Node.js ≥ 18** is installed (does not auto-install — prints clear instructions if missing).
- Verifies **Python 3.9+** is installed (uses system python on macOS).
- Creates a local Python **venv** at `.venv/` (no global package pollution) and installs `requests` + `Pillow`.
- Runs `npm install` locally (Playwright + sharp).
- Downloads Chromium for Playwright (~150 MB, one time).
- Runs a smoke test.

Time: ~3–5 minutes on a fresh laptop with broadband.

## Use

After install, just talk to Claude:

> "I want a moodboard for a cozy modern apartment."
> "Build a visual research board for a 1960s diner."
> "Gather inspiration images for a Studio Ghibli-inspired bedroom."

The skill auto-activates. Claude will:
1. Confirm/expand the brief (subject, mood, style, palette, avoid).
2. Save the brief to `<output-folder>/_brief.md`.
3. Run all 9 source scrapers in parallel (~15–25 min).
4. Aggregate, dedupe across sources, produce `_contact_sheet.html`.
5. Report the top 10 picks with reasoning.

## Sources

| Source | Type | Notes |
|---|---|---|
| Pinterest | Editorial / community | Anonymous; relaxes threshold when alt-text is sparse |
| ArchDaily | Editorial architecture | Filters out luxury villas / penthouses |
| ArtStation | 3D archviz renders | Flagged in contact sheet as "renders, not photos" |
| Unsplash | Stock photography | High-res via `?w=2400` |
| Pexels | Stock photography | Plain HTTP works |
| Are.na | Taste-curated | Channel-curated; highest quality bar |
| Dezeen | Editorial design | Highest yield in tests (373 candidates) |
| Houzz | Photographic | Heavy lazy-loading |
| Dwell | Editorial residential | Photo magazine archives |
| Reddit | Community | 8 subs (CozyPlaces, InteriorDesign, etc.) |

To skip a source: `node scripts/orchestrate.js <out> --skip=pinterest,houzz`
To run only specific sources: `... --only=arena,reddit`

## Manual usage (without invoking Claude)

```bash
# 1. Write a brief at <out>/_brief.md (use templates/brief-template.md)
mkdir my-moodboard
cp templates/brief-template.md my-moodboard/_brief.md
# (edit my-moodboard/_brief.md — fill in subject/mood/avoid/queries)

# 2. Run the pipeline
node scripts/orchestrate.js my-moodboard

# 3. Aggregate + build contact sheet
node scripts/aggregate.js my-moodboard

# 4. Open the result
open my-moodboard/_contact_sheet.html
```

## Output layout

```
my-moodboard/
├── _brief.md                   ← your creative brief
├── _master_manifest.json       ← all items with scores + source URLs
├── _contact_sheet.html         ← the HTML moodboard (open this)
├── _logs/                      ← per-source run logs
├── pinterest/   (NN jpgs + manifest.json)
├── archdaily/   (...)
├── artstation/  (...)
├── unsplash/    (...)
├── pexels/      (...)
├── arena/       (...)
├── dezeen/      (...)
├── houzz/       (...)
├── dwell/       (...)
└── reddit/      (...)
```

## Adding / removing sources

See `references/source-notes.md` for the contract every source scraper follows and lessons learned about each site. To add a new source: write a scraper to that contract and add an entry to `scripts/sources.json`.

## Rules (built-in)

- Realistic User-Agent on every request
- ~1 req/sec rate-limit per source
- Respect `robots.txt`
- No anti-bot evasion — if a site blocks, the scraper logs and moves on
- Every saved image gets a written description + score breakdown in its manifest
- Personal moodboard use only; manifests preserve `page_url` for attribution

## Troubleshooting

- **"Playwright launch failed"** — re-run `bash scripts/bootstrap.sh`, then `npx playwright install chromium`
- **A source returns 0 images** — check `<out>/_logs/<source>.log`; the site may have changed its layout or started blocking. See `references/source-notes.md` for known-good URL patterns.
- **Bootstrap says Node not found** — install from <https://nodejs.org/> (the official installer) and re-run.
- **The contact sheet shows broken images** — your file manager opened it from a different folder; the HTML uses relative paths. Open it from inside the output folder.

## Windows: installing via WSL2

This skill runs Playwright + Python scripts that assume a Unix-style filesystem and shell. The cleanest way to use it on Windows is **WSL2** (Windows Subsystem for Linux 2). It's a first-party Microsoft feature now — modern, supported, and free.

### One-time WSL2 setup (~5 minutes + reboot)

1. Open **PowerShell as Administrator** (Start menu → right-click "Windows PowerShell" → "Run as administrator").
2. Run:
   ```powershell
   wsl --install
   ```
   This installs WSL2 + the default Ubuntu distribution. Reboot when prompted.
3. After reboot, an **Ubuntu** terminal will open automatically. Set a username + password when asked. You only do this once.
4. From now on, open the "Ubuntu" app from the Start menu whenever you want to use this skill.

If `wsl --install` doesn't exist on your Windows version, follow the manual steps at <https://learn.microsoft.com/en-us/windows/wsl/install>.

### Install the skill inside WSL

Open the Ubuntu terminal (not PowerShell, not Command Prompt) and run:

```bash
# 1. Make sure Node and Python are available inside WSL
sudo apt-get update
sudo apt-get install -y nodejs npm python3 python3-venv python3-pip curl
node --version    # should print v18+; if older, see note below
python3 --version # should print 3.9+

# 2. Install the skill (same one-liner as macOS/Linux)
SKILL=moodboard-research
mkdir -p ~/.claude/skills
curl -L "https://github.com/Saad-ISAA/saad-claude-skills/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1 -C ~/.claude/skills "saad-claude-skills-main/$SKILL"

# 3. Bootstrap
bash ~/.claude/skills/moodboard-research/scripts/bootstrap.sh
```

> **If Ubuntu's apt installs an old Node (< 18):** install a newer one via NodeSource:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt-get install -y nodejs
> ```

### Running Claude Code on Windows

You can either:

- **Use Claude Code inside WSL** (recommended) — install Claude Code in your Ubuntu environment; it will pick up the skill from `~/.claude/skills/moodboard-research/` automatically.
- **Use Claude Code on Windows + skill in WSL** — copy the skill into Windows-side `%USERPROFILE%\.claude\skills\`. The skill files are there, but `bash scripts/bootstrap.sh` still has to run from inside WSL (just point WSL's bash at the Windows path: `bash /mnt/c/Users/YOU/.claude/skills/moodboard-research/scripts/bootstrap.sh`). This is more brittle and not recommended.

### Where do the output images live?

Inside WSL, your home directory is `/home/<your-wsl-username>/`. You can access WSL files from Windows File Explorer at `\\wsl$\Ubuntu\home\<your-wsl-username>\` — the moodboard contact sheet will open in Windows Edge / Chrome from there.

### Why no native PowerShell support?

The skill could be ported (rewrite `bootstrap.sh` as `bootstrap.ps1`, patch `orchestrate.js` to handle the Windows venv path `.venv\Scripts\python.exe`). The author is on macOS and hasn't tested PowerShell, so WSL2 is shipped as the supported Windows path. If you'd like native PowerShell support, please open an issue.

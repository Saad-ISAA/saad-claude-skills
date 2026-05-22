# Claude Skills

A collection of public [Claude Code](https://claude.com/claude-code) skills that extend Claude with specialized domain knowledge, workflows, and bundled resources.

## Available skills

| Skill | Description | Extra setup |
|-------|-------------|-------------|
| [`drawio-alibaba-cloud`](drawio-alibaba-cloud/) | Create professional Alibaba Cloud architecture diagrams as native `.drawio` files using official `mxgraph.alibaba_cloud.*` icons, hub-and-spoke landing zone patterns, traffic-flow color coding, and clean orthogonal routing. Includes a reference example diagram. | None |
| [`moodboard-research`](moodboard-research/) | Build a visual moodboard for any creative brief — gathers 100–200 curated reference images from 9 sources (Pinterest, ArchDaily, ArtStation, Unsplash, Pexels, Are.na, Dezeen, Houzz, Dwell, Reddit) in parallel, scores each against a 6-axis rubric, deduplicates, and produces a single HTML contact sheet. | One-time `scripts/bootstrap.sh` (Node + Python venv + Playwright) — see [skill README](moodboard-research/README.md) |

*(more skills will be added here over time)*

## Installing skills

Each skill is a self-contained folder. Drop any of them into your Claude Code skills directory and they become available the next time you start a Claude Code session.

### Option A — One-liner install (recommended)

Install a specific skill at user-level (available in every Claude Code session for your user):

```bash
SKILL=drawio-alibaba-cloud
mkdir -p ~/.claude/skills
curl -L "https://github.com/Saad-ISAA/saad-claude-skills/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1 -C ~/.claude/skills "saad-claude-skills-main/$SKILL"
```

Replace `SKILL=` with any skill folder name from the [available skills](#available-skills) table.

### Option B — Clone the whole repo

Install all skills at once:

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/Saad-ISAA/saad-claude-skills.git /tmp/saad-claude-skills
cp -R /tmp/saad-claude-skills/drawio-alibaba-cloud ~/.claude/skills/
# repeat the cp line for each additional skill you want
rm -rf /tmp/saad-claude-skills
```

### Option C — Project-level install

Install a skill only inside a specific project (Claude Code loads it only when running in that project directory). Useful for team-shared skills committed to a repo:

```bash
cd /path/to/your/project
mkdir -p .claude/skills
curl -L "https://github.com/Saad-ISAA/saad-claude-skills/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1 -C .claude/skills "saad-claude-skills-main/drawio-alibaba-cloud"
git add .claude/skills/drawio-alibaba-cloud
git commit -m "Add drawio-alibaba-cloud Claude skill"
```

## Verifying installation

After installing, restart Claude Code (close and re-open the CLI / IDE). Then ask Claude:

```
What skills do you have available?
```

The newly installed skill name should appear in the list. The skill will then auto-trigger when you ask Claude to do tasks that match its description.

> **Skills with extra setup:** Most skills here are pure markdown (instructions + references) and work as soon as they're dropped in. A few — like [`moodboard-research`](moodboard-research/) — bundle executable scripts and need a one-time bootstrap (Node.js, Python venv, Playwright). Check the **Extra setup** column in the skills table and follow the linked skill README. Claude will also offer to run the bootstrap automatically the first time the skill activates.

## Updating skills

Re-run the same install command — `curl … tar -xz` overwrites the existing files.

## Uninstalling

```bash
rm -rf ~/.claude/skills/<skill-name>
```

## Skill structure

Every skill in this repo follows the standard Claude Code layout:

```
<skill-name>/
├── SKILL.md              # Frontmatter (name, description) + workflow instructions
├── references/           # Detailed docs loaded into context only when needed
└── assets/               # Templates, reference files used in skill output
```

## Contributing / requests

Open an issue or PR if you'd like to suggest a new skill, report a problem, or share improvements.

## License

[MIT](LICENSE) — use freely, attribution appreciated.

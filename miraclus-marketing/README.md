# miraclus-marketing

`/miraclus-marketing` — Claude as the **marketing director** for any product, working through the
Miraclus MCP server: brand kits and positioning, social posts in English and
Arabic, brand-card visuals, product screenshots, the social calendar, approvals and scheduling,
results reviews and library hygiene.

The skill is brand-agnostic. It learns each brand from its positioning context and its Miraclus
Brand Kit; nothing about a particular company lives in the skill.

## What it changes

Without it, an agent tends to carry out a weak brief faithfully: one post listing every feature,
an AI-generated skyline "to make it local", a square image, translated Arabic. With it, the agent
challenges the brief (series, not a dump), designs from the brand and the real product, verifies
every claim, writes each language natively, edits out AI tells, looks at every render, and never
publishes without a preview and a yes.

## Setup

1. A Miraclus account and an access token (Miraclus → account menu → **Access tokens**).
2. Connect the MCP server in Claude Code:

   ```bash
   claude mcp add --transport http miraclus <your-miraclus-url>/mcp --header "Authorization: Bearer <your-token>"
   ```

3. Install the skill (see the repository README), then run `/miraclus-marketing` or just ask for
   marketing work while the server is connected.

## Contents

| File | Purpose |
|---|---|
| `SKILL.md` | The director's stance, the brief, the loop, non-negotiables, red flags |
| `references/tool-map.md` | Miraclus tools by job, with argument shapes |
| `references/positioning-context.md` | Building the brand's positioning and keeping the Brand Kit in sync |
| `references/writing.md` | Principles, hooks, AI tells, seven edit passes, Arabic |
| `references/visual-cards.md` | Templates, shapes, safe zones, contrast, what never to generate |
| `references/screenshots.md` | Capturing product screens safely and well |
| `references/content-and-calendar.md` | Pillars, idea scoring, cadence, time zones, the calendar |
| `references/launch-series.md` | Launch arcs and channels |
| `references/publishing.md` | Review, dry run, schedule, manual fallback |
| `references/results-review.md` | The weekly review |
| `references/library-hygiene.md` | Folders, tags, and the cleanup trap |
| `references/troubleshooting.md` | Errors, limits and quirks |
| `evals/evals.json` | Scenarios the skill must handle |

Video generation and paid campaigns are planned as future references.

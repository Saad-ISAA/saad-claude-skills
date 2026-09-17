# `musaad` — give Claude a project board it actually keeps

> Claude forgets everything when a conversation ends. Your board shouldn't.

This skill teaches Claude to use **[Musaad](https://app.musaadai.com)** as its working memory and
task tracker through the Musaad MCP server. Claude plans on a **roadmap**, breaks the work down on a
**board**, moves cards as it works, leaves evidence when it closes them, and picks up exactly where
it stopped next session. You see the real state of the work, live, in the same place your team does.

```
You: "Add CSV export to reports. It's on the Q4 roadmap. Also the date picker is broken on Safari."

Claude:  ✓ Initiative "CSV export for reports" — roadmap, track Reporting, horizon: now
         ✓ Task + 3 subtasks on the board, linked to the initiative (progress rolls up)
         ✓ "Date picker does not open on Safari" — Backlog, tagged bug, cause noted
         → Subtask 1 In Progress… writing code…
         ✓ Subtask 1 Done — commit, test run and timing left as a comment
         ⏸ Subtask 2 Blocked — delimiter for Arabic locales; question asked, options on the card
```

---

## Why Musaad

Musaad is an AI project-management platform built around how projects really run, from the first
document to the last deliverable. English and Arabic throughout.

| | |
|---|---|
| **Plans** | Upload a scope or requirements document; AI drafts the charter, WBS, risks and tasks, grounded in the source |
| **Boards** | Workflow states with guards and approval gates, subtasks, dependencies, Gantt with critical path, baselines and variance, workload and capacity, risk register, custom fields, tags, automations |
| **Roadmaps (Tracks)** | Initiatives in lanes on now / next / later horizons, with progress that **rolls up automatically** from the board work linked to them |
| **Projects** | Chartered endeavours that group boards, up to programmes and portfolios |
| **Meetings** | Record or paste a meeting; get minutes, decisions and action items, searchable across every meeting |
| **Spaces & sharing** | One container and one role model (viewer, member, admin, owner) for everything, with guests and item-scoped access |
| **MCP server** | All of the above, available to Claude, with your permissions and nothing more |

The skill uses the board and roadmap heavily and knows the rest of the tool surface when a task
needs it.

---

## What the skill teaches Claude

- **Roadmap vs board — never mixed.** Initiatives (why / when) on the roadmap; tasks and subtasks
  (what / who / how far) on the board; linked so progress flows up by itself.
- **Card before code.** The card exists and is In Progress before the first edit.
- **Subtasks as verifiable steps**, each moved on the turn its work changes.
- **Blocked is a state, with a reason.** The blocker, the options and who decides go on the card.
- **Done needs evidence**: a commit, PR or test run in a comment, not just a moved card.
- **Asides become Backlog cards** immediately, checked against the code.
- **Session start = rehydrate** from the board, and reconcile stale cards against the code.
- **The API's sharp edges**: new items land in To Do, not Backlog; only `transition_item` changes
  state; `start_board` makes a new board; `sharing` takes a `resource_id`; tags replace; no `bug`
  type.
- **Safety**: archive over delete, confirm before sharing, never put secrets on a card.

---

## Prerequisites

1. **A Musaad account.** Sign up at [app.musaadai.com](https://app.musaadai.com).
2. **A board, and optionally a roadmap**, that you can edit (member role or higher). Claude can
   create them for you too.
3. **A Claude client that supports remote MCP servers**: Claude Code, Claude Desktop or claude.ai.
4. **The Musaad MCP server connected under the name `musaad`** (steps below). The skill refers to
   tools as `mcp__musaad__*`; a different name still works, but Claude will have to translate.

### Connect the MCP server

Server URL: `https://mcp.musaadai.com/mcp`

**Claude Code**

```bash
claude mcp add --transport http musaad https://mcp.musaadai.com/mcp
```

Then run `/mcp` inside Claude Code, choose `musaad`, and sign in to Musaad in the browser window
that opens.

**claude.ai or Claude Desktop**

Settings → Connectors → **Add custom connector** → paste the server URL → sign in and approve.

**Headless (CI, servers, bots that cannot open a browser)**

In Musaad, go to Settings and create a **personal access token** with the shortest lifetime that
works. It acts as you. Keep it in an environment variable or secret store, never in a repo:

```bash
claude mcp add --transport http musaad https://mcp.musaadai.com/mcp \
  --header "Authorization: Bearer ${MUSAAD_TOKEN}"
```

Check it: ask Claude *"list my Musaad boards"*. You should see your boards with your role on each.

---

## Install the skill

User-level (every project):

```bash
SKILL=musaad
mkdir -p ~/.claude/skills
curl -L "https://github.com/Saad-ISAA/saad-claude-skills/archive/refs/heads/main.tar.gz" \
  | tar -xz --strip-components=1 -C ~/.claude/skills "saad-claude-skills-main/$SKILL"
```

Restart Claude Code. The skill triggers whenever you ask Claude to track, plan, break down or report
on work in Musaad, or invoke it directly with `/musaad`.

### Pin a project to its board (recommended)

Copy [`assets/claude-md-block.md`](assets/claude-md-block.md) into your project's `CLAUDE.md` and
fill in the board and roadmap ids. Ask Claude *"what are the ids of my Musaad boards and roadmaps?"*
to get them. Every session then uses the same board without asking.

---

## Using it

| Say | Claude does |
|---|---|
| "Track this feature in Musaad" | Initiative on the roadmap if it is big, task + subtasks on the board, linked |
| "Note that for later" | Backlog card, verified against the code |
| "Where did we leave off?" | Reads the board, reconciles In Progress / Blocked cards with the code, summarises |
| "Set up a roadmap for next quarter" | Roadmap, one track per area, outcome-sized initiatives on horizons |
| "Status report" | Roadmap progress, board state, schedule slip, open risks — from Musaad, not memory |
| "Turn this plan into a board" | Authorises the plan: project, board and baseline in one step |

---

## What's inside

```
musaad/
├── SKILL.md                    # The model, the loop, the sharp edges, red flags
├── references/
│   ├── tool-map.md             # Every tool and action, and which id each one wants
│   └── recipes.md              # Exact call sequences: feature, bug, blocked, ship, roadmap, report
└── assets/
    └── claude-md-block.md      # Drop-in CLAUDE.md block pinning a project to its board
```

## Notes

- Claude acts with **your** Musaad permissions. It cannot see or change anything you cannot.
- Plan limits apply (number of boards, roadmaps, daily AI runs). Claude reports a limit instead of
  working around it.
- Nothing in this skill stores or needs a secret. Sign-in happens in your browser; a personal
  access token, if you use one, lives in your environment.

## License

[MIT](../LICENSE)

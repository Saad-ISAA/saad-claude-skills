---
name: musaad
description: Use when tracking work, tasks, bugs, subtasks, roadmaps or project status in Musaad through its MCP server (mcp__musaad__* tools) - when asked to keep a board or roadmap current, break a feature into tasks, log a bug for later, report progress, resume work from a board at the start of a session, or use Musaad as persistent memory across sessions.
---

# Musaad — the board is your memory

## Overview

Musaad gives Claude an external, shared, persistent place to keep its work: **roadmaps** for
what should happen and when, **boards** for the work that makes it happen. Used well, the board
replaces the scratch todo list that dies with the conversation — the next session, a teammate
or another agent reads the board and knows exactly where things stand.

**Core principle: the card is written before the work, moved as the work moves, and carries the
evidence when it closes.** A board that is updated afterwards is a report; a board updated as you
go is memory.

## Two surfaces — never mix them

| | **Roadmap** (Tracks) — `maydan_roadmaps` | **Board** — `maydan_items`, `maydan_board` |
|---|---|---|
| Holds | **Initiatives**: outcomes, features, themes | **Work items**: tasks, subtasks, bugs |
| Grouped by | **Tracks** (lanes: product areas, teams) | **Workflow states** (Backlog → To Do → In Progress → In Review → Done, plus Blocked) |
| Answers | *Why, and when?* | *What exactly, who, and how far?* |
| Time | `horizon`: now / next / later / done | `start_date`, `due_date` (Gantt, critical path) |
| Progress | Rolls up **automatically** from linked board work | You move it with `transition_item` |
| Size | Weeks to quarters, many sessions | Hours to days, one session or a few |

Rule of thumb: if it would take more than one sitting or needs breaking down, it is a roadmap
initiative with board tasks under it. If you could finish it today, it is a board task.
A bug is a board task (Backlog) unless it is big enough to plan.

In the tools, a board is called a **workspace** (`workspace_id`). Same thing.

## First run in a project — offer to pin it

The very first time this skill runs in a project, check whether the project's `CLAUDE.md` already
has a Musaad block (grep it for "Musaad"). If it does, use the ids in it and say nothing more.

If it does not, once you know which board (and roadmap) this project uses — ask if it is not
obvious — **offer to write it down**, in one line:

> "Want me to add a Musaad block to CLAUDE.md so every session tracks work on *&lt;board&gt;*
> without being asked? It pins the board and roadmap ids and the tracking rules."

On yes: append `assets/claude-md-block.md` to the project's `CLAUDE.md` (create the file if there
is none), filling in the real names and **full UUIDs**, and keep the user's existing content
untouched. Say what you added in one line.

On no, or no answer: carry on and do not ask again this session. Never edit `CLAUDE.md`
unasked — it is the user's file, it is usually committed, and a project may deliberately keep
tracking out of it.

If the pinned board and the board the user just named disagree, do not silently pick one — say so
and ask which it is, then offer to update the block if they are switching.

Re-offer later only if the project moves to a different board, or the pinned ids stop resolving.

## The loop

1. **Start of session — rehydrate.** `maydan_board.get_board(workspace_id)` once. Read the
   `states` (ids + labels + category) and the items In Progress, In Review and Blocked. Those are
   what you were doing. Verify each against the code and git before trusting it — a card can say
   "in progress" for work that already shipped.
2. **Before writing code — card first.** Find the card or create it. Moving to In Progress is the
   first act of the work, not the last.
3. **Break down.** Parent task + subtasks (`parent_id`). One subtask ≈ one verifiable step.
4. **Move as you go.** Each subtask: To Do → In Progress → Done, on the same turn the work
   changes. Stuck → Blocked + a comment naming the blocker and who decides.
5. **Close with evidence.** Before Done, comment what proves it: commit, PR, test result, the
   command you ran. Then transition.
6. **Roll up.** The initiative's progress updates by itself through its links; its status does
   not. Mark it `shipped` when the work is really out (or set `auto_ship_on_complete` on the
   roadmap).
7. **Asides become cards immediately.** A bug mentioned in passing → a Backlog card now, verified
   against the code, before the conversation moves on.

## Mechanics that trip everyone up

- **`create_item` lands in the workflow's initial state — To Do, not Backlog.** Work for later:
  create, then `transition_item` to Backlog.
- **`transition_item` is the ONLY way to change state.** `update_item` has no state field.
- **Never hardcode state ids.** Read them from `get_board().states`; every board has its own.
  `category` tells you what a state means: `todo`, `active`, `done`.
- **Done is terminal** in the default workflow. The only way out is reopening to To Do.
- **A transition can come back `pending_approval`** instead of moving. Nothing changed yet;
  tell the user, do not retry.
- **`start_board` creates a NEW board.** Use it only to start a fresh board from several
  initiatives. To connect an initiative to an existing board, use `maydan_roadmaps.add_link`.
- **Link the parent task, not every subtask.** A `work_item` link counts that item's children
  (or the item itself if it has none). A `workspace` or `phase` link counts every leaf in it.
- **Roadmap `status` ≠ `horizon`.** Status is state (idea / planned / in_progress / shipped /
  deferred); horizon is when. Setting `shipped` moves it to horizon `done` and locks it there.
- **Initiatives are created with `maydan_roadmaps` action `create_item`** (same action name as
  board items, different tool).
- **There is no `bug` type.** Types are epic / task / subtask / milestone / deliverable; mark a
  bug with a `bug` tag.
- **Tags REPLACE.** `set_item_tags` sends the full set; `[]` clears.
- **Full UUIDs only.** Short ids from a UI will not resolve.
- **`sharing` wants `resource_id`**, not the board or roadmap id. Read it from `get_board`
  (`workspace.resource_id`) or `maydan_roadmaps.get` (`roadmap.resource_id`).

## When you are not sure

- **Which board, roadmap or track?** Use the ids pinned in the project's `CLAUDE.md`. None pinned
  and more than one candidate → ask the user once, then offer to pin them
  (`assets/claude-md-block.md`). Never guess a home for someone else's work.
- **No date given?** Leave `target_date` / `due_date` empty. An invented date is worse than none —
  it shows up on the Gantt as a commitment.
- **Next subtask?** Move the next one to In Progress only when you are actually starting it.
- **Tag missing?** `maydan_tags.create(workspace_id, name)` — tags belong to one board (roadmaps have
  their own catalog, `create_tag`); colour is optional.
- **A guard or approval on the board?** `maydan_workflow.list_transitions(workspace_id)` shows them
  before you hit one.

## Writing a card that future-you can use

- **Title:** the outcome, in the reader's words. "CSV export for reports", not "fix stuff".
- **Description:** the mechanism, not the symptom (what is actually true in the code), acceptance
  criteria, and file or area pointers. Enough that a cold session can pick it up.
- **Comments:** decisions and why, blockers, evidence. Comments are the history; the description
  is the current truth — update it when the truth changes.
- **Priority, tags, dates** so the board can be filtered and the Gantt is honest.

## Red flags — stop and fix the board first

- Writing code with no card In Progress
- "I'll update the board at the end"
- Keeping a local todo list alongside the board (two lists will disagree — the board wins)
- Marking Done without a comment that proves it
- Trusting a card's status without checking the code
- Creating a new board or roadmap for work that has a home already (`list_workspaces`,
  `maydan_roadmaps.list` first)
- Putting tasks on the roadmap, or initiatives on the board

## Safety

- Reads are free. **Archive, never delete**, unless the user says to destroy something —
  `delete_workspace` and roadmap `delete` are permanent.
- **Sharing, inviting and moving things into a Space expose them to other people.** Confirm with
  the user first.
- Never write secrets, tokens or credentials into cards or comments. Boards are shared.

## References

- `references/tool-map.md` — every tool, every action, which id it wants
- `references/recipes.md` — exact call sequences: new feature, bug for later, blocked subtask,
  shipping, setting up a roadmap, building a board from a plan
- `assets/claude-md-block.md` — drop into a project's `CLAUDE.md` so every session uses the same
  board and roadmap

# Recipes

Call sequences for the common moves. `B` = board id, `R` = roadmap id. State ids always come from
`get_board(B).states` — look them up by `label` (or `category` when labels are customised).

## 0. Session start (always)

```
maydan_board.get_board(workspace_id=B)
  → keep: states {label → id}, tags {name → id}
  → list items in In Progress / In Review / Blocked: that is where you left off
```

For each of those, check the code and git before acting. If the work is actually finished, comment
the evidence and move it. If a card is stale, fix it now. Then tell the user in two lines what is
open.

No board yet? `maydan_workspaces.list_workspaces` first — reuse one before creating one.

## 1. New feature, part of the roadmap

```
# Roadmap: find or create the initiative
maydan_roadmaps.get(roadmap_id=R)                      # tracks, initiatives
maydan_roadmaps.create_item(roadmap_id=R, track_id=T, title="CSV export for reports",
    horizon="now", status="in_progress", target_date=<only if the user gave one>,
    description="Outcome and why it matters")

# Board: parent task + subtasks, BEFORE writing code
maydan_items.create_item(workspace_id=B, title="CSV export for reports", type="task",
    description="Mechanism, acceptance criteria, where in the code", priority="high",
    start_date=…, due_date=…)                           # dates only if known → P
maydan_items.create_item(workspace_id=B, parent_id=P, type="subtask", title="Export endpoint streams rows")
maydan_items.create_item(workspace_id=B, parent_id=P, type="subtask", title="Export button + download")
maydan_items.create_item(workspace_id=B, parent_id=P, type="subtask", title="Tests for large reports")
maydan_tags.set_item_tags(item_id=P, tag_ids=[<feature>, <reporting>])   # maydan_tags.create if missing

# Connect the two: link the PARENT, so its subtasks drive the initiative's progress
maydan_roadmaps.add_link(item_id=<initiative>, target_type="work_item", target_id=P)

# Start
maydan_items.transition_item(item_id=P, to_state_id=<In Progress>)
maydan_items.transition_item(item_id=<first subtask>, to_state_id=<In Progress>)
```

Do **not** use `start_board` here — it builds a brand-new board.

## 2. Bug or idea mentioned in passing

```
# 1. Verify against the code: what is actually wrong, where
# 2. Card now, even though you are doing something else
maydan_items.create_item(workspace_id=B, title="Date picker does not open on Safari",
    description="Symptom reported: … Cause found: … (file/area). Not yet fixed.",
    type="task", priority="medium")                     # lands in To Do
maydan_tags.set_item_tags(item_id=<new>, tag_ids=[<bug>])   # there is no "bug" type — tag it
maydan_items.transition_item(item_id=<new>, to_state_id=<Backlog>)   # it is for later
```

Say one line to the user ("Logged in Backlog: …") and carry on.

## 3. A subtask finishes

```
maydan_comments.create_comment(item_id=S,
    body="Done: commit abc1234. `npm test -- export` 14 passed. Handles 50k rows in 1.8s.")
maydan_items.transition_item(item_id=S, to_state_id=<Done>)
maydan_items.transition_item(item_id=<next subtask>, to_state_id=<In Progress>)
```

Evidence first, then the move. If someone else must verify it, use In Review instead of Done.

## 4. A subtask is blocked

```
maydan_items.transition_item(item_id=S, to_state_id=<Blocked>)
maydan_comments.create_comment(item_id=S,
    body="Blocked: need a decision on delimiter for Arabic locales (comma vs semicolon). "
         "Options: … Recommendation: … Decider: the product owner.")
```

Then ask the user the question. When it is answered, record the decision in a comment, update the
description if the plan changed, and transition back to In Progress.

## 5. Shipping

```
# every subtask Done (with evidence) → parent
maydan_comments.create_comment(item_id=P, body="Shipped in PR #42, deployed …, verified by …")
maydan_items.transition_item(item_id=P, to_state_id=<Done>)

# roadmap — progress already shows 100% through the link
maydan_roadmaps.update_item(item_id=<initiative>, status="shipped")   # also moves horizon → done
```

Or set `maydan_roadmaps.update(roadmap_id=R, auto_ship_on_complete=true)` once, and initiatives
ship themselves when their linked work reaches 100%.

"Done" means the user can see it. Merged but not deployed is In Review, not Done.

## 6. Setting up a roadmap from scratch

```
maydan_roadmaps.create(title="Product roadmap 2026")                        # → R
maydan_roadmaps.create_track(roadmap_id=R, title="Reporting")               # one per area/team
maydan_roadmaps.create_item(roadmap_id=R, track_id=…, title=…, horizon="next", status="planned")
```

Keep initiatives outcome-sized ("Customers can export any report"), not task-sized ("add a button").
Put `now` on what is actively being built, `next` on what is committed, `later` on the rest,
`idea` status on anything not yet decided.

## 7. A board for a new body of work

- Several roadmap initiatives becoming one new board:
  `maydan_roadmaps.start_board(roadmap_id=R, item_ids=[…], title="Reporting v2")` — each becomes a
  linked item.
- From a description: `maydan_workspaces.ai_board(prompt="…")` → review the draft blueprint with the
  user → `create_from_blueprint(blueprint)`.
- From a plan document already in Musaad: `get_plan_authorization(plan_id)` first, then
  `authorize_plan(plan_id)` — project, board and baseline in one act.
- A blank board: `maydan_workspaces.create_workspace(title=…)`.

## 8. Reporting status

```
maydan_roadmaps.get(roadmap_id=R)   # initiatives with progress {done, total, pct}
maydan_board.get_board(workspace_id=B)
maydan_schedule.get_schedule(workspace_id=B)   # critical path + slip against baseline
maydan_risks.list_risks(workspace_id=B)
```

Report from these, not from memory. Say what moved, what is blocked and on whom, and what slipped.

## 9. Handing off

Before the session ends, for every card you touched: state is right, description is current, the
last comment says what is next. The next session starts at recipe 0 and should need nothing else.

# Musaad MCP — tool map

Every tool except the plan tools takes an `action` string plus that action's arguments. This map
says which tool owns what, and which **id** each call wants — the most common source of 404s.

## Ids — there are three kinds

| Id | What it is | Where you get it | Who wants it |
|---|---|---|---|
| `workspace_id` | a **board** | `maydan_workspaces.list_workspaces` | every board tool |
| `roadmap_id`, `track_id`, roadmap `item_id` | a roadmap, a lane, an initiative | `maydan_roadmaps.list` / `get` | `maydan_roadmaps` |
| `resource_id` | the **sharing registry id** of any board, roadmap, plan, project or meeting | `get_board().workspace.resource_id`, `maydan_roadmaps.get().roadmap.resource_id`, `projects.get`, `meetings.get`, `spaces.get().contents[]` | `sharing`, `spaces.move_resource` |

Passing a board or roadmap id to `sharing` returns 404 on purpose. Always full UUIDs.

## The hierarchy

```
Space            who can see things (a container; everyone in it reaches everything in it)
 ├─ Project      a chartered endeavour (charter, dates, status) — holds 0..n boards
 │   └─ Board    the work: items in workflow states
 │       └─ Item → subtasks (parent_id)
 ├─ Roadmap      initiatives in tracks, on horizons — links DOWN to boards for progress
 ├─ Plan         a document run through the AI pipeline (charter, WBS, risks, tasks)
 └─ Meeting      minutes: decisions and action items
```

A board does not need a project. Ongoing operations are boards without one.

## Boards

| Tool | Actions | Use it for |
|---|---|---|
| `maydan_workspaces` | `list_workspaces`, `get_workspace`, `create_workspace(title)`, `list_templates`, `get_template`, `draft_from_template`, `ai_board(prompt)`, `create_from_blueprint(blueprint)`, `archive_workspace`, `unarchive_workspace`, `delete_workspace` (permanent) | Finding or creating a board |
| `maydan_board` | `get_board(workspace_id)`, `list_activity(workspace_id, page, page_size)` | **Reading**: states, items, tags, custom fields in one call |
| `maydan_items` | `create_item`, `update_item`, `delete_item`, `reorder_item(item_id, rank, parent_id)`, `transition_item(item_id, to_state_id)`, `set_assignees(item_id, member_ids)` | Writing work items |
| `maydan_comments` | `list_comments(item_id)`, `create_comment(item_id, body, mentions)` | Decisions, blockers, evidence |
| `maydan_tags` | `list`, `create(workspace_id, name, color)`, `update`, `delete`, `set_item_tags(item_id, tag_ids)` — replaces the set | Filterable labels |
| `maydan_links` | `list_links`, `create_link(item_id, target_id, relation)`, `delete_link`, `create_dependency(item_id, predecessor_id, type=FS/SS/FF/SF)`, `delete_dependency` | Related items; scheduling dependencies |
| `maydan_schedule` | `get_schedule`, `preview_reschedule`, `apply_reschedule(changes)`, `get_baseline`, `set_baseline`, `clear_baseline`, `get_workload` | Critical path, variance, capacity |
| `maydan_risks` | `list_risks`, `create_risk(likelihood, impact, status, mitigation)`, `update_risk`, `delete_risk` | Risk register |
| `maydan_workflow` | `list_transitions`, `set_transition_guard`, `list_approvals`, `approve_approval`, `reject_approval` | Guards and approval gates |
| `maydan_fields` | `list_task_types`, `list_custom_fields`, `create_custom_field`, `update_custom_field`, `delete_custom_field` | Typed custom fields |
| `maydan_members` | `list_members`, `create_member`, `update_member`, `delete_member`, `list_team_members` | **Capacity rows**, not user accounts (access is `sharing`) |
| `maydan_automations` | `list_automations`, `create_automation(trigger, conditions, actions)`, `update_automation`, `delete_automation` | Trigger → condition → action rules |
| `maydan_notifications` | `list_notifications`, `mark_notification_read`, `mark_all_notifications_read`, `get_notification_prefs`, `upsert_notification_prefs` | Your inbox |

### `create_item` / `update_item` fields

`workspace_id` (create only), `title`, `description`, `type` (epic / task / subtask / milestone /
deliverable — no `bug`: use a tag), `priority` (low / medium / high /
urgent), `estimate_hours`, `start_date`, `due_date` (YYYY-MM-DD), `parent_id` (makes it a subtask),
`phase_id`, `task_type_id`, `custom_fields`. No state field — use `transition_item`.

### Default workflow

| State | Category | Notes |
|---|---|---|
| Backlog | todo | Later, undecided, needs discussion |
| To Do | todo | **Initial** — every new item lands here |
| In Progress | active | Being worked on now |
| In Review | active | Done by you, awaiting verification or review |
| Blocked | active | Waiting on someone or something — comment why |
| Done | done | Terminal; can only reopen to To Do |

Boards can customise states and add guards. Always read the real ones from `get_board().states`.

## Roadmaps — `maydan_roadmaps`

| Group | Actions |
|---|---|
| Roadmap | `list`, `create(title, description)`, `get(roadmap_id)`, `update(roadmap_id, title, description, icon, color, auto_ship_on_complete)`, `archive`, `unarchive`, `delete` (permanent), `start_board(roadmap_id, item_ids, title)` — **creates a new board** |
| Tracks (lanes) | `create_track(roadmap_id, title, description, color)`, `update_track(track_id, …, order)`, `delete_track(track_id)` |
| Initiatives | `create_item(roadmap_id, title, description, track_id, horizon, status, target_date, owner_user_id, tag_ids)`, `update_item(item_id, …same fields, rank)` — no `roadmap_id` needed, `delete_item`, `set_item_tags` |
| Tags | `list_tags(roadmap_id)`, `create_tag(roadmap_id, name, color)` |
| Links → progress | `search_link_targets(roadmap_id, q, workspace_id, limit)`, `add_link(item_id, target_type, target_id)`, `remove_link(item_id, link_id)` |

- `horizon`: `now` · `next` · `later` · `done` — *when*
- `status`: `idea` · `planned` · `in_progress` · `shipped` · `deferred` — *state*
- `shipped` forces horizon `done` and cannot leave it until un-shipped.
- `add_link` `target_type`: `workspace` (every leaf on the board), `phase` (every leaf in the phase),
  `work_item` (its children, or itself if it has none). Progress = done leaves / total leaves.

## Plans, projects, meetings, Spaces, sharing

| Tool | Actions | Notes |
|---|---|---|
| `list_plans`, `get_plan(plan_id)`, `get_artifacts(plan_id)`, `search_document(plan_id, query)` | — | Read a plan and ground answers in its source document |
| `regenerate_section(plan_id, section, instructions)`, `preview_item_edit`, `apply_item_edit` | — | Change a plan's charter, WBS, risks or glossary; preview before apply |
| `get_plan_authorization(plan_id)`, `authorize_plan(plan_id, start_date, end_date)` | — | Charter a plan: project + board + baseline in one act, once per plan |
| `projects` | `list`, `get`, `create`, `update`, `delete`, `attach_board`, `detach_board`, `list_boards`, `set_parent`, `clear_parent` | `kind`: project / program / portfolio. Deleting a project keeps its boards |
| `meetings` | `list`, `get(mom_id)`, `search(q)`, `export`, `link(mom_id, plan_id)`, `unlink` | Decisions and action items from meetings |
| `spaces` | `list`, `get`, `create`, `update`, `archive`, `unarchive`, `delete`, `list_members`, `add_member`, `update_member`, `remove_member`, `list_invites`, `move_resource` | Adding someone to a Space gives them everything in it |
| `sharing` | `list_people`, `share(resource_id, email, role, scoped)`, `update_person`, `remove_person`, `list_invites`, `revoke_invite`, `preview_invite`, `accept_invite` | `share` is also how you invite. Roles: viewer < member < admin < owner |

Anything that changes who can see something — `sharing`, `spaces.add_member`,
`spaces.move_resource`, `projects.attach_board` — needs the user's go-ahead first.

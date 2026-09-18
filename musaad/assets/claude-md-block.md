<!-- Append this to the project's CLAUDE.md, filling in the names and full UUIDs.
     Claude offers to do this on its first run in a project; it never adds it unasked. -->

## Work tracking — Musaad

This project's work is tracked in Musaad through the `musaad` MCP server. Use the `musaad` skill.

- **Board** (tasks, subtasks, bugs): `<board-name>` — workspace id `<workspace-uuid>`
- **Roadmap** (initiatives): `<roadmap-name>` — roadmap id `<roadmap-uuid>`

Rules for this project:

1. Start every session with `get_board` and reconcile what is In Progress, In Review and Blocked
   against the code.
2. Card before code. Move it as the work moves, on the same turn.
3. New work for later → Backlog. Anything reported in passing becomes a card immediately.
4. Done needs a comment with evidence (commit, PR, test run).
5. Board work that belongs to a roadmap initiative is linked to it, so progress rolls up.
6. The board is the only task list — no parallel todo files.

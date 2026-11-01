---
name: temper
description: Engineering discipline for writing or changing code — make it work (test first, smallest correct change, right data shape), make it right (root cause, behavior tests, then complexity, duplication and mutation gates run as shrink-only ratchets that answer to the spine map), then close out cleanly. Sits underneath /spine and /musaad: it never overrides where code belongs or where work is tracked. Use when the user runs /temper, or asks for disciplined, test-driven, quality-gated changes.
---

# /temper — work, then right, then clean

Every change moves through three stages, in order. Do not start a stage before the
previous one holds.

1. **Make it work** — a failing test, then the smallest correct change.
2. **Make it right** — root cause, honest tests, then the quality gates.
3. **Close out** — report, hand off, commit when asked.

## Precedence — read this first

temper governs *how* you change code. It does not decide *where* code goes or *where* work
is recorded. When a temper rule and another rule disagree, the other rule wins:

| Question | Owner | Consequence for temper |
|---|---|---|
| Where does this code belong? | `/spine` and the repo's `CLAUDE.md` | Check the spine map before building anything. "Smallest edit" means smallest *complete* change on the owning spine, never a patch beside it. |
| Where is the work tracked? | `/musaad` (when the repo pins a board) | No parallel log or todo file. Progress and evidence go in card comments. |
| Security controls | `/spine-security` | Apply it as well when the change touches one. |
| Commit, push, deploy | The user | Never push, merge or deploy unasked. Branch and PR rules in `CLAUDE.md` apply. |

If a repo has no spine map and no board, temper stands alone and the first two rows are moot.

---

# Stage 1 — Make it work

## Find before you build
- Before adding a helper, table, client or tool, search for the existing one and extend it.
  If the repo has a spine map, read it first.
- One decision lives in one place. If you are about to write the second copy, stop.

## Smallest complete change
- Smallest edit that solves the problem **on the right path**. In a spine repo, a bug in old
  code is a migration: move the path, fix it there, delete the old one in the same commit
  (spine W3). If that is genuinely larger than the bug, fix in place and write the DEBT entry.
- Subtract before you add: remove complexity that is in the way before adding anything.

## Shape the data first
- Get the data shape right before writing the logic. Make illegal states unrepresentable.
- Parse and validate outside data once, where it enters. Inside that boundary, trust it.
- Keep business rules in pure functions; keep I/O at the edges.
- Never silence the type checker or linter to get green.
- If two writers could race, give each its own state; if they must share, allow one writer
  and enforce it structurally.
- Make operations idempotent: running twice, or resuming after a crash halfway, ends in the
  same state.

## Test first
1. Write the failing test.
2. Watch it fail **for the reason you expect**. A test that fails for the wrong reason proves nothing.
3. Make the smallest change that passes.
4. If an honest test is impractical, say so and skip it. A bad test is worse than none.

Use the repo's real test setup (in agent-os: Postgres via `docker-compose.test.yml`, never the
app's own database).

## When a new requirement arrives
Do not bolt it on. Ask what you would have built had it been there from day one, then
deliver that design in verifiable pieces.

## When two fixes keep failing the same gate
Write the shared premise in one sentence, find who holds the imbalance, and remove that
assumption before attempting a third fix.

## Aim at an end state you can check
A planned, reversible break in the middle is fine. An unplanned one is not.

---

# Stage 2 — Make it right

## Root causes
- Reproduce it. Fix the cause. A guard that only hides the crash is not a fix.
- Work in small units: finish one, verify it, then start the next.

## Tests that mean something
- A test calls the code the way its user does and checks what that user would see.
- If it would still pass with every function returning nothing, delete it.

## The gates
Three tools measure what review cannot. Install and commands: `references/tools.md`.

| Gate | Target | Fix by |
|---|---|---|
| **crapper** — complexity × (1 − coverage) | CRAP < 10 per function | Split the function, test it, or both. A large flat `switch`/`match` table may stay if splitting makes it worse. |
| **dryer** — structural duplication | No pair at similarity ≥ 0.8 | Do not reach for a helper first; see *Duplication is a missing joint* below. |
| **mutator** — mutation testing | No survivors in code you changed | Cover the uncovered, kill the survivors with a sharper assertion, delete dead code. |

A tool that is not installed is reported as *not run*, never as passed.

## Stay fast — temper must not slow the work down
Quality work that people skip is worth nothing, so every gate has a cost budget and runs at
the cheapest tier that still catches the problem.

| Tier | When | Cost | What runs |
|---|---|---|---|
| **0 — nothing** | Docs, copy, config values, renames, generated files | 0 | Skip temper entirely; say so in one line. |
| **1 — default** | Every code change | seconds | The failing test you were going to write anyway, then `crapper --no-coverage --changed` and `dryer --changed`, checked by `quality_ratchet.py --metric complexity`. No test run needed. |
| **2 — on demand** | You touched a function already over the limit, or the user asks | a test run | Coverage-based CRAP (`--metric crap`) on the changed files only. |
| **3 — deep** | Spine core files (registry, resolver, seam), security code, or the user asks | minutes | `mutator` on those files only. Otherwise nightly. |

Rules that keep it this way:
- **Never in pre-commit and never blocking local saves.** Gates run when you finish a unit of
  work, and in CI on changed files.
- **Never set up CI, hooks or scheduled jobs unasked.** Reuse the pipeline the repo already
  has. If there is none, report that and stop; do not build one as a side effect.
- **Changed files only.** A whole-tree run is for establishing the baseline once, not routine.
- **Do not grind.** If a gate fails, fix it once. Do not loop on refactors chasing a score;
  past two attempts, record `DEBT` and move on.
- **Complexity first.** A function with complexity of 10 or more can never score under CRAP 10,
  however well tested (CRAP = CC² × (1 − coverage)³ + CC, so at full coverage it equals CC).
  Splitting it is the only fix, and the complexity check finds it without running any tests.
  In agent-os that is 122 of 1,458 functions (measured 2026-11-01, backend + gateway).

## Gates are ratchets, not thresholds
A repo that already has functions over CRAP 10 fails a flat "everything under 10" rule on
day one, so the rule gets switched off. Use the spine's mechanism instead:

- **Baseline.** Today's over-limit functions are recorded in
  `tests/uniformity/complexity-baseline.json` (and `crap-baseline.json` for the deeper tier). They stay legal; nothing new is.
- **Three assertions**, as for the spine baseline: no new entry, no entry that got worse, and
  no stale entry (a function that was fixed or deleted must be dropped from the file).
- **Shrink-only.** Regenerate only after genuinely removing debt. Regeneration refuses to
  add an entry or raise a score. Adding one needs a reason in the commit.
- **Tool:** `scripts/quality_ratchet.py check` (CI) and `regen` (after a fix), with
  `--metric complexity` (default, no tests needed) or `--metric crap`. It reads crapper's
  `.metrics/crap.edn`. First run on a repo: `regen --init`.
- **CI scope.** If the repo already has CI, crapper and dryer run with `--changed` on each PR.
  Mutation is slow, so it is never a PR gate.
- **Rejected rule, so nobody re-proposes it:** a repo-wide mutation score floor. It rewards
  testing trivial code and punishes the first honest test of legacy code.
- **What the ratchet cannot see:** a function split only to dodge the score, or a test that
  executes code without asserting anything. The mutation run is what catches the second.

If a gate truly cannot be met, write the debt where the spine keeps it, never lower the limit:

```
DEBT  <gate>  <path>
  Not met because: <specific, measured reason>
  Meeting it requires: <what it would take>
  Escalate when: <trigger>
```

## Spine-aware gates
When the repo has a spine map, the gates answer to it:

1. **Mutate the spine first.** Run mutator on registries, resolvers and seams before anything
   else. A surviving mutant in an authorization resolver is a hole in the architecture; the
   same survivor in a formatting helper is noise.
2. **Duplication is a missing joint.** A dryer pair at 0.8 or above is a question, not a
   to-do: which joint owns this, and is it already in the spine map? If yes, one copy is a
   bypass and moves onto the spine (spine W3). If no and it is the second instance, build the
   joint with a domain name. A shared `utils` is the wrong answer in both cases.
3. **CRAP ranks the migration queue.** The worst scores in un-migrated code say which path
   spine W3/W4 should move next. Report them as inventory, not as a to-do list of their own.
4. **Enforcement tests count as tests.** A matrix row or uniformity test is behavior-checked
   by mutating the registry entry it guards: if the mutant survives, the test is decorative.
5. **Keep gates out of the spine's way.** Never satisfy a gate by adding a parallel path,
   an inline owner check, or a second helper. If the only way to pass is to break a spine
   rule, the spine rule wins; record DEBT and stop.

## Refactoring
Pin the current behavior with tests, change the structure, prove the behavior did not change.

---

# Stage 3 — Close out

## Report
End with a short account of what you did and why, drawn from the work itself:
- Musaad repo: the same facts go in the card comment with the evidence (commit, test run,
  gate output). The card is the log; do not keep a second one.
- No board: put it in the reply.
- Engineering lessons go in the repo's lessons file (agent-os: `tasks/lessons.md`); delivery
  lessons go to Musaad `maydan_lessons`.

State what is verified and what is not: *written, tested, committed, deployed, visible* are
different states, so name the one you reached.

## Keep the main thread small
Send bulk reading, searching and mechanical work to subagents and keep only the summary.

## Commits
Small, ordered commits when the user has asked you to commit. Each message says why, what
changed, and how it was proved. Pushing, merging and deploying wait for the user.

## Cleanup
Find what is safe to remove and confirm nothing in use depends on it before reclaiming disk.
Uncommitted work is never removed without the user's decision.

---

## Files

| Path | Use |
|---|---|
| `references/tools.md` | Install and run crapper, dryer and mutator; credit and cautions. |
| `scripts/quality_ratchet.py` | Shrink-only CRAP baseline: `check` in CI, `regen` after a fix. |
| `scripts/test_quality_ratchet.py` | Tests for the ratchet; run from `scripts/` with `python -m unittest`. |

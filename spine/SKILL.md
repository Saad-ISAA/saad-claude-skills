---
name: spine
description: Keep one implementation per concern in a codebase an AI agent writes most of, using the spine pattern — registry, resolver, seam, enforcement test. Detects spines that already exist under any name and extends them instead of building parallel ones. Covers authorization, multi-tenancy, middleware, tools/MCP/integrations, configuration/env/credentials, event buses, notifications, jobs, databases, LLM routing, vector stores, DLP, observability and agent-to-agent delegation. Use when scaffolding a project, adding a module/endpoint/integration/tool, deciding where code belongs, reviewing architecture, fixing drift (duplicate sharing models, role vocabularies, HTTP clients, env reads), planning a migration, or choosing a folder structure. For security controls use spine-security.
---

# /spine — one implementation per concern

An agent optimises **locally** and has no friction. Ask it four times to add
sharing to a module and you get four correct, well-tested sharing models. No commit
was wrong; the architecture is gone.

So guardrails cannot live in memory or review taste. They must be **structural**
(there is one place the thing can be done) and **executable** (a test fails when a
second place appears).

A **spine** has four parts, every time:

| Part | What it is |
|---|---|
| **Registry** | The one enumeration of things of this kind — resource types, event types, tool ids, error codes, model routes, config variables. |
| **Resolver** | The one function that decides or dispatches. |
| **Seam** | One or two narrow entry points every caller uses. |
| **Enforcement test** | A test **generated from the registry** that fails when an entry lacks wiring or a second implementation appears. |

> **If adding a new module/type/tool requires editing the resolver, the spine has
> been bypassed and the design has failed.**

**"Spine" is a pattern, not a place.** Each spine is a package named after what it
governs — `access/`, `gateway/`, `dispatch/`, `vault/` — never a generic `spine/`,
`core/` or `common/`, which attract everything and become god-packages. Spines are
found through the **spine map**, not a shared directory.

Companion: **`/spine-security`** audits and centralises security controls on top of
these joints.

Full detail: `references/spine-guide.md`. Joint table: `references/joints.md`. Test
recipes: `references/enforcement-recipes.md`.

---

## Step 0 — situate before acting

Answer these from the **repository**, not from the user, and say which workflow you
are using.

**0a. Is there a gate?** Does CI run the test suite before every deploy? If not,
every enforcement test you add is advisory. Report it as *Spine 0* — the first
joint — before recommending anything else.

**0b. Do spines already exist — under any name?** Detect by **shape**, never by
name (guide §13.4). Run `scripts/spine-inventory.sh` (section 0 lists candidates),
then confirm by reading:

- tests that assert declarations or structure, not only behaviour;
- a package whose docstring/README claims one concern and "the only place";
- a registry (enum of types, dict of builders, declared protocols);
- a resolver with high fan-in;
- a narrow interface that adapters implement;
- `CLAUDE.md` / `AGENTS.md` / ADR mentions of spines, layers, seams, or a spine map.

A spine may be called anything (`fabric`, `gateway`, `kernel`, `access`). A folder
called `core/` may be a junk drawer. **If one exists: adopt its name and vocabulary,
extend it within its stated boundary, and never create a parallel layer or fold an
unrelated joint into it.**

**0c. Read the current posture.** A spine map (`docs/spines.md`), a spine status in
`CLAUDE.md` (mode, known-absent joints, healthy joints), a baseline file in
`tests/uniformity/`, a `DEBT` register. Trust the code over these documents — verify
before relying on any claim.

**0d. Route:**

| Situation | Workflow |
|---|---|
| New project, nothing on disk | **W1 — Bootstrap** |
| Existing project, no enforcement yet, user wants architecture work | **W2 — Introduce (ratchet)** |
| Enforcement exists, user reports a bug in old code | **W3 — Opportunistic** ← the default afterwards |
| User wants specific areas migrated | **W4 — Phased by joint** |
| User explicitly wants everything migrated now | **W5 — Full** |
| Adding a module, endpoint, integration, tool, env var or send path | **W6 — Single change** |
| "Review this architecture" / "why is this messy" | **W7 — Audit** |

**Never start W4 or W5 without the user choosing it.** Both are multi-day and touch
code the user did not ask you to touch.

---

## W1 — Bootstrap a new project

1. Create domain-named spine packages **only for joints the product needs on day
   one** — usually identity, tenancy, access, edge, errors and configuration. The
   rest wait for their **second** instance.
2. Add `modules/` (thin, no cross-imports), `adapters/` (the only vendor names),
   `transports/`, `tests/uniformity/`.
3. Declare the **layer map** and add its test immediately. One-way; function-local
   imports count; the composition root is the single exemption.
4. Write `docs/spines.md` from `assets/spine-map-template.md`, and a README in each
   spine from `assets/spine-readme-template.md` — four parts plus **owns / does not
   own**.
5. Add the spine-map test (every listed package, symbol and test exists) and the
   matrix-test skeleton from `references/enforcement-recipes.md`.
6. Paste `assets/claude-md-block.md` into `CLAUDE.md` / `AGENTS.md`.
7. Confirm CI runs all of it before deploy.

---

## W2 — Introduce spines into an existing project

**Do not reorganise folders first.** A large move changes no behaviour, destroys
`git blame`, collides with in-flight work, and buys nothing a test would not buy
sooner.

1. **Spine 0.** If CI does not gate deploys on tests, say so and propose fixing that
   first.
2. **Inventory, and write the numbers down.** Run `scripts/spine-inventory.sh`, then
   verify the top counts by opening files — grep counts are wrong in predictable
   ways (vendored directories, one syntax matched and another missed). *"Four
   sharing models, three role vocabularies, nine timeout values"* is the argument
   that makes the rest easy.
3. **Adopt existing spines** found in Step 0b and record them in a spine map.
4. **Declare the layer map from what exists** — rank the directories the repository
   actually has.
5. **Add the ratchet** with today's violations as a baseline, and all three
   assertions: no new entries, count never grows, **no stale entries**. The baseline
   is a ceiling, not a target. Adding an entry requires the reason in the commit.
6. **In the test's docstring, record the rules you rejected** (a rule your best
   module would fail is a bad rule) **and what the test cannot see** (semantic
   duplication).
7. **Write the spine status into `CLAUDE.md`**: current mode (W3), **known-absent
   joints** ("do not assume these exist"), **healthy joints** ("protect them, copy
   them"), and how to regenerate the baseline.
8. Tell the user the repository is now in **W3** by default, and that any joint can
   be escalated to W4.

---

## W3 — Opportunistic: bugs and features pay for the migration (default)

When a bug arrives in old, un-migrated code:

> **Do not fix it where it lives. Move that path onto the spine, and fix it there.**

1. Reproduce with a **failing test written against the old behaviour**.
2. Move the **smallest complete path** onto the owning spine: one endpoint, one send
   path, one integration call. *Complete* means the old path is gone, not bypassed.
3. Fix the bug in the new location.
4. One commit does four things: convert the caller, **delete the old path**, add the
   matrix row, remove the fixed entries from the baseline.

**Escape hatch — mandatory.** If the move is genuinely larger than the bug (two
joints, a data migration, a dozen files), fix in place and write a debt entry in the
same commit:

```
DEBT  <joint>  <path>
  Fixed in place because: <specific, measured reason>
  Migrating this path requires: <what it would take>
  Escalate to a scheduled phase when: <trigger>
```

Three debt entries against one joint is the signal to propose W4 for that joint.
**Report which happened** — moved, or fixed in place with debt — in one line. Never
silently patch old code.

**Features pay too.** Do not propose the spine as its own programme — joints users
never see stall as standalone projects. When planning a feature, name the piece of a
joint it needs and build that piece as part of the feature (the first email feature
builds the dispatcher and its egress adapter); move the other call sites when they
are next touched. Once the ratchet is on, features can no longer make ratcheted
areas worse, so each one is neutral or pays down a joint.

---

## W4 — Phased by joint (user chooses)

Use `AskUserQuestion` to let the owner pick joints and order. Give them the verified
inventory numbers, the debt register, and the dependency order from
`references/joints.md`, and **recommend** an order — ranked by irreversibility
first (what loses something permanently every day it waits), then by dependency.

- **Spine 0 first, then identity and tenancy.** Every other joint references a
  subject and a tenant.
- **Migrate joints before splitting into services.**

For each chosen joint run the loop (guide §11.2): build beside → backfill in one
migration → convert one caller at a time → collapse the vocabulary → **delete and
defend**. A joint is migrated when the old path is deleted and asserted absent — not
when the new path works. Track each joint as its own item in whatever tracker the
repository uses.

---

## W5 — Full migration

Only on explicit request. The W4 loop across every joint in dependency order, plus a
**freeze on new parallel paths** (enforced by the ratchet) and a **stated end
condition**: baseline at zero, every module in the matrix test, every deleted name
asserted absent. "Mostly migrated" is not a state; it is W3 with a bad conscience.

---

## W6 — A single change (the common case)

Before writing code, ask: **which joint owns this?** Check the spine map first — the
owner may already exist under a domain name.

- Sharing, visibility, "who can see this" → authorization (guide §3)
- A new module or entity → register a type + one FK. **Never edit the access layer.**
- An endpoint, middleware, auth method → request edge (§4.1)
- A third-party API, MCP server, internal service call → tool catalogue / gateway (§4.2)
- **A new env var, secret or credential** → configuration joint (§4.12): declare it
  in the schema, add it to `.env.example`, redact it by marker, never a public
  prefix; a tenant's credential goes in the database, not the environment
- Anything that sends → notification dispatcher (§4.5); audience from the resolver
- Anything async → events via the outbox (§4.4), or jobs with a capability envelope (§4.6)
- A model call, prompt or embedding → model layer (§4.14); name a capability, not a model
- A search over documents → retrieval (§4.15); filter **before** the search
- Any egress → DLP (§4.16)

If the joint exists, extend it within its boundary. If this is the **second**
instance, build it with a domain name and add it to the spine map. If it is the
first, write the one-off and note where the joint will go. If the change touches a
security control, also apply `/spine-security` S2. If uniformity is genuinely
impossible, **stop and ask**; do not add a parallel path.

---

## W7 — Audit an existing architecture

1. Step 0 in full, including existing-spine detection and the gate.
2. Run `scripts/spine-inventory.sh`; **re-measure every count you intend to report**
   by opening the files. Label anything unverified as a hypothesis.
3. Report in this shape (write it to `docs/` if the user wants it kept):
   - **Scoreboard** — `Concern | Should be | Actually is | Verdict`, with numbers.
   - **Findings that matter** — each with evidence (`file:line`) and the joint that
     fixes it.
   - **Existing spines** — name, joints covered, boundary, health.
   - **Structural strengths to protect** — what is already right, so nobody
     "fixes" it.
   - **Known-absent joints** — stated so no agent assumes they exist.
   - **Recommended joint order (W4)** — ranked by irreversibility; not started.
4. Offer W2 or W4. Do not start either.

---

## Non-negotiables

1. **New code is spine-only.** Always.
2. **Find before you build.** Check the spine map and detect existing spines by
   shape; never create a parallel layer.
3. **Name spines for what they govern.** No `spine/`, `core/`, `common/` packages;
   no folding unrelated joints into an existing spine.
4. **Adding a module = register a type + one FK.** Editing a resolver to add a module
   means the design was bypassed — stop and ask.
5. **Two access entry points only**, read separated from write; no inline ownership
   checks in handlers.
6. **One enum per vocabulary.** No role/status/kind/error/event/tool/model literals.
7. **One configuration loader.** No env reads elsewhere; secrets redacted by marker.
8. **Deny 404, never 403.** Cross trust boundaries with a sealed capability.
9. **Every surface is a transport**; **vendors live in adapters only.**
10. **Permission never increases along a delegation chain.**
11. **Delete the old path in the same commit.**
12. **The baseline is a ceiling**: no new, never grows, no stale; additions carry a
    reason.
13. **Every concept ships with its enforcement test**, and CI runs it before deploy.
14. **Measure, never assert.** Re-measure before reporting any count.

---

## Files

| Path | Use |
|---|---|
| `references/spine-guide.md` | The full guide — every joint, rules, migration modes, layout, detecting existing spines. |
| `references/joints.md` | Joint table: owns, depends on, effort, payoff, trigger, minimum enforcement test. Use for W4. |
| `references/enforcement-recipes.md` | Test skeletons: matrix, route coverage, layer map + three-assertion ratchet, spine-map integrity, exhaustiveness, DLP canary, exemptions. |
| `assets/claude-md-block.md` | Drop-in rules for the target repo's `CLAUDE.md` / `AGENTS.md`. |
| `assets/spine-map-template.md` | `docs/spines.md` — the registry of spines. |
| `assets/spine-readme-template.md` | README for one domain-named spine: four parts, boundary, roadmap. |
| `scripts/spine-inventory.sh` | Drift inventory, including existing-spine candidates and configuration/env drift. Dependency-free. |

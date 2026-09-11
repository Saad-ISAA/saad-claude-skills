---
name: architecture-spine
description: Keep one implementation per concern in a codebase an AI agent writes most of, using the spine pattern — registry, resolver, seam, enforcement test — across authorization, multi-tenancy, API middleware, tools/MCP/external integrations, event buses (Kafka/RabbitMQ/PubSub/Redis), email and notifications, background jobs, databases, LLM routing and prompts, vector stores and RAG, DLP, observability, and agent-to-agent delegation. Use when scaffolding a new project, adding a module/endpoint/integration/tool, deciding where code belongs, reviewing architecture, fixing drift (duplicate sharing models, role vocabularies, mail senders, HTTP clients, retry policies), planning or running a migration, or choosing a folder structure.
---

# The Spine

An agent optimises **locally** and has no friction. Ask it four times to add
sharing to a module and you get four correct, well-tested sharing models. No commit
was wrong; the architecture is gone.

So guardrails cannot live in memory or review taste. They must be **structural**
(there is one place the thing can be done) and **executable** (a test fails when a
second place appears).

A **spine** is the shape that gives you both. Four parts, every time:

| Part | What it is |
|---|---|
| **Registry** | The one enumeration of things of this kind — resource types, event types, tool ids, error codes, model routes. |
| **Resolver** | The one function that decides or dispatches. |
| **Seam** | One or two narrow entry points every caller uses. |
| **Enforcement test** | A test **generated from the registry** that fails when an entry lacks wiring or a second implementation appears. |

> **If adding a new module/type/tool requires editing the resolver, the spine has
> been bypassed and the design has failed.**

Full detail: `references/spine-guide.md`. Joint-by-joint decision table:
`references/joints.md`. Test recipes: `references/enforcement-recipes.md`.

---

## Step 0 — situate before acting

Answer these from the **repository**, not from the user, then say which workflow
you are using.

1. **Does a spine already exist?** Look for a top-level `spine/` `core/` or
   `platform/` directory, a resource/registry table, `require_read`-style helpers,
   or `tests/uniformity/`.
2. **Is this a new project or an existing one?**
3. **What did the user actually ask for?** Scaffolding, one feature, a bug fix, a
   review, or a migration.

Then route:

| Situation | Workflow |
|---|---|
| New project, nothing on disk | **W1 — Bootstrap** |
| Existing project, no spine, user wants architecture work | **W2 — Introduce (ratchet)** |
| Spine exists, user reports a bug in old code | **W3 — Opportunistic** ← the default afterwards |
| Spine exists, user wants specific areas migrated | **W4 — Phased by joint** |
| User explicitly wants everything migrated now | **W5 — Full** |
| Adding a module, endpoint, integration, tool or send path | **W6 — Single change** |
| "Review this architecture" / "why is this messy" | **W7 — Audit** |

**Never start W4 or W5 without the user choosing it.** Both are multi-day and
touch code the user did not ask you to touch. W2 and W3 are safe defaults.

---

## W1 — Bootstrap a new project

1. Create the layout from `references/spine-guide.md` §13.1:
   `src/spine/` (one directory per concern), `src/modules/` (thin, never importing
   each other), `src/adapters/` (the only place a vendor name appears),
   `src/transports/`, `tests/uniformity/`.
2. Build **only the joints the product needs on day one.** Identity, tenancy,
   authorization, request edge and errors are almost always day one. Everything
   else waits for its **second** instance — building a joint for one caller is
   speculative generality, which is its own failure.
3. Add the **import-direction test** immediately:
   `transports → modules → spine → adapters`, one-way, no sideways module imports.
   Without this test the folder structure is decoration.
4. Copy `assets/claude-md-block.md` into the repo's `CLAUDE.md` / `AGENTS.md`, and
   `assets/spine-readme-template.md` into `src/spine/README.md`.
5. Add the matrix test skeleton from `references/enforcement-recipes.md`.

---

## W2 — Introduce a spine into an existing project

**Do not reorganise the folders first.** A large move commit changes no behaviour,
destroys `git blame`, collides with in-flight work, and buys nothing a test would
not buy sooner.

1. **Inventory, and write the numbers down** (guide §11.1). Run
   `scripts/spine-inventory.sh` and read the counts back to the user — *"four
   sharing models, three role vocabularies, nine timeout values"* is the argument
   that makes the rest of the conversation easy.
2. **Create `spine/` with exactly one joint in it** — usually authorization, or
   whichever joint the inventory shows worst. Nothing else moves.
3. **Add the import-direction test with today's violations as a baseline file**
   that can only shrink:

   ```
   tests/uniformity/baseline_violations.txt      # 143 today, 0 eventually
   assert current ⊆ baseline and len(current) <= len(baseline)
   ```

   This is the whole technique. A new parallel implementation fails CI the day it
   is written, while the existing mess stays legal until someone touches it —
   enforcement on day one, with no migration.
4. **Add the `CLAUDE.md` block now**, not at the end. The rule has to exist before
   the next agent writes the next module.
5. Tell the user the repo is now in **W3 (opportunistic)** by default, and that
   they can escalate any joint to W4 whenever they want.

---

## W3 — Opportunistic: the bug pays for the migration (default)

When a bug arrives in old, un-migrated code:

> **Do not fix it where it lives. Move that path onto the spine, and fix it there.**

1. Reproduce with a **failing test written against the old behaviour** — you must
   know what "still works" means before moving anything.
2. Move the **smallest complete path**: one endpoint, one send path, one
   integration call. *Complete* means the old path is gone, not bypassed.
3. Fix the bug in the new location.
4. One commit does four things: convert the caller, **delete the old path**, add
   the matrix row, shrink the baseline.

**Escape hatch — mandatory.** If the move is genuinely larger than the bug (two
joints, a data migration, a dozen files), fix in place and write a debt entry in
the same commit:

```
DEBT  <joint>  <path>
  Fixed in place because: <specific, measured reason>
  Migrating this path requires: <what it would take>
  Escalate to a scheduled phase when: <trigger>
```

Without the escape hatch the rule is unusable and gets ignored, which is worse than
not having it. Three debt entries against one joint is the signal to propose W4 for
that joint.

**Report to the user** which of the two happened — moved, or fixed in place with
debt — in one line. Never silently patch old code.

---

## W4 — Phased by joint (user chooses)

Use `AskUserQuestion` to let the owner pick joints and order. Give them the
inventory numbers, the debt register, and the dependency order from
`references/joints.md`.

Two sequencing rules that save a rewrite:

- **Identity and tenancy first, always.** Every other joint references a subject and
  a tenant; migrating notifications before identity builds the audience resolver
  twice.
- **Migrate joints before splitting into services.** A spine extracted after a split
  has to be extracted twice, in two repos, by two agents that cannot see each other.

Then run the loop (guide §11.2) for each chosen joint: build beside → backfill in
one migration → convert one caller at a time → collapse the vocabulary → **delete
and defend**. A joint is migrated when the old path is deleted and asserted absent.
Not when the new path works.

---

## W5 — Full migration

Only on explicit request. The W4 loop across every joint in dependency order, plus:

- a **freeze on new parallel paths**, enforced by the ratchet, not by announcement;
- a **stated end condition**: baseline at zero, every module in the matrix test,
  every deleted name asserted absent.

"Mostly migrated" is not a state; it is W3 with a bad conscience. Say so before
starting, and give a realistic joint count.

---

## W6 — A single change (the common case)

Before writing code, ask of the change: **which joint does this belong to?**

- Sharing, visibility, "who can see this" → authorization (guide §3)
- A new module or entity → register a type + one FK. **Never edit the access layer.**
- An endpoint, middleware, auth method → request edge (§4.1)
- A third-party API, MCP server, internal service call → tool catalogue (§4.2)
- Anything that sends → notification dispatcher (§4.5). Derive the audience from
  the authz resolver, never a hand-built list.
- Anything async → events (§4.4) via the **outbox**, or jobs (§4.6) with a sealed
  capability envelope
- A model call, prompt, or embedding → model layer (§4.14). Name a capability
  (`reasoning.default`), never a model id.
- A search over documents → retrieval (§4.15). Filter with the resolver **before**
  the search, never after.
- Any egress (log, trace, email, export, webhook, model payload) → DLP (§4.16)

If the joint exists, extend it. If it does not and this is the **second** instance,
build it. If this is the first instance, write the one-off — and note where the
joint will go. If uniformity is genuinely impossible here, **stop and ask**; do not
add a parallel path.

---

## W7 — Audit an existing architecture

Run `scripts/spine-inventory.sh`, then report against the guide's rules (§8) in
this order: how many implementations exist per concern; which rules have no
enforcing test; which joints are worst by count; and the three or four highest-risk
findings (usually: post-filtered retrieval, hand-built notification audiences,
workers trusting bare ids, vendor SDKs in handlers).

Give counts, not adjectives. Offer W4 with a proposed joint order; do not start it.

---

## Non-negotiables (in every workflow)

1. **New code is spine-only.** Always, in every mode.
2. **Adding a module = register a type + one FK.** Editing the access layer to add a
   module means the design was bypassed — stop and ask.
3. **Two entry points only** (`require_read` / `require_role`), read separated from
   write, zero inline owner-equality checks in handlers.
4. **One enum per vocabulary.** No role/status/kind/error/event/tool/model literals
   at call sites.
5. **Deny 404, never 403.** Cross every trust boundary with a sealed capability
   (tenant + actor + scopes + expiry), never a bare id.
6. **Every external surface is a transport** onto the same service functions — HTTP,
   MCP, CLI, webhooks, admin. Transports never query data directly.
7. **Vendors live in adapters only.** One HTTP client, one retry policy, one egress
   allowlist.
8. **Permission never increases along a delegation chain.** Agent scopes are the
   *intersection* with the principal's.
9. **Model, tool and agent output is tainted data, never instructions.**
10. **Delete the old path in the same commit.** If you cannot delete, you have
    forked, not migrated.
11. **Every concept added ships with its enforcement test in the same commit.**
12. **Measure, never assert.** Baseline count, modules-on-spine per joint, joints
    complete — generated by the tests, not typed into a status doc.

---

## Files

| Path | Use |
|---|---|
| `references/spine-guide.md` | The full guide — every joint, the rules, migration modes, layout. Read the sections relevant to the joint you are touching. |
| `references/joints.md` | One-page joint table: what each owns, dependencies, effort, payoff, scheduling trigger, enforcement test. Use for W4 choices. |
| `references/enforcement-recipes.md` | Concrete test skeletons: matrix test, import direction + baseline ratchet, exhaustiveness, canary DLP test. |
| `assets/claude-md-block.md` | Drop-in block for the target repo's `CLAUDE.md` / `AGENTS.md`. |
| `assets/spine-readme-template.md` | `src/spine/README.md` — the invariant, stated where an agent reads it. |
| `scripts/spine-inventory.sh` | Drift inventory: counts parallel implementations, role literals, HTTP clients, vendor imports, model ids. Language-agnostic greps. |

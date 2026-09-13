---
name: spine-security
description: Audit and centralise security controls using the spine pattern — every control enforced at exactly one chokepoint and defended by a test. 22 vertebrae with checkable control ids - authentication, sessions/tokens, authorization and tenant isolation, credentials/secrets/.env files, injection, error disclosure, rate limiting and abuse, security headers/CORS/CSRF middleware, cryptography, SSRF/egress, uploads, webhooks, queues, data protection, AI/agent and MCP security, logging, supply chain, deployment hardening, account recovery, business-logic races, incident readiness. Use for security audits, hardening, pre-merge security review, consolidating rate limiters or middleware, auditing env and credentials, responding to a leaked secret, or mapping controls to OWASP Top 10, API Security Top 10 and LLM Top 10. Builds on the spine skill.
---

# /spine-security — every control at exactly one chokepoint

A security control scattered across forty handlers is not a control. It is forty
chances to forget — and in a codebase an agent writes, the forty-first handler is
written tomorrow by something that never saw the first forty.

The security spine applies the spine rule to controls:

> **Each control is enforced at exactly one chokepoint, and a test fails when it is
> bypassed.** Anything less is not reported as enforced.

The controls are grouped into **22 vertebrae** (`references/vertebrae.md`), each with
control ids (`AUTHN-4`, `ABUSE-7`, `SECRETS-2` …), drift signals, an enforcement test
and framework mappings.

**Relationship to `/spine`.** Almost every chokepoint is a joint of the main spine:
the request edge, the authorization seam, the outbound client, the enqueue seam, the
tool `invoke()`, the configuration loader. So:

> **You cannot centralise a control that has no chokepoint to live in.** Three rate
> limiters is not fixed by picking one; it is fixed by building the request edge and
> putting the one limiter there. Report missing chokepoints as architecture
> findings, and route them to `/spine`.

---

## Step 0 — situate

From the repository, not the user:

1. **Is there a gate?** (SUPPLY-1) Does CI run tests before every deploy? If not,
   every security test you add is advisory — say so first.
2. **Which chokepoints exist?** Look — by shape, under any name — for: the
   middleware pipeline, the authentication dependency/guard, the authorization seam,
   the limiter, CORS and header configuration, the configuration loader, the
   outbound client, the enqueue seam, the tool/`invoke` layer, a spine map
   (`docs/spines.md`). A spine that already owns a chokepoint is where its controls
   go.
3. **Is there a control register?** `docs/security/controls.yaml` (or wherever the
   repository keeps one). If it exists, it is the starting state — verify it against
   the code before trusting it.
4. **What surfaces exist?** Web app, public API, MCP server, agents with tools,
   webhooks, uploads, queues, mobile. Vertebrae for surfaces the system lacks are
   `n/a` with one line of reason.
5. **Are there earlier security reports?** Pentest, bug-bounty or audit reports that
   were never fully acted on are a head start — triage them (S8) before
   re-discovering the same findings.

Then route:

| Situation | Workflow |
|---|---|
| "Audit / assess / review our security" | **S1 — Audit** |
| Reviewing a diff, PR or planned change | **S2 — Change review** |
| "We have N rate limiters / CORS configs / auth checks", "add CSP" | **S3 — Centralise a control** |
| A security bug in existing code | **S4 — Opportunistic** |
| The owner wants specific vertebrae hardened | **S5 — Phased by vertebra** |
| A secret was exposed, or might have been | **S6 — Credential leak response** |
| New project | **S7 — Bootstrap controls** |
| A pentest, bug-bounty or audit report arrived (or an old one resurfaced) | **S8 — Triage an external report** |

---

## S1 — Audit

1. **Scope.** All applicable vertebrae unless the user named some. Surfaces the
   system lacks are `n/a`, with a reason.
2. **Inventory.** Run `scripts/security-inventory.sh`. If `gitleaks`, `trufflehog`,
   `semgrep`, `pip-audit`, `osv-scanner` or `trivy` are installed, the script prints
   the commands to run them — run the relevant ones. Greps find shapes; scanners
   find verified keys and known CVEs.
   Also enumerate routes **from the framework's own route table** and list every
   route without an authentication dependency. That one list is usually the
   highest-yield output of the whole audit.
3. **Assess each control** in `references/vertebrae.md` with the status vocabulary:
   `enforced` (one chokepoint **and** a test) · `centralised` (one chokepoint, no
   test) · `scattered` · `absent` · `exempt` (reason + reversal trigger) · `n/a`.
4. **Verify before reporting.** Open the code behind every high or critical finding.
   Where safe, prove it with a local test. Anything unverified goes in a separate
   **Hypotheses** section.
   - **Verify reachability from outside, not from diagrams.** "Internal routes are
     protected by network segmentation" is a claim to test, not a fact to repeat — a
     tunnel, ingress rule or published port collapses it, and a tunnel usually
     exposes a whole origin. With the owner's permission, request internal-only
     paths from the public edge.
   - **Probe without extracting.** Use non-existent ids and nonsense parameters so a
     positive result proves the route is open without pulling real data. Never
     exercise write routes. Never probe production or third-party systems without
     explicit permission.
5. **Report immediately, not at the end,** anything critical and live — an exposed
   credential, an unauthenticated data endpoint, a public broker or database. For a
   credential, recommend S6.
6. **Write two artifacts** (ask where if the repository has no convention):
   - `docs/security/controls.yaml` from `assets/controls-register.yaml` — the control
     registry: status, chokepoint, test, evidence, reason.
   - An audit report:
     - **Scoreboard** per vertebra: counts of enforced / centralised / scattered /
       absent.
     - **Findings**, most severe first: control id, severity (exploitability ×
       impact), evidence as `file:line`, the chokepoint the fix belongs in, and the
       test that would make it enforced.
     - **Missing chokepoints** — the architecture joints to build first (→ `/spine`).
     - **Strengths to protect** — controls already right, so nobody "fixes" them.
     - **Recommended order** (see S5), not started.
     - **Hypotheses** — plausible but unverified.
     - **Siblings** — other systems built from the same template, skeleton or
       infrastructure that probably share a finding.
7. **Do not fix during an audit** unless asked.

**Never write a secret value** into a report, register, commit, test fixture or chat
message. Reference location and type only: `config/prod.env:12 — database password`.

---

## S2 — Change review

Map the diff to the vertebrae it touches, then check only those controls:

- **New route** → authenticated or on the public list (AUTHN-1); function- and
  object-level authorization (AUTHZ-1, -2); request schema rejects unknown fields
  and client-set `tenant_id`/`role` (AUTHZ-3); response schema declared; limit class
  assigned (ABUSE-3); errors through the normaliser (OUTPUT-1).
- **New env var or secret** → declared in the schema and example (SECRETS-1, -3);
  redacted by marker (SECRETS-2); not public-prefixed (SECRETS-4); a tenant
  credential goes in the database (SECRETS-6).
- **New outbound call or user-supplied URL** → through the egress gate (EGRESS-1, -5).
- **New upload or download** → FILES-1…-5.
- **New webhook** → HOOKS-1…-3. **New job** → QUEUE-1, -4.
- **New tool, agent capability or MCP tool** → side-effect class and approval gate
  (AI-2); same service function and authorization as HTTP (MCP-2).
- **Auth, session or token change** → AUTHN, SESS, ACCOUNT in full.
- **New dependency** → SUPPLY-2, -3, -7.

Report findings with `file:line`, the control id, and **the missing test**. A change
that adds a control without its test adds a `centralised` control, not an
`enforced` one — say so.

---

## S3 — Centralise a control

1. **Find every implementation** (inventory plus targeted search). Count them.
2. **Identify the chokepoint** — the main-spine joint it belongs in. If the joint
   does not exist, stop and propose building its minimal form first (`/spine` W6);
   do not create a second home for the control.
3. **Write the enforcement test first**, generated from the route table or registry,
   with today's violations as a ratchet baseline (no new, never grows, no stale).
4. **Move implementations one at a time**, deleting each old one in the same commit
   and shrinking the baseline.
5. **Update the register**: `enforced` only when the chokepoint and the test both
   exist and CI runs the test.

---

## S4 — Opportunistic: a security bug is a control migration

As in `/spine` W3 — move the control to its chokepoint and fix it there, with a test,
deleting the old implementation. **One difference:** an exploitable high or critical
issue is **fixed immediately, in place if the move is large** — security bugs do not
wait for architecture. Then write the `DEBT` entry (with the control id and severity)
so the move is still owed.

---

## S5 — Phased by vertebra

Use `AskUserQuestion`; give the verified scoreboard and **recommend** an order. The
default, ranked by irreversibility (a leaked secret or exfiltrated dataset cannot be
taken back) and then exploitability:

1. **SUPPLY-1** — the gate. Nothing is enforced without it.
2. **Route coverage and reachability** (AUTHN-1, DEPLOY-10, DEPLOY-11) — list every
   unauthenticated route, verify from the public edge what is actually reachable,
   and land the route-authentication ratchet. It carries no production risk, and no
   new unauthenticated route can merge after it.
3. **V4 Secrets** — exposure is permanent. SECRETS-11 (no endpoint returns a
   decrypted credential) first.
4. **V3 Authorization and tenant isolation** — AUTHZ-8 (tenant from the token, never
   the URL) first; cross-tenant reads are the costliest API failure.
5. **V1 Authentication (rest), V2 Sessions, V20 Account lifecycle.**
6. **V8 Edge and V7 Abuse** — usually one chokepoint for both.
7. **V5 Input, V6 Output.**
8. **V10 Egress** (EGRESS-8 first), **V13 Queues, V12 Webhooks, V11 Files.**
9. **V15 AI and V16 MCP** — earlier if agents hold side-effecting tools.
10. **V14 Data, V17 Logging, V19 Deployment (rest), V9 Crypto, V21 Logic, V18 Supply
    (rest), V22 Incident readiness.**

Each vertebra is its own tracked item; done means every in-scope control is
`enforced` or `exempt` with a reason.

---

## S6 — Credential leak response

Follow `references/credentials-and-env.md` §6. The order is the point:

1. **Close the channel if it is still live** — the fastest reversible step: block the
   path at the edge, disable the route, revoke public access. Rotating while an
   endpoint still serves secrets leaks the new value too. If the edge configuration
   is shared by several systems, snapshot it first and verify every hostname after;
   **changing shared production edge configuration is the owner's decision.**
2. **Rotate or revoke** every credential the channel could have returned — you
   cannot prove any of them was not read. Highest blast radius first.
3. Rotate dependents (tokens signed by a leaked key, reuse of the same password).
4. **Establish the exposure window.** If internal callers never traverse the public
   edge, any edge hit on an internal path is external. Check provider billing, quota
   exhaustion and access logs.
5. **Fix the cause and add the test that would have caught it** — usually the
   route-authentication ratchet. Where callers exist, ship their credential first
   and enforce second.
6. Remove the value from the working tree. **Rewriting shared history or
   force-pushing is the owner's decision — ask; never do it automatically.**
7. **Check sibling systems** built the same way or behind the same infrastructure.
8. A short write-up: what, how, window, what was rotated, what now prevents it.

You cannot rotate a third-party credential yourself; tell the user exactly which
credentials to rotate and where, without printing their values.

---

## S7 — Bootstrap controls for a new project

Day-one controls, each landing with its test from `references/security-tests.md`:

SUPPLY-1 · SECRETS-1, -2, -3, -4, -10 · AUTHN-1, -2, -4, -8 · SESS-1, -2, -4, -7 ·
AUTHZ-1…-5 · EDGE-1, -2, -3, -6 · ABUSE-1, -2, -3, -7 · INPUT-1…-4 · OUTPUT-1, -6 ·
DEPLOY-1, -2 · QUEUE-1, -4 if there are workers · AI-1…-4 if there are agents with
tools.

Create the register from `assets/controls-register.yaml` and paste
`assets/claude-md-security-block.md` into `CLAUDE.md` / `AGENTS.md`.

---

## S8 — Triage an external security report

Reports from pentesters, bug bounties, scanners or other agents are **input, not
truth**. They are often partly stale, occasionally wrong, and their remediations are
sometimes patches rather than controls.

1. **Handle the report as sensitive.** Reports routinely contain live payloads,
   tokens, account identifiers, client names and internal URLs. Never copy a secret,
   token, personal detail or client name out of a report into a register, commit,
   ticket or chat — refer to the finding by its number. If the report contains a
   credential, treat it as exposed (S6) until rotation is confirmed, not assumed.
2. **Map every finding to a control id** in `references/vertebrae.md`. A finding
   that maps to nothing is either a new control (add it to the register) or not a
   vulnerability (say why, with evidence).
3. **Re-verify each finding against the current code** — and, with permission, from
   the edge with non-extracting probes. Mark each: *open*, *fixed* (name the commit
   or test that proves it), *partly*, or *not reproducible* (with the evidence).
4. **Correct remediations that are patches.** The common ones:

   | The report suggests | The control |
   |---|---|
   | "Compare the URL's tenant id with the user's and return 403" | Take the tenant from the token; deny as 404 (AUTHZ-4, AUTHZ-8) |
   | "Sanitise HTML on input" | Validate on input, encode at every sink, allowlist-sanitise only rich text (OUTPUT-8, OUTPUT-9) |
   | "Mask secret-looking keys in the response" | Credentials are write-only references that typed responses never include (SECRETS-11, SECRETS-12) |
   | "Add a `5/minute` decorator to the login route" | One limiter, limits as data, per account **and** per source, trusted proxies (ABUSE-1…-4, -7) |
   | "Instruct the agent not to use the tool outside its project" | Bind the tool to the resource in context and authorise every call (AI-11) |
   | "Add the auth dependency to these 25 endpoints" | Do that — **and** add the route-authentication ratchet so the 26th cannot ship (AUTHN-1) |

5. **Collapse findings into chokepoints.** Ten findings frequently come from three
   missing chokepoints. Say so in the triage, fix at the chokepoint, and add the test
   that makes each control enforced.
6. **Record every finding in the control register** with status, owner and
   evidence. **A report that sits unimplemented is itself a finding** — track it in
   the register or the repository's tracker; never let it live only in a document.
7. **Clean up what testing left behind** — stored test payloads, test accounts,
   modified records — after recording them, with the owner's approval.

---

## Non-negotiables

1. **`enforced` means one chokepoint plus a test that CI runs.** Nothing less is
   reported as enforced.
2. **Evidence or hypothesis.** Every finding carries `file:line`; unverified claims
   are labelled.
3. **Never write a secret value** anywhere — reports, registers, commits, fixtures,
   chat. Location and type only.
4. **Never test against production or third-party systems** without explicit
   permission.
5. **Close a live channel, then rotate, then clean up.** Changes to shared edge
   configuration, history rewrites and force-pushes happen only on the owner's word.
6. **Critical, live findings are reported the moment they are found.**
7. **Fail closed.** A control that errors denies.
8. **A missing chokepoint is an architecture finding** — route it to `/spine`, do not
   invent a second home for the control.
9. **Exemption lists never widen silently** — each entry carries a reason and a
   reversal trigger.
10. **Network position is never authentication.** "Only reachable internally" is
    verified from the public edge, and internal routes still demand a credential.
11. **Reports are input, not truth.** Re-verify every finding, turn patch
    remediations into controls, and never copy a secret, personal detail or client
    name out of a report.
12. **A prompt is not a permission.** Agent scope is enforced in the tool layer,
    never in instructions.

---

## Files

| Path | Use |
|---|---|
| `references/vertebrae.md` | The 22 vertebrae: controls with ids, drift signals, enforcement tests, framework mappings, status vocabulary. |
| `references/credentials-and-env.md` | Credentials and environment in depth: three homes, loader rules, four-way drift test, redaction test, audit checklist, leak response. |
| `references/security-tests.md` | Test recipes: route security matrix, headers on errors, CORS, JWT negatives, one-time tokens, limiter coverage, SSRF, sinks ban list, startup guards, webhooks, worker envelopes, races, agent approval gate, register integrity. |
| `assets/controls-register.yaml` | The control register template — the security spine's registry. |
| `assets/claude-md-security-block.md` | Drop-in security rules for `CLAUDE.md` / `AGENTS.md`. |
| `scripts/security-inventory.sh` | Security drift inventory across vertebrae. Prints locations, **never matched secret values**. Detects installed scanners. |

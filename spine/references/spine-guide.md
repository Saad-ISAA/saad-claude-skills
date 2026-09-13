# The Spine

**An architecture discipline for codebases an AI agent writes most of.**

> One implementation per concern, enforced by a test rather than by memory.
>
> Nothing here is tied to a language, framework, cloud or product. Copy this file
> into any repository, work the migration playbook in §11, and paste §14 into that
> repo's `CLAUDE.md` / `AGENTS.md` / `.cursorrules`.

---

## 0. The shortest version

An AI agent optimises **locally** and has no friction. Ask it four times to add
sharing to a module and you get four correct, well-tested sharing models. No commit
was wrong; the architecture is gone.

So the guardrails cannot live in memory or in review taste. They must be:

- **Structural** — there is exactly one place the thing *can* be done, and
- **Executable** — a test goes red the moment a second place appears.

A **spine** is the four-part shape that gives you both. Build one per concern.
A real system needs a dozen or more, and they are all the same shape.

---

## 1. The problem this solves

Ask an agent to add sharing to a new module and it will write a correct,
well-tested `module_access` table — because that is the smallest change that
satisfies the request, and it looks right in the diff.

Do that four times and the codebase has four sharing models. No single commit was
wrong. The failure is invisible at commit-review altitude and only becomes obvious
when someone asks *"who can see this?"* and there is no one place to answer.

Human teams drift this way slowly, held back by the friction of remembering. Agents
have no friction and perfect local focus, so they drift **fast** — and they drift
*confidently*, with tests, because each parallel implementation is internally
correct. Reviewing an agent's diff for architecture is reviewing the wrong altitude:
the diff is fine. It is the fifth diff that is the problem, and by then nobody is
looking.

The same dynamic produces: three role vocabularies, two email senders, a second
outbound-HTTP client with different timeouts, a per-module retry policy, a bespoke
event envelope for one consumer, and a tool integration that calls a vendor SDK
directly from a request handler.

**An agent cannot be trusted to remember a rule. It can be stopped by a red test.**

---

## 2. What a spine is

Every spine in this document has exactly four parts. Learn the shape once and you
can build one for any concern.

| Part | What it is | Failure if missing |
|---|---|---|
| **1. Registry** | The one enumeration of the things of this kind — resource types, event types, tool ids, template ids, error codes. Data or a single enum, never scattered constants. | Nobody can answer "what are all the X?" Exhaustiveness tests become impossible. |
| **2. Resolver** | The one function that decides or dispatches. Everything routes through it. | Policy gets copied, then diverges, then contradicts. |
| **3. Seam** | One or two narrow entry points every caller uses. Nothing bypasses them. | Twelve call sites, eleven of which are correct. |
| **4. Enforcement test** | A test **generated from the registry** that fails when a new entry lacks its wiring, or when a second implementation appears. | Everything above decays into a style guide within two months. |

The enforcement test is the part most teams skip, and it is the part that makes
this an architecture instead of an aspiration.

**Rule of thumb:** if adding a new module/type/tool requires editing the resolver,
the spine has been bypassed and the design has failed. Adding an entry should mean
*registering it* — nothing more. Put that sentence in the registry's docstring, so
the next agent reads it at the exact moment it is about to do the wrong thing.

---

## 3. The reference spine: authorization

Authorization is the worked example because it is the one that hurts most when it
drifts, and because it is the spine every other spine ends up calling.

### 3.1 Subjects — who can act

Not everything that acts is a human. Model this on day one or retrofit it in pain.

```
subject
  id           pk
  kind         enum   -- 'user' | 'service' | 'api_key' | 'agent' | 'integration'
  tenant_id    fk     -- NULL only for platform-level operators
  parent_id    NULL   -- an agent/key acting on behalf of a user
  status       enum   -- active | suspended | revoked
```

Every grant, every audit row, every job envelope references a **subject**, not a
user. An agent, an MCP client, a CI service account and a webhook sender are all
first-class subjects with their own identity, their own scopes and their own
revocation.

**Delegation is explicit and bounded.** A subject acting *on behalf of* another
carries both ids, and the effective permission is the **intersection**, never the
union:

```
effective(actor) = permissions(actor) ∩ permissions(actor.on_behalf_of)
```

That single line is what stops an agent with broad service credentials from doing
something its human principal could not do. It is also the difference between
"the agent has an API key" and "the agent has an identity."

### 3.2 Tenant is not container

These get conflated, and the conflation is expensive.

- **Tenant** = the isolation boundary. Data residency, encryption keys, quota
  accounting, backup, export, and *deletion* are all per-tenant. Nothing crosses it
  without an explicit, audited, separately-implemented path.
- **Container** = an organisational grouping *inside* a tenant (workspace, team,
  project, org unit). Membership and defaults live here.

Every table that holds tenant data carries `tenant_id`, including join tables.
Every query is tenant-scoped by construction — a session-level setting, a row
security policy, or a repository base class — never by remembering to add a
`WHERE`. **Test it:** create two tenants, then assert that every registered read
route returns 404 for the other tenant's ids. Generate that test from the registry.

### 3.3 The registry

**One table registers every shareable thing. Module tables point at it. The
authorization layer never learns what any module is.**

```
resource
  id            pk
  type          text     -- 'project' | 'board' | 'document' | 'dataset' | …
  tenant_id     NOT NULL
  container_id  NOT NULL -- the workspace / org unit that owns it
  parent_id     NULL     -- see §3.7 before you add this
  restricted    bool     -- true = direct grants only
  created_by, created_at
```

```
projects.resource_id   → resource   (NOT NULL, UNIQUE)
boards.resource_id     → resource
documents.resource_id  → resource   ← added later, ZERO authz work
```

Two membership tables, and no others anywhere:

```
container_member (container_id, subject_id, role)  UNIQUE(container_id, subject_id)
resource_grant   (resource_id,  subject_id, role)  UNIQUE(resource_id,  subject_id)
```

### 3.4 The resolver

One function decides access. No other place does.

```
can_read(subject, resource):
    if resource.tenant_id != subject.tenant_id: return DENY
    if resource.restricted: return grant_exists(subject, resource)
    return member_of(subject, resource.container) or grant_exists(subject, resource)

role_of(subject, resource):
    max(container_role, grant_role)      # see the tradeoff in §3.7
```

**Adding a module is registering a type string and adding one foreign key.** If
adding a module ever requires editing the access layer, the registry has been
bypassed.

### 3.5 The seam

Exactly two entry points, and **read is separated from write**:

```
require_read(resource_ref, actor)          → resource | 404
require_role(resource_ref, actor, min_role) → resource | 404
```

Zero inline `owner_id == actor.id` checks in handlers. Make the read/write split
*before* introducing the helper — a single `accessible_x()` used everywhere is how
a dozen mutations silently become viewer-writable in one commit.

Cross-cutting rules live **inside** these two functions: "archived is read-only,"
"soft-deleted is invisible," "suspended tenants are frozen," "denial is 404." A
module written next year inherits all of them without knowing they exist. A rule
copied into each module is a rule that will be missing from the fifth one.

### 3.6 Guests fall out for free

A guest is a `resource_grant` with no `container_member` row: they see one resource
and nothing else — not the container, not its name, not its roster, not a sibling.
No guest-specific code is ever written. This is the clearest sign the registry is
earning its keep.

### 3.7 The tradeoffs — stated honestly

Every one of these is a real limitation, not a detail. Decide them deliberately.

**`max(container_role, grant_role)` means a grant never downgrades.** You cannot
express *"this workspace admin must not see the HR board."* `restricted` covers the
common case (direct grants only), but a member with a high container role plus any
grant still resolves upward. If you need true exceptions you need explicit **deny**
rules — and deny destroys the one-function simplicity, because deny must be
evaluated across the whole grant set with a precedence order, and it makes
"why can this person see this?" much harder to answer. Google's Zanzibar
deliberately has no deny. Copy that default; add deny only against a written
requirement.

**Hierarchy (`parent_id`) is a leak, not a convenience.** If the resolver does not
walk `parent_id`, a child marked unrestricted under a *restricted* parent becomes
visible to the whole container — **wider than its own parent.** So: either the
resolver walks the chain from day one (and you pay for depth-bounded recursion and
cycle detection), or **the column does not exist.** An unused self-FK next to a
documented leak is a loaded gun for the next agent.

**Listing is the hard problem, not fetching.** `can_read(one)` is easy.
*"Page 3 of the rows this subject can see, filtered and sorted"* is where
centralised authorization usually dies. Solve it once, in the spine, and expose it
as the third entry point:

```
readable_ids(subject, type, filters, page) → ids
```

Implement it as a single SQL predicate over `resource` joined to the two membership
tables — not as fetch-then-filter in application code, which breaks pagination
counts and leaks timing. If you cannot express it as one predicate, your model is
too clever. Measure it early: this table is a global hot path, it needs indexes on
`(tenant_id, container_id, type)` and `(resource_id, subject_id)`, and it will want
a short-TTL cache keyed by `(subject, resource)` with explicit invalidation on
grant writes.

**404 vs 403.** Default to 404 — a 403 confirms the id exists, which turns any
share link into a probe for what else exists. The single exception is a flow where
the actor demonstrably already knows the resource exists (they followed a share
link and you want a "request access" screen). Make that an explicit, enumerated
route behaviour, not a general relaxation.

**Explainability is free here and nowhere else.** Because one function decides,
make it return *why*: `Decision(allow, reason, matched_rule, subject, resource)`.
Log it. Expose an internal `explain(subject, resource)`. The first time a customer
asks "why could they see this?", this is the difference between an afternoon and a
week.

### 3.8 Every transport lands on the same seam

HTTP handlers, GraphQL resolvers, gRPC methods, MCP tools, CLI commands, webhook
processors, admin consoles and background jobs are **transports**. A transport
translates a wire format into a call on a service function. It does not decide
access, and it does not write its own queries.

```
transport → (builds ActorContext) → service function → require_read/require_role → data
```

The moment an MCP tool or an admin script queries a table directly, you have a
second access model with no tests.

---

## 4. The other spines

Each of these is the same four-part shape: **registry → resolver → seam →
enforcement test**. Build the ones your system actually has; skip the ones it does
not. Each subsection states the four parts, the rule that is most often broken, and
the test that catches it.

### 4.1 The request edge — middleware and route authorization

**Registry:** one ordered, declared middleware pipeline; one route table where each
route declares the scopes and the resource it touches.
**Resolver:** one `ActorContext` factory.
**Seam:** every handler receives a fully-built `ActorContext` and calls the authz
spine. It never re-authenticates and never parses a token.

```
ActorContext {
  subject, tenant, scopes, auth_method, on_behalf_of,
  request_id, trace_id, ip, user_agent, issued_at
}
```

The order is declared once, in one file, and it is the same everywhere:

```
trace → request-id → tenant resolve → authenticate → rate limit
      → route-level authorize (scopes) → handler
      → resource-level authorize (require_read/require_role)
      → error normalise → audit
```

**Authentication produces context; authorization consumes it.** Those are two
layers, not one. Multiple authentication methods (session cookie, bearer JWT, API
key, mTLS, signed webhook, OAuth for third-party apps) are **drivers behind one
interface** that all produce the same `ActorContext`. If a second method needs a
second code path downstream, the abstraction is in the wrong place.

Route-level authorization answers *"may this subject call this kind of endpoint at
all?"* (scopes). Resource-level authorization answers *"on this row?"* (the authz
spine). You need both; neither substitutes for the other.

> **Test:** enumerate every route from the framework's own route table and assert
> each is (a) in the public allowlist, or (b) covered by authentication *and*
> declares a resource type or scope. A new endpoint with no gate is a red build,
> not a code review finding. This one test is worth more than the rest combined.

### 4.2 Tools — internal, external, and MCP

Integrations are where drift is fastest, because each one arrives with a vendor SDK
and a plausible reason to be special.

**Registry:** one tool catalogue. Every capability the system can invoke — an
internal function, a third-party REST API, an MCP server tool — is one entry:

```
tool
  id                'crm.contact.create'      -- namespaced, stable, never reused
  kind              internal | http | mcp | queue
  input_schema      typed, validated
  output_schema     typed, validated
  side_effect       read | write | destructive | financial | external_visible
  required_scopes   [..]
  credential_ref    → secret store (never a literal)
  tenant_visibility all | allowlist
  timeout, retry_policy, rate_limit
```

**Resolver + seam:** one invocation function.

```
invoke(tool_id, args, actor_ctx) →
    validate input against schema
  → authorize (scopes ∩ delegated scopes, tenant visibility, resource authz)
  → resolve credential for (tenant, tool)
  → rate limit / quota
  → dispatch to the driver for `kind`
  → normalise errors into the error registry
  → validate output
  → audit (tool_id, actor, args digest, outcome, latency)
```

**The rule that is most often broken:** a handler, a job or an agent imports a
vendor SDK directly. Then timeouts, retries, redaction and audit exist for one
integration and not the others.

> **Test:** no module outside `adapters/<vendor>/` imports a vendor SDK. Every tool
> in the catalogue has a schema, a side-effect class and an authz rule —
> exhaustively, generated from the registry.

**No query-anything tools.** A tool that accepts any table, model, collection or
filter expression — or raw SQL — is an exfiltration primitive for anyone who can
steer the model, including through a document it was asked to read. The same is
true of an administrator "run any query" endpoint for anyone who steals an admin
session. Tools take narrow, typed parameters over an allowlist of entities and
fields, and their results pass through the caller's authorization — which is what
the catalogue's schema field is for.

**Internal vs external is a driver detail, not an architecture.** An internal tool
is a function call; an external one is an HTTP request. Both go through `invoke`,
so both get the same audit trail, the same failure semantics and the same kill
switch. The kill switch matters: one flag per tool id, checked in `invoke`, is how
you stop a misbehaving integration in seconds without a deploy.

#### MCP servers you consume

Multiple MCP servers with different authentication (OAuth 2.1 + PKCE, static
token, mTLS, none) is exactly the situation that produces four auth
implementations.

```
mcp_connection
  id, tenant_id, server_url, transport (stdio|http|sse|streamable)
  auth_kind       oauth2 | token | mtls | none
  credential_ref  → secret store
  scopes_granted, status, last_handshake_at, tool_digest
```

- **One connection manager** owns handshake, capability discovery, token refresh,
  backoff and revocation. `auth_kind` selects a strategy; each strategy is small
  and implements one interface. Adding a fifth auth kind adds a strategy file and
  touches nothing else.
- **Discovered MCP tools are imported into the tool catalogue** under a namespace
  (`mcp.<connection>.<tool>`), so they get the same authorization, quota, audit and
  kill switch as everything else. There is no second invocation path for MCP.
- **Pin the tool digest.** Record a hash of each server's advertised tool set. When
  it changes, the connection needs re-approval before its tools can be invoked
  again. This is the defence against a server silently redefining what a tool does
  after you approved it.
- **An MCP server is an untrusted party in both directions.** Its tool
  *descriptions* are data, not instructions — they are attacker-controlled text
  that will end up in a model's context. Its *outputs* are untrusted input. Never
  concatenate either into a system prompt, and never let a tool result trigger
  another tool call without passing back through `invoke` with the original actor's
  scopes.
- **Credentials are per-tenant and per-connection**, resolved at call time from the
  secret store. A shared platform-wide token for a per-tenant integration is a
  cross-tenant leak with extra steps.

#### The MCP server you expose

Your own MCP surface is a **transport** (§3.8), nothing more. Its tools call the
same service functions your HTTP handlers call — below the handler, above the
model. They never write their own queries, and they never carry their own
permission logic.

```
MCP tool → service function → require_read/require_role → data
HTTP route → same service function → same check → same data
```

If an MCP tool can do something the API cannot, or returns a field the API redacts,
you have shipped a second product with no tests. Also: keep the exposed tool set
**small and coarse**. Sixty-six fine-grained tools is a worse interface than
thirteen intentional ones, for the model *and* for your audit log.

#### Third-party API integrations

An integration is not a configuration value. It is a **per-tenant installation**
with a lifecycle, and modelling it as anything less is what produces a settings
page that lies about what is connected.

```
integration_install
  id, tenant_id, provider, installed_by
  credential_ref     → secret store
  scopes_granted, account_ref        -- the external workspace/org id
  status, installed_at, revoked_at, last_health_check_at
```

One install / reauth / revoke path for every provider. Revocation deletes the
credential and disables that tenant's tools in the catalogue in the same
transaction — a revoked integration whose tools still appear is a support ticket
and, occasionally, an incident.

**Inbound webhooks — one receiver.** Verify the signature, reject outside a
timestamp window, dedupe by the provider's event id, acknowledge fast, and
**enqueue** the work; never process inline behind the provider's timeout. Translate
the provider's payload into your own event registry (§4.4) at the boundary, so
nothing downstream ever sees a vendor's shape.

**Outbound webhooks — one sender.** Sign and timestamp, retry with backoff, DLQ,
per-endpoint circuit breaker, and a delivery log the customer can actually read.
Destinations go through the egress allowlist (§4.3).

**Sync — one code path.** Backfill and incremental sync are the same job with a
different cursor. Two paths means two bugs and only one of them gets tested. Add a
periodic reconciliation job that compares counts and checksums with the provider:
drift becomes a metric instead of a discovery.

**Writes to a third party are not idempotent unless you make them so.** Record the
provider's returned id against your idempotency key, and on retry look it up before
calling again. Otherwise "the request timed out" means "we may have charged them
twice."

Provider errors, rate limits and pagination quirks are normalised at the adapter
into the error catalogue (§4.10). Per-provider limits are declared as data, not
discovered in production.

### 4.3 Secrets, credentials and egress

**Registry:** one secret store; every credential referenced by id, never by value.
**Resolver:** one `resolve(credential_ref, tenant, actor)` that decrypts, checks
scope, and returns a short-lived handle.
**Seam:** one outbound HTTP client.

- Encryption keys are per-tenant where the threat model needs it, rotated on a
  schedule, and rotation is a tested path — not a document.
- **One outbound client** owns timeouts, retries with jitter, circuit breaking,
  proxying, TLS policy, request/response redaction, and the **egress allowlist**.
  The allowlist is your SSRF defence: destination hosts are resolved and checked
  against the allowlist *after* DNS resolution, and private ranges are refused.
  User-supplied URLs (webhooks, avatars, imports, "fetch this page for me") go
  through it or they do not go at all.
- Nothing logs a secret. Redaction lives in the client and the log formatter, not
  in the discipline of whoever writes the next log line.

> **Test:** no source file matches a credential-looking literal; every
> `credential_ref` in the tool catalogue resolves; no module constructs its own
> HTTP session/client object.

### 4.4 Messaging — the event bus

Kafka, RabbitMQ, Pub/Sub, SQS, NATS and Redis Streams are **drivers**. The
architecture is the envelope and the contract.

**Registry:** one event type registry, versioned, with a typed schema per type.
**Resolver:** one publisher and one consumer runtime.
**Seam:** `publish(event)` and a consumer decorator/base that every handler uses.

```
Envelope {
  event_id        uuid          -- the idempotency key, forever
  type            'board.item.created'
  version         int           -- additive changes only; new shape = new version
  occurred_at     timestamp
  tenant_id                     -- on every event, no exceptions
  actor           subject_ref   -- who caused it (may be a service or agent)
  subject_ref     {type, id}    -- what it happened to; resolvable in the registry
  correlation_id, causation_id  -- one request's whole tree, and direct parentage
  payload         typed per (type, version)
}
```

Six rules that prevent every common failure:

1. **Publish through a transactional outbox.** Writing to the broker inside a
   request that later rolls back emits an event for something that did not happen.
   The outbox row commits with the data; a relay publishes it. This is the single
   highest-value rule in this section.
2. **Consumers are idempotent by `event_id`.** Delivery is at-least-once. Assume
   duplicates and out-of-order arrival; keep a processed-ids table or make the
   handler naturally idempotent.
3. **Poison messages go to a DLQ with the envelope intact**, and the DLQ has an
   owner and a replay path. An unowned DLQ is a silent data-loss queue.
4. **Events carry facts, not authority.** An event never carries "who may see
   this." Anything that decides an audience calls the authz resolver at the time it
   decides — otherwise you have a second access model that is also stale.
5. **Additive schema evolution only.** Adding an optional field is free. Removing
   or retyping one is a new `version`, with both supported until every consumer has
   moved. The registry is what makes "every consumer" a knowable set.
6. **Know your broker's semantics before you treat them as interchangeable.**
   Redis pub/sub is fire-and-forget with no persistence and no replay — it is a
   cache-invalidation bus, not an event log. Kafka gives you ordered, replayable
   partitions and per-key ordering. RabbitMQ gives you flexible routing and
   per-message ack. The interface can be uniform; the *guarantees* are not, and the
   choice must be written down with the reason.

> **Test:** every published event type is in the registry with a schema; every
> registered type has at least one consumer or an explicit "no consumer yet" note;
> no module publishes outside the publisher seam; every consumer declares its
> idempotency strategy.

### 4.5 Notifications — email, push, in-app, SMS, webhooks

This is the spine that leaks data quietly, because notifications bypass the API
where all the checks live.

**Registry:** one template catalogue (`template_id → typed payload × locale ×
channel`) and one notification type registry mapping event types to audiences.
**Resolver:** one dispatcher.
**Seam:** `notify(notification_type, subject_ref, payload, actor)`.

```
notify → resolve audience via the AUTHZ RESOLVER (never a hand-built list)
       → per-recipient: preferences, locale, quiet hours, digest window
       → render typed template for (template, locale, channel)
       → per-recipient redaction: send only what THAT recipient may read
       → hand to channel driver (smtp/ses/apns/fcm/webhook/in-app)
       → record delivery + provide one unsubscribe/preference path
```

**The rule that is most often broken:** the audience is built by hand — "everyone
in the workspace" — and a restricted resource's title lands in the inbox of someone
the API would have given a 404. Derive the audience from `readable_by(resource)`,
and render each recipient's copy against what *they* may read.

Channels are drivers. Locale and direction (LTR/RTL) are template concerns, not
per-channel forks. One preference model covers every channel; one unsubscribe path
covers every recipient; one suppression list covers bounces and complaints across
all senders.

> **Test:** nothing imports the mail/push SDK except the driver; every notification
> type has a template in every supported locale and channel; every template's
> payload type is declared; a fixture asserts that a restricted resource notifies
> only its grantees.

### 4.6 Background jobs and schedules

**Registry:** one job catalogue (name → typed args, queue, retry policy, timeout,
concurrency limit, idempotency key rule).
**Resolver:** one enqueue function and one worker runtime.
**Seam:** `enqueue(job_name, args, actor_ctx)`.

The original version of this document said *"background jobs carry no
authorization; the HTTP boundary is the only gate."* That is true for a
single-tenant monolith with one trusted producer, and dangerous otherwise. The
correct generalisation:

> **Jobs carry a sealed capability, not a permission check.**

The boundary makes the decision and **serialises it into the envelope**:

```
JobEnvelope {
  job_name, args,
  tenant_id, actor: subject_ref, on_behalf_of,
  granted: [scopes], resource_ref, decided_at, expires_at,
  correlation_id, attempt, idempotency_key
}
```

The worker does not re-derive policy (that would be a second access model), and it
does not trust a bare id (that is tenant confusion on a replay). It **validates the
envelope**: right tenant, not expired, capability covers the action, subject still
active. Cheap, uniform, and it survives replays, multiple producers, and
cross-tenant fan-out.

Scheduled jobs have no human actor, so they run as a **named service subject** with
explicit, minimal scopes — never as "system, therefore everything." A fan-out
scheduled job re-enters the seam once per tenant, with that tenant's context.

> **Test:** no queue call outside the enqueue seam; every job in the catalogue has
> typed args and a retry policy; every worker entry point asserts an envelope.

### 4.7 Files and storage

**Registry:** one blob table (`id, tenant_id, resource_ref, content_type, size,
checksum, storage_key, scan_status, retention_class`).
**Resolver:** one storage service.
**Seam:** `put(...)`, `get_url(blob_id, actor)`.

Access to a file is `require_read` on the blob's owning resource — files are not a
separate permission universe. Downloads are short-lived signed URLs minted after
the check, never a public bucket path. Uploads are content-type sniffed (not
trusted from the client), size-capped, virus/malware scanned before they become
readable, and stored under an opaque key. Per-tenant prefixes are the minimum;
per-tenant buckets or keys where isolation demands it.

### 4.8 Quota, rate limiting and cost

One place decides "may this actor do this much." Limits are declared as data
(per plan, per tenant, per subject kind, per tool), so adding a limit is adding a
row. Rate limiting at the edge protects the service; quota in the seam protects the
business; **token/compute budgets for AI calls belong here too** — per tenant, per
agent, per tool — checked before the call and recorded after it. Metered usage
records are written once, in one place, or your invoices and your logs disagree.

### 4.9 Audit

One append-only audit path, written by the seams themselves — not by handlers that
might forget.

```
audit { at, tenant, actor, on_behalf_of, action, resource_ref,
        decision (allow|deny), reason, before/after digest,
        request_id, correlation_id, source (http|mcp|job|cli|webhook) }
```

Because every decision passes through one resolver, `deny` events are free and
enormously valuable — a spike in denials is the earliest signal of a credential
leak or a broken client. Audit rows are immutable and have their own retention,
separate from business data deletion.

### 4.10 Errors and user-facing messages

**Registry:** one error code catalogue, each with an HTTP/protocol mapping, a
severity, whether it is retryable, and a message per locale.
**Seam:** one error normaliser at the edge; handlers raise domain errors, never
protocol errors.

Third-party and MCP failures are normalised into the same catalogue at the adapter
boundary, so a caller handles one error shape regardless of where the failure came
from. Internal detail never reaches the client; the correlation id does, so a
support conversation can find the trace.

> **Test:** every backend error code has a message in every locale, and every
> client-side message maps to a real code. Both directions, or the pair rots.

### 4.11 Data lifecycle

One export path and one deletion path, per tenant and per subject, both driven by
the resource registry — which means they cover modules written after they were
built. Deletion has a written policy per data class (hard delete, soft delete with
a window, anonymise, retain for legal hold), and the audit log is exempt by design,
in writing. Field-level PII classification lives in the schema, so the exporter and
the redactor read it instead of hardcoding field lists.

### 4.12 Configuration, environment and credentials

**Registry:** the configuration schema — every variable declared once, typed,
required or defaulted, and marked secret where it is one.
**Resolver:** one loader, run at startup, failing loudly.
**Seam:** the typed configuration object. No `getenv`, `os.environ`, `process.env`
or `import.meta.env` anywhere else.

Three kinds of value live in three different homes, and most credential incidents
start with a value in the wrong one:

| Kind | Home |
|---|---|
| Configuration (URLs, toggles, sizes) | The typed config object |
| Platform secrets (DB password, signing keys, provider keys) | A secret store in deployed environments, injected at runtime; a local `.env` only for local development |
| Tenant credentials (a customer's OAuth tokens and API keys) | The database, encrypted, resolved per tenant by the credential resolver — **never** the environment |

- **Fail at startup, not at first use** — on a missing value, a malformed one, a
  signing key under its minimum length, or a known placeholder.
- **Redact by marker, never by list.** The default `repr` of most settings objects
  is a credential dump, and a single exception raised on it is enough to print the
  whole thing into a CI log. Redact any field named like `PASSWORD`, `SECRET`,
  `KEY`, `TOKEN` — so next year's credential is hidden because of what it is
  called, not because someone remembered to add it to a list.
- **One `.env` location per deployable.** Two files at different depths are two
  configurations that will disagree.
- **`.env.example` is generated from the schema, or tested equal to it.** Test the
  four-way agreement: code references ↔ schema ↔ example ↔ deployment files.
- **Public prefixes are publication.** `VITE_*`, `NEXT_PUBLIC_*`, `REACT_APP_*` and
  friends are compiled into every browser bundle.
- **One flag service**; every flag has an owner and a removal date.

Scattered `getenv` at call sites is the same disease as scattered access checks,
with worse symptoms. The security half of this joint — the audit checklist, the
leak-response order, the redaction test — is vertebra V4 of the security spine
companion.

### 4.13 Databases and persistence

**Registry:** one schema and one linear migration history.
**Resolver:** one session / unit-of-work manager.
**Seam:** repositories or query modules — never raw connections in handlers.

- **One migration tool, one forward-only history.** Every migration is verified on a
  throwaway instance of the real engine before it touches anything that matters —
  not on a developer's assumption that it is "just an added column."
- **Expand → migrate → contract.** Never ship a breaking schema change in the same
  deploy as the code that needs it. Add the column, deploy code that tolerates both
  shapes, backfill, then remove. This is what makes rollback possible.
- **Transactions belong to the service layer.** One unit of work per request or job.
  Handlers do not open transactions; repositories do not commit. A request with two
  transactions is a consistency bug that will be found by a customer.
- **Tenant scoping is structural** (§3.2): row-level security, a session variable, or
  a base repository — never a `WHERE` clause someone remembers.
- **Read replicas carry a stated staleness bound**, and read-your-writes either goes
  to the primary or carries a consistency token. "It is usually fast enough" is not
  a consistency model.
- **Soft delete versus hard delete is one written policy** tied to the retention
  class (§4.11), not a per-table preference that varies by whoever wrote the table.
- **The database is not a queue, a cache or a search engine** — until it
  deliberately is. An outbox table, advisory locks or a vector column are legitimate
  choices; they are made once, in writing, with the reason. What is not legitimate
  is drifting into them.
- Separate connection pools for API and workers, sized separately. One shared pool
  means a slow report starves every request.
- No shared database across services (§5.3).

> **Test:** CI fails on schema drift between models and migrations; every table
> either carries `tenant_id` or is on the enumerated global list; every foreign key
> has an index; every migration in the history applies cleanly to an empty database.

### 4.14 The model layer — LLM routing, prompts and evals

**Registry:** a model route catalogue, a prompt registry and an eval set.
**Resolver:** the router.
**Seam:** `complete()` / `stream()` / `embed()`.

```
model_route
  logical_name   'reasoning.default' | 'extract.cheap' | 'embed.text'
  candidates     [ {provider, model, weight, max_context, cost_per_1k, region} ]
  fallbacks      ordered
  timeout, retries, circuit_breaker
  data_policy    { retention, residency, training_opt_out }
```

- **Call sites name a capability, never a model.** `reasoning.default`, not a
  version string. A model swap must be one row, not a grep across the codebase —
  and in a codebase an agent writes, that grep will miss three call sites.
- **One place owns** fallback, retry, circuit breaking, streaming, token accounting
  and cost attribution to tenant and run (§4.8, §6.2), plus a normalised failure
  taxonomy: rate limit, context overflow, timeout, content filter, malformed output,
  **refusal**. A refusal is an *outcome*, not an error; it gets its own code and is
  never silently retried into a different answer.
- **Prompts are registry entries**, not string literals: id, version, typed inputs,
  locale, model constraints. The version id appears in every trace, so *"why did the
  output change?"* has an answer. A prompt edited inline is an untracked deploy.
- **Structured output is validated at the seam** (§6.5), with a bounded repair loop
  charged to the run budget.
- **Data policy is per tenant and enforced in the router.** A tenant that forbids a
  provider, a region, or training on its data gets a route that excludes it — or a
  hard denial. Never a default that someone is expected to override. This is where
  the model layer meets DLP (§4.16) and egress (§4.3).
- **Router libraries are drivers, not your architecture.** A gateway or routing
  library sits *behind* your seam; if its configuration format becomes the place
  your routing lives, you have adopted a vendor's model of your system.
- **Evals are this spine's enforcement test.** A registry of cases per prompt id,
  run in CI, failing the build on regression. Without them the prompt registry is
  just a folder with better intentions.

### 4.15 Retrieval and vector stores

**Registry:** one index catalogue.
**Resolver:** one retrieval function.
**Seam:** `retrieve(query, actor, scope)`.

```
index
  name, version
  embedding_model, dimensions, distance, chunker   -- part of the index IDENTITY
  source_type          -- a registered resource type
  tenant_strategy      -- partition | metadata_filter
```

- **Every vector carries `tenant_id` and `resource_id`, and the authorization filter
  is applied *before* the search, not after.** Post-filtering is the default mistake
  and it fails twice: it silently destroys recall (ask for top-10, keep the 2 the
  user may see) and it leaks through result counts and timing. Pre-filter, or
  partition per tenant.
- **The index is derived data, never the system of record.** You must be able to
  rebuild it from source. If you cannot, you are running a database with no backups
  and calling it a cache.
- **Embedding model, dimensions and chunking are part of the index identity.**
  Changing any of them creates a new index version plus a backfill job (§4.6) — never
  an in-place change, or you get mixed-geometry vectors and silently wrong
  similarity that no test will catch.
- **Deletion and re-permissioning must propagate.** When a resource is deleted,
  moved or restricted, its chunks follow in the same outbox as the change — not in a
  nightly cleanup. This is the most common vector-store leak, and it is invisible
  until someone searches for a document they were meant to lose access to.
- Chunking, hybrid search and reranking are strategies behind the one seam. pgvector,
  Qdrant, Pinecone and OpenSearch are drivers.

> **Test:** two tenants, one query, zero cross-tenant hits; delete a resource and
> assert its chunks are gone within the stated bound; restrict a resource and assert
> a non-grantee retrieves nothing — including no partial or "similar" chunk.

### 4.16 Data protection — classification, redaction and DLP

**Registry:** field-level classification in the schema, plus one policy matrix.
**Resolver:** one classifier / redactor.
**Seam:** every egress point.

```
class:       public | internal | confidential | pii | phi | pci | secret
destination: log | trace | llm | email | export | webhook | third_party | analytics
policy[class][destination] = allow | mask | tokenize | deny
```

- **DLP is enforced at egress, and it only works because the seams already exist.**
  One log formatter, one tracer, one model seam, one notification dispatcher, one
  outbound client, one exporter — six call sites. Without the spines, egress points
  are unbounded, which is exactly why most data-protection programmes are documents
  rather than mechanisms.
- **Classification lives with the schema**, as a field annotation, so the exporter,
  the redactor and the model seam all read one source. A classification spreadsheet
  is out of date the day it is written.
- **Inbound too.** Scan uploads and user-supplied prompts for secrets and regulated
  data before storing or forwarding. A customer pasting an API key into a support
  message becomes your incident, not theirs.
- **Mask versus tokenize is a per-class decision, written down.** Masking is
  irreversible; tokenization needs a vault and a re-identification path that is
  itself authorized and audited.
- Tenant overlays — residency, banned providers, no-training — intersect with the
  router (§4.14) and the egress allowlist (§4.3). One policy object, three
  enforcement points.

> **Test — the canary.** Plant synthetic PII and a fake credential in a test tenant,
> then exercise the system and assert those strings never appear in logs, traces,
> emails, exports, webhook bodies or model payloads. One test, every egress, catches
> the entire class of failure.

### 4.17 Observability — one trace, one id

**Registry:** one naming convention for spans, metrics and events.
**Resolver:** one tracer.
**Seam:** instrumentation lives *in the spines*, not in handlers.

- **The LLM trace and the application trace must be the same trace.** Tracing
  vendors — Langfuse, LangSmith, Phoenix, plain OTel — are **exporters behind one
  seam**. The model span's trace id is the `correlation_id` from the envelope
  (§5.3) and its run id is the `root_run_id` from the run registry (§6.2). Two
  observability universes that cannot be joined is the standard failure here, and
  you discover it on the day you most need to explain a single request.
- **Instrument the seams, not the call sites.** Because everything passes through
  `invoke`, `publish`, `notify`, `enqueue`, `complete` and `require_read`, coverage
  is a property of the architecture rather than of an agent remembering to add a
  span.
- **Traces contain prompts, which are the densest PII in the system.** Redaction
  happens in the seam *before* the exporter (§4.16) — never as a vendor-side toggle
  you hope is still on.
- **Never let the vendor be the only home for a fact.** Prompts, eval sets and
  datasets live in your registries and are *exported* to the tool, not authored
  inside it. Otherwise your architecture is a folder in someone else's SaaS, and
  your migration path is retyping.
- Three signals, one id: every log line, metric and span carries tenant, actor,
  correlation id and run id. That is what makes an incident a query instead of an
  archaeology project.

---

## 5. Distribution — services, boundaries, and the spine

Microservices are not a spine. They are a **decomposition decision on a different
axis**, and the relationship between the two axes is the whole point of this
section:

> **Distribution does not create new spines. It tests whether the ones you had
> were real.**

If your authorization "layer" was a convention that everyone happened to follow,
splitting the process reveals it immediately — because now the second
implementation lives in another repository, ships on another schedule, and no
single test can see both.

### 5.1 The cutting rule

**A service boundary is a transport boundary, never a policy boundary.**

Cut along **resource types and ownership** — the things the registry already names.
Never cut *through* a spine. A boundary that leaves half of authorization,
half of the error catalogue, or half of the tenancy rule on each side has produced
exactly the parallel implementation the spine exists to prevent, and has made it
harder to detect.

Concretely, before drawing a boundary, ask of each spine: *after this cut, is there
still exactly one implementation of this concern, and can one test prove it?* If
the answer is no for any spine, either move the boundary or first extract that
spine into something both sides consume.

### 5.2 How a spine stays single across processes

Each spine must answer: *how do I remain one implementation when the process is
plural?* There are exactly three shapes, and mixing them is the drift.

| Shape | How | Cost |
|---|---|---|
| **Shared library** | The spine is a package; every service imports it. | Version skew. Two versions deployed = two policies, silently. |
| **Central decision service (PDP)** | One service answers; everyone calls it. | Latency and availability coupling; a new bottleneck and a new outage class. |
| **Replicated data plane** | Policy and relation data are distributed; decisions are made locally against a replica with a stated staleness bound (the Zanzibar / OPA model). | Expensive to build; you now own a consistency model, including read-your-writes tokens. |

**Rule of thumb:** shared library until it hurts; then a decision service with a
local cache; then replication when scale demands it. **Never two of these at once**
— that is not a migration, it is two policies.

If you choose the library, the enforcement test changes shape: CI asserts every
service is on the same major version of the spine package, and the matrix test
(§9) runs **inside every service**, not once in a shared repo.

### 5.3 What genuinely is new when you distribute

Four things, and each is a spine in its own right.

**1. The propagation envelope — one envelope, every hop.** The same fields ride on
every HTTP call, gRPC call, queue message and agent message. If they are not one
envelope, context dies at hop three and nobody notices until an incident.

```
Envelope {
  tenant_id                      -- never inferred at the far end
  actor: subject_ref, on_behalf_of, delegation_chain
  capability { scopes, resource_ref, expires_at }   -- sealed at the boundary
  correlation_id, causation_id, trace_id
  deadline_at                    -- a BUDGET, not a per-hop timeout
  idempotency_key
  provenance                     -- see §6.4
}
```

`deadline_at` is the field everyone forgets. A per-hop timeout of 5s across four
hops is a 20-second request that the caller abandoned 15 seconds ago; a deadline
that each hop honours and passes down means work stops when it stops mattering.

**2. The contract registry.** Service interfaces (OpenAPI, protobuf, JSON Schema)
are a registry like any other: versioned, additive-only within a version, with
generated clients as the **only** way to call a sibling. Hand-rolled HTTP to
another service is the same offence as a second database client. Consumer-driven
contract tests run in CI on both sides, so "who still depends on this field?" is a
question with an answer.

**3. Data ownership.** One service owns a table; nobody else opens a connection to
it. Others read through its API or through a replicated read model with a written
staleness bound. A shared database between services is a monolith with network
latency and no transactions — the worst available trade.

**4. Cross-service writes are sagas with an owner.** No two-phase commit, and no
implicit chain of events that happens to leave the system consistent. A cross-
service write is a named saga with explicit compensations, one orchestrator, and a
state machine you can query — otherwise "why is this order half-created?" has no
answer.

Everything else that looks new is an existing spine seen from another angle: a
sibling service is an entry in the tool catalogue (`kind: service`) and gets its
timeouts, retries, circuit breaker, audit and kill switch from `invoke` (§4.2);
inbound internal traffic passes the request edge (§4.1) exactly like public traffic,
because being inside the cluster grants nothing (§7.1). If a hot internal path
genuinely cannot afford the seam, it goes on the enumerated exemption list with a
measured number attached — not on a hunch.

### 5.4 The honest cost, for an agent-written codebase

This is the part that is specific to how you are building, and it cuts against
splitting:

> **Enforcement gets weaker exactly where drift pressure gets stronger.**

In one repository, "there is only one authorization implementation" is a test that
either passes or fails. Across twelve repositories, it is a shared package, a
version policy, and twelve teams' discipline — and the agent working in repo seven
cannot see repo three at all, so its local optimum is once again to write a
correct, well-tested, brand-new access table.

Therefore:

- **Default to a modular monolith with real internal seams.** Modules that call
  each other through service functions and could be split later cost almost
  nothing; splitting them prematurely costs a distributed system.
- **Split late, and split few.** Split when a component has a genuinely different
  scaling profile, failure domain, release cadence, or compliance boundary — not
  because the codebase feels large.
- **Keep the spines in one place.** A monorepo, or a small number of published
  internal packages with contract tests. The spine package is the thing you must
  not fork.
- **Every repository gets the `CLAUDE.md` block (§14), and every repository runs
  the matrix test.** An agent's context is the repository it is in; a rule that
  lives only in the platform repo does not exist.

---

## 6. Agentic systems — when the callers are agents

Yes, this belongs in the spine — and the most expensive mistake in agentic
architecture is deciding that it does not.

The tempting move is to build an "agent mesh" as a parallel universe: its own
identity model (or none), its own message format, its own memory store, its own
routing, its own retries. That is the drift in §1 at the largest possible scale,
and it arrives with a plausible justification, because agent traffic *feels*
different from user traffic.

It is not different. **An agent is three things at once, and each maps to something
that already exists:**

| The agent as… | Maps to | Consequence |
|---|---|---|
| **Subject** | §3.1 | It has an identity, scopes, a status and an audit trail. Not a superuser. |
| **Transport** | §3.8 | When it acts, it calls the same service functions a handler calls, through the same tool seam (§4.2). |
| **Service** | §5 | When it is called, it has a contract, a budget, a deadline and an owner. |

So agent-to-agent communication needs **no new spine** — it needs the existing ones
plus **four additions** that only arise because the caller is non-deterministic and
its inputs are attacker-reachable.

### 6.1 Agents resolve through the registry, never point to point

An agent that can call another agent is an entry in the tool catalogue
(`agent.researcher`, `agent.reviewer`) with an input schema, an output schema, a
side-effect class, required scopes and a budget. Calls go through `invoke` (§4.2),
which means agent traffic inherits authorization, quota, audit, error normalisation
and the per-tool kill switch for free.

Direct point-to-point references between agents produce an N² mesh that nobody can
audit, rate-limit, cancel or change. The registry is also what makes the question
*"what can this agent reach?"* answerable — which is the question an incident will
open with.

Protocols — MCP, A2A, a queue, plain HTTP, whatever arrives next — are
**transports** underneath that registry entry, exactly as in §3.8. A new protocol
adds a driver. It never adds a second catalogue.

### 6.2 The run registry — the piece most systems are missing

Multi-step, multi-agent work needs a first-class unit, or it cannot be observed,
resumed, cancelled or billed:

```
run
  id, root_run_id, parent_run_id
  tenant_id, actor: subject_ref, delegation_chain
  goal / input, output, status
  budget { tokens, cost, wall_clock, tool_calls, depth }   -- consumed, remaining
  started_at, ended_at, cancel_requested_at
  correlation_id
```

Three properties matter, and all three fail together when the registry is absent:

- **Budgets decrement down the tree.** A child's budget is drawn from its parent's
  remaining budget, never granted afresh. This is what makes runaway cost and
  infinite delegation loops structurally impossible rather than a monitoring
  problem.
- **Cancellation propagates.** Cancelling a parent cancels its descendants, and
  in-flight tool calls check the flag. Without this, "stop" is a suggestion.
- **Audit rolls up.** One `root_run_id` reconstructs the entire tree — every
  prompt, tool call, decision and denial — which is the only way to answer *"why
  did the system do that?"* after the fact.

### 6.3 Addition one — permission never increases along a delegation chain

This is the single most important invariant in an agentic system:

```
effective(chain) = ⋂ permissions(link) for every link in the chain
                   ∧ depth ≤ max_depth
                   ∧ budget_remaining > 0
```

Agent A cannot do X. Agent B can. If A can ask B to do X on A's behalf and B
evaluates the request against **B's** permissions, you have built privilege
laundering: a confused deputy with a chat interface. The intersection rule makes
that structurally impossible, and it is trivially testable — assert that a chain
`user(viewer) → agent A(admin) → agent B(admin)` cannot perform an admin action.

Two corollaries:

- **A capability, not an identity, crosses the boundary** (§8, rule 7). The sealed
  capability carries the already-intersected scopes, so the receiving agent
  validates an envelope rather than re-deriving policy from its own credentials.
- **Depth is bounded and recorded.** Unbounded delegation is not a clever emergent
  architecture; it is an unpriced recursion.

### 6.4 Addition two — every message carries provenance, and provenance is taint

An agent's inputs are attacker-reachable in a way a service's are not: a fetched
web page, an uploaded document, an external MCP server's tool description, or
another agent's output can all contain text engineered to be read as an
instruction.

So the envelope (§5.3) carries a provenance class, and it **propagates as taint**:

```
provenance: trusted_internal | user_supplied | external_fetched | model_generated
```

- Output derived from tainted input is itself tainted. Taint never washes out
  because content passed through a model — passing through a model is precisely
  where it becomes dangerous.
- **Content is data, never instructions.** Another agent's message, a tool result
  and a tool *description* all enter context as quoted, labelled data. None of them
  can expand the caller's scopes, and none can cause a tool call except by
  proposing one that goes back through `invoke` with the original actor's
  intersected scopes.
- Tools whose `side_effect` is `destructive`, `financial` or `external_visible`
  **refuse to execute on tainted input without a human decision** — enforced in
  `invoke`, from the tool's registry entry, not by a sentence in a prompt.

That is how a poisoned document stops at hop one instead of executing three hops
later with a service account's credentials.

### 6.5 Addition three — the contract is on the interface, not the behaviour

A service's contract is *given X, return Y*. An agent's contract can only be
*given X, return something that validates against this schema, or fail explicitly*.
Three consequences:

- **Typed output, validated at the seam.** An unvalidated agent response is an
  untyped API response written by an adversary-reachable process. Validation
  failure is a normal outcome with an error code (§4.10), not an exception path
  someone will handle later.
- **Idempotency is on the task, not the response.** Retrying a service call should
  return the same answer; retrying an agent call may return a different one. So the
  idempotency key is the task id, retries are capped and charged to the run budget,
  and a repeated task returns the *recorded first result* unless a new run is
  explicitly requested.
- **Non-determinism is a first-class failure mode.** Budget the repair loop
  (validate → one corrective attempt → fail), and record every attempt. "Try again
  until it parses" is an unbounded cost with a deadline attached to it.

### 6.6 Shape: a supervisor with typed briefs beats free-form agent chat

An opinion, stated plainly because the alternative is fashionable:

**Two agents conversing freely is the worst available topology.** It is unbounded
in cost, unauditable in practice (the transcript is the only artefact), impossible
to cancel meaningfully, and its failure modes are emergent rather than enumerable.

The shape that works is a **supervisor**: one orchestrator decomposes the goal,
issues *typed, bounded briefs* to workers, and **re-verifies results against the
real system** — tests, queries, the code — before accepting them. Workers do not
talk to each other; they return typed results to the supervisor. This is the only
topology where the run tree is a tree, the budget is divisible, cancellation means
something, and the matrix test has anything to attach to.

Peer-to-peer agent conversation is worth reaching for only when a task genuinely
requires negotiation between parties with different information and different
principals — and then it gets its own bounded turn count, its own budget, and its
own written justification, like any other exemption.

### 6.7 Agent memory is a resource, not a blob

Whatever an agent remembers — conversation history, extracted facts, embeddings,
scratchpads — is data belonging to a tenant and usually to a subject. So it is
registered in the resource registry, tenant-scoped, and read through the same
resolver as everything else.

The failure this prevents is the fastest data leak in agentic systems: a shared
memory or vector store that retrieval queries directly, so a fact learned in one
tenant's session is recalled in another's. **Retrieval that skips the resolver is
not a feature, it is a cross-tenant read.** The same applies to caches keyed on
prompt text and to any "global knowledge" store an agent writes to.

> **Tests for this section:** an agent cannot exceed its principal's permissions
> (delegation-chain matrix test); a tainted input cannot reach a destructive tool
> without a human decision; every agent-to-agent call resolves through the tool
> catalogue; every run has a parent budget it cannot exceed; cancelling a root run
> terminates its descendants; retrieval for tenant A never returns tenant B's rows.

---

## 7. Zero trust is a property, not a layer

You do not buy or build a "zero trust layer." Zero trust is what you get when the
spines above compose. It is worth naming the properties explicitly, because each
one is a testable claim about your system:

1. **No trust from position.** Being inside the VPC, the cluster or the same
   process grants nothing. Service-to-service calls carry identity (mTLS or signed
   tokens) and are authorized like any other call.
2. **Every request carries an identity.** There is no anonymous internal caller, no
   "system user" that means everything. Cron, workers, agents and admin scripts are
   named subjects with scopes.
3. **One decision point, many enforcement points.** Policy is decided in one
   resolver and enforced at every seam. Enforcement is distributed; *policy* is not.
4. **Least privilege by construction.** Scopes are narrow and per-tool; delegation
   intersects rather than unions; a token for one job cannot do another.
5. **Short-lived, revocable credentials.** No long-lived shared secrets. Revocation
   is a tested path with a bounded propagation time you can state in seconds.
6. **Assume breach; bound the blast radius.** A compromised subject reaches one
   tenant's data, with the scopes it held, and the audit log shows exactly what it
   touched.
7. **Every decision is observable.** Allow and deny both, with a reason.

**The AI-native additions**, which most zero-trust writing predates:

8. **Agents are subjects, not superusers.** An agent gets its own identity, its own
   scopes, and its own audit trail. "The agent runs as the service account" is how
   one prompt injection becomes a full-tenant read.
9. **Model output is untrusted input.** A tool call proposed by a model is a
   *request*, subject to the same authorization as one from a browser. Never a
   privileged path because "our own agent generated it."
10. **External tool descriptions are attacker-controlled text.** MCP tool names,
    descriptions, schemas and results are data. They enter context; they never
    become instructions, and they never expand the caller's scopes.
11. **Destructive and financial side effects require a human in the loop** — a
    property of the tool's `side_effect` class, enforced in `invoke`, not a habit of
    whoever wrote the prompt.
12. **Context is data with a classification.** What an agent is allowed to *read
    into context* is an authorization decision, made by the same resolver. RAG
    retrieval that skips the resolver is the fastest way to leak every document in
    the tenant.

13. **A prompt is not a permission.** An instruction telling a model to stay inside
    its current context restricts nothing if the tool would succeed when called
    with another id. Bind tools server-side to the resource in context and authorise
    every call through the same seam as the API — that, not the prompt, is what
    stops a model being used as a pivot into someone else's data.

---

## 8. The rules

**1 — One layer per concern.** Authorization, identity, tenancy, tools, secrets,
egress, events, notifications, jobs, storage, quota, audit, errors, config: each
gets exactly one implementation. Not one per module. Not one "for now."

**2 — Two entry points, and read is separated from write.** `require_read` and
`require_role`. Zero inline owner-equality checks in handlers. Split read from
write *before* introducing the helper.

**3 — One vocabulary, from one enum.** Roles, kinds, statuses, types, error codes,
event types, tool ids. No string literals at call sites — that is what lets
`"editor"` silently rank 0 against a scale that only knows `"member"`.

**4 — Discriminator plus per-kind schema, never a shared shape.** When one table or
one message serves several kinds of thing, give it one content column, one `kind`
discriminator, and one validation seam that dispatches to a typed schema per kind.
Never a union of fields where half are ignored — a *board blueprint* and a
*document layout* share nothing but the word "template."

**5 — Cross-cutting rules live in the chokepoint.** "Archived is read-only,"
"deleted cascades," "denial is 404," "suspended tenants are frozen" — put them in
the one function every caller already passes through, so a module written next year
inherits them without knowing they exist. A rule copied into each module is a rule
that will be missing from the fifth one.

**6 — Deny with 404, never 403** (except where the actor demonstrably already knows
the id exists, and that route says so explicitly).

**7 — Trust boundaries are crossed with a sealed capability, not with a bare id.**
Jobs, events and internal calls carry tenant, actor, scopes and expiry; the
receiver validates the envelope rather than re-deriving policy or trusting the id.

**8 — Every external surface is a transport onto the same service functions.** HTTP,
MCP, GraphQL, CLI, webhooks, admin. A transport never queries data directly.

**9 — A service boundary is a transport boundary, never a policy boundary.** Cut
along resource types and ownership; never cut through a spine. After any cut,
exactly one implementation of each concern must remain, provable by one test.

**10 — Permission never increases along a delegation chain.** An agent acting for
a principal gets the INTERSECTION, depth-bounded and budget-bounded. Anything
else is privilege laundering.

**11 — Adapters are the only place a vendor exists.** One directory per vendor, one
interface, no SDK imports outside it. Swapping a provider must be one file.

**12 — Delete the old path.** A migration is not finished when the new path works;
it is finished when the old one is gone. Then add a test asserting the deleted names
are never recreated.

**13 — Deliberate exclusions get written down with the trigger that reverses them.**

**14 — Every rule above has an enforcement test**, added in the same commit as the
concept it protects.

**15 — Verify against the code, never against a document's checkboxes.** Status docs
rot silently; branches drift; a card saying "merges clean" was measured once, months
ago. Re-measure before deciding anything.

---

## 9. Enforcement — the part most teams skip

Every rule above decays into a suggestion unless a test fails when it is broken.
This is the difference between a style guide and a spine. There are three tiers, in
descending order of value.

**Tier 1 — the matrix test, generated from the registry.** This is the centrepiece.
For every registered type × every role × every operation, assert the outcome:

```
for type in resource_registry:            # generated, not hand-listed
  for role in [none, guest, viewer, member, editor, admin, other_tenant]:
    for op in [read, update, delete, share, export]:
      assert response_status(type, role, op) == expected[role][op]
```

A new module that forgets a gate fails this test the day it is registered, because
the parameters come from the registry rather than from someone remembering to add a
case. Do the same for tenancy (every type × the other tenant's id → 404) and for
routes (every route in the framework's route table is authenticated or explicitly
public).

**Tier 2 — exhaustiveness tests.** Every entry in every registry has its wiring:
every resource type has a module FK; every event type has a schema; every tool has
input/output schemas, a side-effect class and a credential; every error code has a
message in every locale, and every message maps to a code; every notification type
has a template per channel and locale.

**Tier 3 — structural tests (greps with opinions).** Cheap, useful, and honest about
their limits: they check shape, not behaviour, so they belong *under* the two tiers
above rather than instead of them.

- No registered model is gated by an owner-equality check in a handler.
- No module defines its own role names, error strings or status literals.
- Deleted modules are not recreated (assert the names stay absent).
- Only the sharing service writes grants; the sharing service never decides access.
- Only the dispatcher queues mail; only the publisher writes to the broker; only
  the enqueue seam touches the queue; only adapters import vendor SDKs.
- No module constructs its own HTTP client, and no source file contains a
  credential-shaped literal.
- Narrow, deliberate exemptions are **enumerated in one list**, and a test asserts
  the exemption list does not widen.

That last one matters more than it looks. Exemptions are how a spine dies — not by
being rejected, but by accumulating "just this one." A test on the length and
contents of the exemption list turns each new exemption into a deliberate,
reviewable act.

---

## 10. Deciding whether a new thing joins a spine

Not everything should be registered immediately. Speculative generality is its own
failure. Use this procedure, and **write the answer down either way**:

1. **Is there a real route to it?** If the thing cannot be fetched over the wire
   (local-only media, a build artifact), registering it as shareable implies an
   access-checked path that does not exist. Do not register it.
2. **Is there a real ask?** Not an imagined one. "Users might one day want to share
   templates" is not an ask.
3. **Is it top-level, or a child of something already registered?** A top-level
   thing joins cleanly today. A **child** collides with hierarchy resolution — if
   the resolver does not walk `parent_id`, a child marked unrestricted under a
   *restricted* parent becomes visible to the whole container: **wider than its own
   parent.** That is a leak, not an inconvenience.
4. **Does joining require editing the resolver?** If yes, either the spine's shape
   is wrong for this thing, or the thing is being forced. Stop and decide which —
   do not add a branch.
5. If the answer is "not yet," record the exclusion **with the trigger that will
   reverse it**:

> *"X is deliberately not a resource type. Its N owner checks stay as they are,
> because \<reason grounded in what exists today\>. When \<specific condition\>, X
> becomes a resource type and those checks convert like any other module — no new
> mechanism required."*

A written exclusion with a trigger is a decision. An unwritten one is an oversight
that the next agent will either cargo-cult or quietly contradict.

---

## 11. Migration — three modes, one loop

A codebase that has already drifted does not need a decision about *whether* to
build the spine. It needs a decision about **how much of the old code moves, and
when**. There are three modes. They share one loop (§11.2) and one set of rules
(§11.6), and they compose — most real projects start in **Mode A** and escalate a
joint to Mode B when it starts costing.

| | **A — Opportunistic** | **B — Phased by joint** | **C — Full** |
|---|---|---|---|
| **What moves** | Only code a bug or a change already forced you to open | Whole joints, chosen by the owner | Everything, joint by joint |
| **Budget** | None — the bug pays for it | Per joint, scheduled | A project |
| **Speed of convergence** | Tracks bug density | Predictable per joint | Fastest, most disruptive |
| **Best when** | Live product, steady delivery, drift is annoying but not blocking | One joint is causing incidents or blocking a feature | Pre-launch, pre-audit, small codebase, or drift is already blocking delivery |
| **Risk** | Long tail of old code; needs the debt register to stay honest | Half-migrated system for a while (bounded per joint) | Large diff, long freeze, review fatigue |

**In every mode, one rule never bends: new code is spine-only.** A new module, a
new endpoint, a new send path, a new integration goes on the spine from its first
line. Modes differ only in what happens to code that already exists. That single
rule is what makes even the slowest mode converge instead of merely holding.

### 11.1 Phase 0 — inventory. Do not skip; the count is the argument.

Count them and write the numbers down:

- tables matching `*_access`, `*_member`, `*_share`, `*_invite`, `*_permission`
- distinct role vocabularies (grep every role string literal)
- places that send mail, publish events, enqueue jobs, write files, enforce quota
- distinct HTTP clients, retry policies and timeout values
- vendor SDK imports outside an adapter directory
- model ids and prompt strings at call sites
- export/render paths, current and planned

Sequenced work is easy to argue about. *"Four sharing models, three role
vocabularies, nine timeout values, five export paths"* is not. The inventory is
also how the owner chooses in Mode B: the joint with the worst numbers is usually
the one to schedule first.

### 11.2 The loop — the same five steps for every joint, in every mode

1. **Build the spine beside the old code.** Registry, resolver, the one or two
   entry points. Nothing uses it yet.
2. **Backfill in one migration.** Every existing row of every module gets its
   registry row at once. Doing modules one at a time here means running two models
   in production for weeks.
3. **Convert one caller at a time.** Swap to the entry points; add the caller to
   the parametrized matrix test. The test is what turns "I forgot an endpoint" into
   a red build instead of a hole.
4. **Collapse the vocabulary.** Map every old role, status and error string onto
   the one enum. Expect one genuinely awkward case (a flag that was half a role);
   resolve it by *removing* the flag, not by adding a fifth role.
5. **Delete, and defend.** Remove the old path. Add the enforcement tests from §9,
   including the one asserting the deleted names are never recreated, and shrink
   the baseline (§13.2).

A joint is migrated when step 5 is done. Not when step 3 works.

### 11.3 Mode A — opportunistic: the bug pays for the migration

The default for a live product. The spine exists; old code stays until something
forces you to open it. Then:

> **Do not fix the bug where it lives. Move that path onto the spine, and fix it
> there.**

The mechanics, per bug:

1. Reproduce it with a **failing test written against the old behaviour** — you
   need to know what "still works" means before you move anything.
2. Move the smallest complete path onto the spine: one endpoint, one send path, one
   integration call. Complete means the old path is *gone*, not bypassed.
3. Fix the bug in the new location.
4. Both tests pass; the matrix test gains a row; the baseline (§13.2) shrinks in
   the same commit.

**Why this converges without a budget:** bug density is not uniform. The code that
breaks is the code that is complex, hot, or badly factored — which is exactly the
code that most needs to be on the spine. Migration effort ends up tracking risk on
its own, and it never needs separate approval, because the work was already
authorised as a bug fix.

**Features pay too — and are often the better lever.** Do not run the spine as its
own programme. Large joints that users never see stall when they are scheduled as
standalone projects, and they compete with the product for the same weeks. Instead,
choose features that *need* a piece of a joint, and build that piece for the
feature: the first email feature builds the dispatcher and the egress adapter it
sends through, and the other call sites move the next time someone touches them.
Leave the largest joints until a feature needs them.

Once the ratchet is on, this changes the arithmetic. New work can no longer make
the ratcheted areas worse, so every feature is either neutral or pays down a joint
— and a feature that pays for a joint is the easiest migration anyone will ever
approve.

**The escape hatch, which is mandatory.** Sometimes the move is far larger than the
bug: it touches two joints, or twelve files, or needs a data migration. Then fix in
place — and **write a debt entry** in the same commit:

```
DEBT  <joint>  <path>
  Fixed in place because: <specific, measured reason>
  Migrating this path requires: <what it would take>
  Escalate to a scheduled phase when: <trigger>
```

Without the escape hatch the rule is unusable and gets quietly ignored, which is
worse than not having it. With it, the debt register becomes the input to Mode B:
three entries against the same joint is the signal to schedule that joint.

**Two things Mode A is not:**

- It is not *"we will get to it."* A path either moves now or produces a debt entry
  with a trigger. Silence is not an option the process offers.
- It is not two live implementations of one joint. The old code is *untouched*, not
  *competing*. The moment a single flow runs partly on each, finish it or revert —
  a half-converted flow is the one state that is worse than either end.

### 11.4 Mode B — phased by joint, chosen by the owner

The owner picks joints and an order; each one is a bounded project with the loop in
§11.2. Choose with three inputs: the inventory numbers (§11.1), the debt register
(§11.3), and the dependency order below.

| Joint | Depends on | Effort | Payoff | Schedule it when |
|---|---|---|---|---|
| Errors & messages (§4.10) | — | S | M | Client handling is inconsistent; support cannot correlate |
| Observability (§4.17) | errors | S | H | You cannot answer "what happened in this request" |
| Config & flags (§4.12) | — | S | M | `getenv` at call sites; a flag with no owner |
| Identity & tenancy (§3.1–3.2) | — | M | H | Anything below it is blocked; a cross-tenant scare |
| **Authorization (§3)** | identity, tenancy | **L** | **H** | Two or more sharing models; "who can see this?" has no answer |
| Request edge (§4.1) | identity | M | H | Inline auth checks in handlers; an unguarded endpoint found |
| Database (§4.13) | tenancy | M | M | Migrations are scary; transactions span handlers |
| Jobs (§4.6) | identity, authz | M | M | Workers trust bare ids; a replay crossed a tenant |
| Events (§4.4) | jobs | M | M | Events published inside requests; a bespoke envelope per consumer |
| Notifications (§4.5) | authz, events | M | H | An audience was hand-built; a notification leaked a title |
| Tools & integrations (§4.2) | secrets, errors | M | H | A vendor SDK in a handler; an integration cannot be revoked |
| Secrets & egress (§4.3) | — | M | H | Second HTTP client; a user-supplied URL is fetched directly |
| Model layer (§4.14) | secrets, observability | M | H | Model ids at call sites; prompts inline; no cost attribution |
| Retrieval (§4.15) | authz, model layer | M | H | Post-filtered search; chunks outlive their resource |
| Data protection (§4.16) | classification, all egress seams | L | H | An audit, a regulated tenant, or a leak |
| Storage (§4.7) | authz | S | M | Public bucket paths; unscanned uploads |
| Quota & cost (§4.8) | identity | S | M | Limits in code; AI spend not attributable |
| Audit (§4.9) | identity, authz | S | H | "Who did this?" requires log archaeology |

Effort is relative to your codebase, not absolute. The order above is a
*dependency* order, not a priority order — within what is unblocked, take the joint
with the worst inventory number or the most debt entries.

Two sequencing rules that save a rewrite:

- **Identity and tenancy first, always.** Every other joint references a subject and
  a tenant. Migrating notifications before identity means building the audience
  resolver twice.
- **Migrate the joints before splitting into services** (§5.4). A spine extracted
  after a split has to be extracted twice, in two repositories, by two agents that
  cannot see each other.

### 11.5 Mode C — full migration

The §11.2 loop applied to every joint in dependency order, with two additions:

- **A freeze on new parallel paths** for the duration — enforced by the ratchet
  (§13.2), not by announcement.
- **A stated end condition:** baseline at zero, every module in the matrix test,
  every deleted name asserted absent. "Mostly migrated" is not a state; it is Mode A
  with a bad conscience.

Choose this when the codebase is small enough to hold in one head, when an audit or
a launch sets a real deadline, or when drift is already the reason features are
slow. Otherwise Mode A plus a few Mode B phases gets to the same place with a
fraction of the risk.

**Greenfield shortcut:** build a joint when the **second** instance appears — not
the first (speculative generality) and not the fourth (this section). The whole of
§11 is the cost of missing that moment.

### 11.6 Rules that hold in every mode

1. **New code is spine-only.** No exceptions, in any mode.
2. **The ratchet is on from day one** (§13.2). The baseline is a ceiling: it
   shrinks with every fix, has no stale entries, and gains an entry only
   deliberately, with the reason in the commit.
3. **A migration commit does four things at once**: convert the caller, delete the
   old path, add the matrix row, shrink the baseline. If you cannot delete, you have
   not migrated — you have forked.
4. **One flow never runs half on each side** for longer than a single commit.
5. **Fixing in place always produces a debt entry** with a reversal trigger (§10).
6. **Progress is measured, not asserted** (§8, rule 15). Three numbers, in the
   repository, updated by the tests themselves:
   - baseline violations remaining,
   - modules on the spine per joint (from the matrix test),
   - joints complete (step 5 done).

   A migration status document that is not generated from those numbers is
   decoration, and within a month it will be wrong.

---

## 12. When not to do this

Honesty about the limits is what makes the rest credible.

- **One module, one team, no second instance yet.** Build the feature. Write down
  the moment you will build the spine ("when the second shareable type appears").
- **A genuinely different consistency or latency requirement.** A real-time
  presence channel that cannot afford a database round trip per message is not
  drift; it is a different problem. Write down why it is exempt, put it on the
  enumerated exemption list, and give it its own single implementation.
- **A hard regulatory boundary** that forbids sharing infrastructure between
  domains. Two spines with a stated boundary beat one spine with a lie in it.
- **You cannot state the invariant in one sentence.** If the resolver needs a
  paragraph of conditions, you are compressing two concerns into one function.
  Split them and build two spines.

The failure mode on this side is real: a premature spine is an abstraction with one
caller, and it is *harder* to remove than four duplicated implementations, because
it looks principled.

---

## 13. Code layout — where the spines live on disk

Folder structure is not cosmetics here. An agent's default behaviour is to put new
code **next to the code it is editing**, so the layout decides what the path of
least resistance is. A structure where the correct move is also the shortest move
does more for uniformity than any amount of instruction.

Two properties matter, and only two:

1. **There is one obvious place for each concern, named after what it governs.**
2. **The dependency direction is one-way and testable.** Without that test, a
   folder structure is decoration.

### "Spine" is a pattern, not a place

Earlier drafts of this guide put every spine under one `spine/` directory. Real
use argued that down, and the reasoning is worth keeping.

A generic name attracts everything. `spine/`, `core/`, `common/`, `shared/` and
`platform/` carry no boundary in their name, so every agent's local optimum is to
put one more thing in them — and the result is a god-package: one directory, many
concerns. That is the failure this whole document exists to prevent, reproduced
one level up.

So each spine is a package **named after what it governs** — `access/` for
authorization, `gateway/` for every external system the product reaches,
`dispatch/` for notifications, `vault/` for configuration and credentials,
`ledger/` for audit. The word *spine* lives in the vocabulary — the docs, the
`CLAUDE.md`, the tests — not in the directory tree.

**The naming test:** if the name would still make sense after an unrelated concern
were added to it, it is too generic.

What makes spines findable is not a shared parent directory. It is the **spine
map** (§13.3).

### 13.1 A new project

```
src/
  identity/      subjects, authentication drivers, delegation      ┐
  tenancy/       tenant resolution, structural scoping             │  spines:
  access/        resource registry, resolver, require_read/_role   │  each named
  edge/          ActorContext, middleware pipeline, errors         │  for what it
  gateway/       tool catalogue, invoke(), outbound client, MCP    │  governs,
  vault/         config loader, secret store, credential resolver  │  each with a
  events/        envelope, outbox, publisher, consumer runtime     │  README that
  jobs/          enqueue seam, capability envelope, workers        │  states its
  dispatch/      notifications: dispatcher, templates, prefs       │  boundary
  models/        model routes, prompt registry, complete/embed     │
  retrieval/     index catalogue, retrieve()                       │
  ledger/        audit                                             ┘
                 …only the ones this product has — the rest wait for
                 their second instance

  modules/       the product. Thin. No module imports another module.
    projects/    model.* schema.* service.* routes.* mcp_tools.* module.* tests/
  adapters/      the ONLY place a vendor name appears
  transports/    http/ mcp/ cli/ webhooks/ worker/ — translate and delegate

docs/spines.md   the spine map (§13.3)
tests/uniformity/  layers, spine map, matrix, exhaustiveness
```

**The rules the layout encodes:**

- **Dependency direction is declared as a ranked layer map** — for example
  `transports → modules → spines → adapters and foundation`. A module may import
  its own rank or below, never above, and never sideways into another module. The
  composition root — the one file that wires the application together — is the
  single exemption, because wiring everything is its job. Function-local imports
  count: that is exactly where a circular dependency gets dodged, and therefore
  exactly where the coupling hides.
- **`modules/*` are uniform.** Every module has the same file set, and a test
  asserts it.
- **`module.*` is the registration file.** It declares the module's resource types,
  events, tools, notification types and error codes, so registries are *discovered*
  by walking `modules/` rather than hand-maintained.
- **Adapters implement interfaces owned by the spine that uses them.** Swapping a
  provider is one directory.
- **Every spine's README states its four parts and its boundary** — what it owns,
  and just as importantly, what it does **not** own.
- **A spine does not absorb other joints.** An existing, well-named spine is the
  most tempting place to put the next concern. Extending a spine beyond its stated
  boundary is how a clean layer becomes a god-package. A new joint gets its own
  domain-named spine.

**Frontend, same shape:** one API client, one error translator, one auth/session
context, one i18n catalogue, one design-token file, then feature folders that
import from those and never from each other.

**Services, if you have them (§5):** the same layout inside each service, with
spines supplied as shared internal packages. The uniformity suite runs **inside
every service**, because an agent's context is the repository it is in.

### 13.2 Introducing spines into an existing project

The instinct is to reorganise the folders first. Resist it: a large move commit
changes no behaviour, destroys `git blame`, collides with everything in flight, and
buys nothing that a test would not buy sooner.

Do it as a **ratchet**, in this order:

0. **Check that a gate exists.** Enforcement tests enforce nothing if nothing runs
   them before a deploy. If CI does not run the suite before every release, that is
   the first joint — call it *Spine 0* — and it comes before everything below.
1. **Look for spines that already exist, under any name** (§13.4). Adopt them. Do
   not create a parallel one — a new `spine/` directory beside an existing
   one-concern layer is the exact drift, performed by the tool meant to prevent it.
2. **Declare the layer map from what the repository actually has**, not from the
   ideal layout above. Rank the directories that exist today.
3. **Add the ratchet test, with today's violations recorded in a baseline file.**
   Three assertions, and the third is the one people miss:

   ```
   assert current ⊆ baseline              # no new violations
   assert len(current) <= len(baseline)   # the count never grows
   assert baseline ⊆ current              # no stale entries
   ```

   Without the stale check, a fixed violation stays listed, the headroom silently
   returns, and someone re-introduces it for free. **The baseline is a ceiling,
   not a target.** A violation that is genuinely correct may be added — with the
   reason in the commit message. Adding a line grants permission for drift; it
   should feel deliberate and be visible in review.
4. **Write the rules you rejected into the test's docstring.** If your best module
   would fail a proposed rule, the rule is wrong, not the module — a rule that
   fails the pattern you are trying to spread is a bad rule. Recording the
   rejection stops the next agent from re-proposing it.
5. **Write down what the test cannot see.** Import rules are blind to semantic
   duplication: two modules each defining their own `create_api_key` import nothing
   illegal. Name the gap. One working rule beats two half-built ones.
6. **Move one concern at a time** (§11): build beside, backfill, convert, then
   **delete the old path** and shrink the baseline in the same commit. Move files
   only when you are already editing them.
7. **Update `CLAUDE.md` (§14) the moment the first spine lands**, including a spine
   status: the current migration mode, the **known-absent joints** ("do not assume
   these exist"), and the **healthy joints** ("protect them, copy them").

The baseline file's line count is the best single progress number you have —
measured, not asserted (§8, rule 15). A baseline scoped to one rule (say, ad-hoc
HTTP clients) doubles as that migration's progress bar.

### 13.3 The spine map

One document — `docs/spines.md`, or a section of `CLAUDE.md` — with one row per
spine:

| Spine | Package | Joint(s) | Registry | Resolver | Seam | Enforcement | Owns | Does not own |
|---|---|---|---|---|---|---|---|---|

It is the registry of registries, and it gets the same treatment as every other
registry: **a test asserts that every package listed exists, every named registry
and resolver symbol resolves, and every enforcement test file exists.** A map that
can rot silently is a map that will.

Two habits that make a spine survive the session that designed it:

- **State the spine's migration roadmap in its package docstring**, in a fixed order
  — *"source adapters → vector stores → model clients → storage"*. The order is a
  decision; put it where the next agent reads it.
- **Ship call sites before sinks.** Route new call sites through the seam even while
  the seam still writes to a log line. The later migration is then a sink swap
  rather than a re-instrumentation of every endpoint written in the meantime.

### 13.4 Recognising a spine that already exists

Detect spines by **shape**, never by name. Signals, strongest first:

- A test that asserts **declarations or structure**, not only behaviour.
- A package whose docstring or README claims one concern and says it is the only
  place that concern is handled.
- A **registry**: an enum of types, a dict of builders, a table of kinds, a set of
  protocol declarations.
- A **resolver** with high fan-in — many modules call one function.
- A narrow **interface** (protocol, abstract class, interface) that adapters
  implement.
- Mentions in `CLAUDE.md`, `AGENTS.md` or architecture decision records.

Names are weak evidence either way. `core/` or `platform/` is often a junk drawer,
and a genuine spine may be called anything — `fabric`, `gateway`, `kernel`,
`chassis`, `access`.

When you find one:

1. **Map it to joints.** One existing spine often covers several joints partially —
   an egress layer might own authentication to external systems, transport and
   per-tenant telemetry, but not model routing or retrieval semantics.
2. **Read its boundary.** If none is written, write one with the owner before
   extending it.
3. **Extend within the boundary**, and adopt its vocabulary and naming in
   everything you write.
4. **Never fold an unrelated joint into it** because it exists and has a good name.
5. **Add it to the spine map.**

---

## 14. Drop this into `CLAUDE.md` / `AGENTS.md`

```md
## Architecture discipline (non-negotiable)

- **One layer per concern.** Authorization, identity, tenancy, tools, secrets,
  egress, events, notifications, jobs, storage, quota, audit, errors and config
  each have exactly ONE implementation. Before adding a table, a helper, a client
  or a send path, search for the existing one and extend it. If uniformity is
  genuinely impossible here, STOP and ask — do not add a parallel path.
- **Adding a module = register a type + one FK.** Never edit the access layer to
  add a module. If you think you must, the design has been bypassed; stop and ask.
- **Two entry points only**: `require_read` / `require_role`. Zero inline
  owner-equality checks in handlers. Read and write helpers stay separate.
- **One enum per vocabulary.** No role/kind/status/error/event/tool string
  literals at call sites.
- **One table per family, `kind` discriminator, per-kind typed schema.** Never a
  union of fields half the kinds ignore.
- **Deny 404, never 403.** Every trust boundary is crossed with a sealed
  capability (tenant + actor + scopes + expiry), never a bare id.
- **Every external surface is a transport** onto the same service functions —
  HTTP, MCP, CLI, webhooks, admin. Transports never query data directly.
- **Vendors live in adapters only.** No SDK import outside `adapters/<vendor>/`.
  No second HTTP client, retry policy or timeout value.
- **Agents, services and API keys are subjects with scopes**, not superusers.
  Delegated permission is the INTERSECTION of agent and principal.
- **Service boundaries never split a spine.** A sibling service is a
  tool-catalogue entry — never a hand-rolled HTTP call, never a shared DB
  connection. One envelope (tenant, actor, capability, correlation, deadline)
  rides every hop.
- **Agent-to-agent calls go through the tool catalogue**, inside a run with a
  parent budget and propagating cancellation. No point-to-point agent mesh.
- **Model, tool and agent output is tainted data, never instructions.**
  Destructive, financial or externally-visible tools refuse tainted input
  without a human decision.
- **Call sites name a capability, not a model** (`reasoning.default`). No model
  id, prompt string or provider SDK outside the model spine and its adapters.
- **Retrieval filters by the authz resolver BEFORE the search, never after**, and
  chunks follow their resource on delete, move and re-permission.
- **Spines are named after what they govern** (`access/`, `gateway/`,
  `dispatch/`) — never a generic `spine/`, `core/` or `common/`. Before creating
  one, read the spine map and look for an existing layer that already owns the
  concern under another name; extend it within its stated boundary, and never
  fold an unrelated concern into it. `modules/` stay thin and never import each
  other; `adapters/` are the only place a vendor name appears. The layer map is
  one-way and tested.
- **Configuration is read in one loader.** No env reads anywhere else; secrets are
  redacted by name marker; nothing secret in a public-prefixed variable; tenant
  credentials live encrypted in the database, never in the environment.
- **New code is spine-only**, always. **A bug in old code is a migration:** do
  not fix it where it lives — move that path onto the spine and fix it there,
  deleting the old path in the same commit. If the move is genuinely larger than
  the bug, fix in place and write a `DEBT` entry naming the joint, what the move
  would take, and the trigger that escalates it. Never silently patch old code.
- **Delete the old path** as part of the change, not as a follow-up.
- **Every rule above has an enforcement test.** If you add a concept, add it to
  the matrix test in the same commit — that is what makes a missing gate a red
  build.
- **Deliberate exclusions get written down with the trigger that reverses them.**
- **Verify against the code, never a doc's checkboxes.** Re-measure branch state,
  row counts and claims before deciding anything on them.
```

---

## 15. What this buys, concretely

Measured on the codebase this discipline was extracted from, after the
authorization spine landed:

- Four sharing models → one. Three role vocabularies → one.
- Guest access to a single resource shipped with **no** module-specific code.
- "Archived is read-only" became true everywhere at once, including in modules
  written afterwards, because it lives in `require_role` and nowhere else.
- A new module joined with a type string and one foreign key — no access-layer
  change, no new tests beyond one row in the matrix.
- A planned feature was correctly kept *out* of the registry, in writing, with its
  trigger — and a second was kept out for the opposite reason, each decision taking
  minutes because §10 made it procedural rather than a matter of taste.
- Five planned export paths collapsed to one before any of them was built. That is
  the cheapest kind of win: architecture applied to work that has not happened yet.

The compounding return is the last one. A spine is worth most against the code that
does not exist yet — which, in a codebase an agent writes, is most of it.

---

## 16. One page, if you remember nothing else

1. Agents drift fast, confidently, and with passing tests. Structure, not memory.
2. A spine = **registry → resolver → seam → enforcement test.** Same shape, every
   concern.
3. Adding a thing must never mean editing the resolver.
4. Subjects, not users. Agents and services have identity and scopes; delegation
   intersects.
5. Tenant is an isolation boundary; container is an organisational one. Never merge
   them.
6. Every surface is a transport. Every vendor lives in an adapter.
7. Cross a trust boundary with a sealed capability, never a bare id.
8. Derive notification audiences from the authorization resolver, or leak.
9. A service boundary is a transport boundary, never a policy boundary.
   Distribution adds no spines; it tests whether yours were real.
10. An agent is a subject, a transport and a service — all three, explicitly.
11. Permission never increases along a delegation chain, and taint never washes
    out by passing through a model.
12. A supervisor issuing typed briefs, not two agents chatting.
13. Generate the matrix test from the registry, or it will not catch the fifth
    module.
14. Write exclusions down with the trigger that reverses them.
15. Build the spine at the **second** instance — not the first, not the fourth.
16. Filter retrieval before the search, not after — and let chunks follow their
    resource.
17. Name each spine for what it governs, and find the ones that already exist
    before building one. The layout decides the path of least resistance; a tested
    layer map makes it architecture; a baseline is a ceiling, never a target.
18. New code is spine-only, always. A bug in old code is a migration, not a
    patch — the bug pays for the move.
19. Delete the old path, or you have two.

# The joints

One row per spine. Use this to answer two questions: *"which joint does this change
belong to?"* and *"which joint should we migrate next?"*

Every joint has the same four parts — **registry → resolver → seam → enforcement
test**. Full detail for each is in `spine-guide.md` at the section listed.

## Decision table

| Joint | § | Owns | Depends on | Effort | Payoff | Schedule it when |
|---|---|---|---|---|---|---|
| Errors & messages | 4.10 | Error code catalogue, protocol mapping, locale messages, one normaliser | — | S | M | Client handling is inconsistent; support cannot correlate a failure |
| Observability | 4.17 | One tracer, span naming, correlation/run ids, redaction before export | errors | S | H | You cannot answer "what happened in this request"; LLM traces don't join app traces |
| Config & flags | 4.12 | Typed config, startup validation, one flag service | — | S | M | `getenv` at call sites; a flag with no owner or removal date |
| Identity & subjects | 3.1 | Users, services, API keys, agents, delegation, scopes | — | M | H | Anything below is blocked; an agent or key needs its own identity |
| Tenancy | 3.2 | Isolation boundary, scoping by construction, residency, per-tenant keys | identity | M | H | A cross-tenant scare; tenant and workspace are the same column |
| **Authorization** | 3 | Resource registry, membership, resolver, `require_read`/`require_role`, `readable_ids` | identity, tenancy | **L** | **H** | Two or more sharing models; "who can see this?" has no single answer |
| Request edge | 4.1 | `ActorContext`, middleware order, auth methods as drivers, route scopes | identity | M | H | Inline auth checks in handlers; an unguarded endpoint found in review |
| Databases | 4.13 | Migration history, unit of work, repository base, replica policy | tenancy | M | M | Migrations are scary; transactions span handlers; shared DB across services |
| Jobs & schedules | 4.6 | Job catalogue, enqueue seam, sealed capability envelope, worker runtime | identity, authz | M | M | Workers fetch by bare id; a replay crossed a tenant; cron runs as "system" |
| Events | 4.4 | Event type registry, envelope, transactional outbox, consumer contract | jobs | M | M | Events published inside requests; a bespoke envelope per consumer |
| Notifications | 4.5 | Dispatcher, template catalogue, preferences, suppression, channels as drivers | authz, events | M | H | An audience was hand-built; a notification leaked a restricted title |
| Tools & integrations | 4.2 | Tool catalogue, `invoke()`, MCP connections, installs, webhooks, sync | secrets, errors | M | H | A vendor SDK in a handler; an integration cannot be revoked cleanly |
| Secrets & egress | 4.3 | Secret store, credential refs, one outbound client, egress allowlist | — | M | H | A second HTTP client; a user-supplied URL fetched directly (SSRF) |
| Model layer | 4.14 | Model routes, prompt registry, evals, cost attribution, failure taxonomy | secrets, observability | M | H | Model ids at call sites; prompts inline; no per-tenant data policy |
| Retrieval | 4.15 | Index catalogue, `retrieve()`, chunk lifecycle, embedding identity | authz, model layer | M | H | Post-filtered search; chunks outlive their resource; cross-tenant hits |
| Data protection (DLP) | 4.16 | Field classification, policy matrix, redaction at every egress | classification + all egress seams | L | H | An audit, a regulated tenant, or a leak |
| Storage & files | 4.7 | Blob registry, signed URLs, upload scanning, retention class | authz | S | M | Public bucket paths; unscanned uploads; files with their own permissions |
| Quota & cost | 4.8 | Limits as data, rate limiting, token/compute budgets, usage records | identity | S | M | Limits hardcoded; AI spend not attributable to a tenant |
| Audit | 4.9 | One append-only path written by the seams, allow *and* deny | identity, authz | S | H | "Who did this?" requires log archaeology |
| Distribution | 5 | Propagation envelope, contract registry, data ownership, sagas | all of the above | L | M | You are about to split into services — do the joints first |
| Agentic runtime | 6 | Run registry, budgets, cancellation, delegation chain, taint | identity, authz, tools, model layer | M | H | Agents call agents; costs are unbounded; no run is cancellable |

Effort is relative to your codebase, not absolute. The order is a **dependency**
order, not a priority order — within what is unblocked, take the joint with the
worst inventory number or the most debt entries.

## Sequencing rules

1. **Identity and tenancy first, always.** Every other joint references a subject
   and a tenant. Migrating notifications before identity means building the audience
   resolver twice.
2. **Cheap-and-high first among the unblocked.** Errors, observability and audit are
   small and pay for themselves immediately, and every later joint's migration is
   easier to debug once they exist.
3. **Authorization before anything that decides an audience** — notifications,
   retrieval, exports, agent context.
4. **Secrets and egress before tools and the model layer**, or you will move the
   credentials twice.
5. **All joints before splitting into services** (§5.4). A spine extracted after a
   split has to be extracted twice.

## Per-joint enforcement test (minimum)

| Joint | The test that must exist |
|---|---|
| Authorization | Matrix test generated from the registry: every type × role × operation |
| Tenancy | Every registered read route returns 404 for another tenant's id |
| Request edge | Every route in the framework's route table is authenticated or explicitly public |
| Tools | No vendor SDK import outside `adapters/`; every tool has schemas + side-effect class |
| Secrets & egress | No credential-shaped literal; no module builds its own HTTP client |
| Events | Every published type is registered with a schema; nothing publishes outside the seam |
| Notifications | A restricted resource notifies only its grantees; no mail SDK outside the driver |
| Jobs | No queue call outside the enqueue seam; every worker asserts an envelope |
| Model layer | Evals per prompt id run in CI; no model id outside the route catalogue |
| Retrieval | Two tenants, one query, zero cross-tenant hits; deleted resource ⇒ no chunks |
| DLP | Canary: synthetic PII and a fake credential never appear in any egress |
| Errors | Every code has a message in every locale, and every message maps to a code |
| Layout | Import direction one-way; baseline of violations can only shrink |

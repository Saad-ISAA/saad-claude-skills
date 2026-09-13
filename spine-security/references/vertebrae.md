# The security vertebrae

The security spine is not a second architecture. It is a set of **controls**, and
the one rule is the same rule as the main spine: **each control is enforced at
exactly one chokepoint, and a test fails when it is not.**

A control scattered across forty handlers is not a control. It is forty chances
to forget.

Almost every chokepoint is a **joint of the main spine** — the request edge, the
authorization seam, the egress client, the enqueue seam, the tool `invoke()`. That
has a consequence worth stating first:

> **You cannot centralise a control that has no chokepoint to live in.** If an
> audit finds three rate limiters, the fix is not "pick one" — it is "build the
> request edge, then put the one limiter there." Many security findings are really
> missing architecture joints, and the report should say so.

Each vertebra below lists:

- **Guards against** — the failure class.
- **Chokepoint** — where the control must live, and which main-spine joint that is.
- **Controls** — checkable, with ids you can put in a control register.
- **Drift signals** — what an audit looks for.
- **Enforcement** — the test that makes the control real.
- **Maps to** — framework categories *by name*. IDs are given where stable; always
  verify against the edition your organisation uses.

## Status vocabulary for every control

One vocabulary, used in the register and in every report:

| Status | Meaning |
|---|---|
| `enforced` | One chokepoint **and** a test that fails when it is bypassed. Nothing less counts. |
| `centralised` | One chokepoint, no test. Will decay. |
| `scattered` | Implemented in several places, possibly inconsistently. |
| `absent` | Not implemented. |
| `exempt` | Deliberately not applied — with the reason and the trigger that reverses it. |
| `n/a` | The system has no such surface. Say why in one line. |

Severity is **exploitability × impact**, stated per finding with evidence
(`file:line`). A finding without evidence is a hypothesis, and goes in a separate
section of the report labelled as such.

## Lessons that recur in real incidents

1. **"Protected by the network" is a claim, not a control.** It is usually true on
   the day the diagram is drawn and false the day someone adds a tunnel or an
   ingress rule. Check reachability from outside (DEPLOY-10).
2. **The client sending a token proves nothing.** A frontend can attach
   `Authorization: Bearer` to every request while the backend never checks it —
   everything works, nothing is protected. Only the route-authentication coverage
   test proves the server enforces it (AUTHN-1).
3. **The most dangerous endpoint is the helpful one.** A "resolve config" route that
   hands an internal service its decrypted provider keys is one missing dependency
   away from handing them to anyone (SECRETS-11).
4. **Write access to a destination is read access to its credential.** If anyone
   can change where an integration sends its requests, they can receive its
   credential (EGRESS-8).
5. **A prompt is not a permission.** "The agent is instructed to stay within the
   current project" describes behaviour, not a boundary. If the tool would succeed
   with another id, the boundary does not exist (AI-11).
6. **Auto-escaping protects one sink.** A stored payload waits in the database for
   the admin console, the export, the email or the PDF that renders it raw — often
   a surface built long after the field was (OUTPUT-8).
7. **Query-anything is exfiltration with extra steps.** An admin raw-SQL endpoint
   and an agent tool that can query any model are the same primitive: one stolen
   session or one injected document yields the whole dataset (DEPLOY-12, AI-12).
8. **Client-side validation is not validation.** The API is callable without the
   client (INPUT-10, AUTHN-11).
9. **A shared demo credential is a public credential**, and whatever the demo
   account can see is effectively published (DEPLOY-13).

---

## V1 — Authentication (`AUTHN`)

**Guards against:** credential stuffing, weak password storage, token forgery,
side-door identities.
**Chokepoint:** the request edge — authentication methods are drivers that all
produce one actor context (main spine §4.1).

| Id | Control |
|---|---|
| AUTHN-1 | One authentication pipeline. Session, bearer, API key, OAuth, mTLS and webhook signatures are drivers behind one interface producing the same actor context. |
| AUTHN-2 | Passwords hashed with an adaptive, preferably memory-hard KDF (argon2id, scrypt, bcrypt) at a declared cost, in one place. Rehash on login when parameters change. Never a fast hash. |
| AUTHN-3 | Test suites may lower the KDF cost for speed — **only** in test configuration, with a test asserting production cost is at or above the floor. |
| AUTHN-4 | Every secret comparison is constant-time: tokens, API keys, signatures, PKCE verifiers, OTPs. |
| AUTHN-5 | API keys are stored hashed (lookup prefix + hash), shown once, scoped, expiring, revocable, and attributed to a subject. |
| AUTHN-6 | Step-up or MFA for administrative and destructive operations. |
| AUTHN-7 | Login throttled per account **and** per source (V7), with generic failure messages (V20). |
| AUTHN-8 | OAuth/OIDC uses authorization code + PKCE; `state` and `nonce` validated; exact redirect-URI match; ID token signature, `iss`, `aud`, `exp` verified. No implicit flow. |
| AUTHN-9 | Break-glass and super-admin identities are subjects in the same identity model — never a username and password read from an environment variable and checked in a separate code path. |
| AUTHN-10 | Service-to-service calls authenticate with a service credential — never "it comes from inside the network". Enforcing it on a route that already has callers is rolled out in two steps to avoid an outage: callers start sending the credential, unauthenticated hits are logged for a period, then the receiver starts requiring it. |
| AUTHN-11 | Credential policy is enforced **on the server**: a minimum length of at least 8 characters (longer where the password is the only factor), long passphrases accepted, a check against known-breached passwords, and no arbitrary composition rules or forced periodic rotation — in line with NIST SP 800-63B. A policy enforced only in the client does not exist. |

**Drift signals:** more than one token-decode site; `decode(` without an explicit
algorithm list; `verify=False` / `verify_signature: False`; `==` on token or
signature strings; `md5`/`sha1`/`sha256` near "password"; Basic auth credentials
from env.
**Enforcement:** route-coverage test (every route authenticated or on an
enumerated public list); tokens with `alg: none`, a wrong algorithm, wrong
audience, or expired are rejected; production KDF cost ≥ floor.
**Maps to:** OWASP Top 10 (2021) A07 Identification and Authentication Failures ·
OWASP API Security Top 10 (2023) API2 Broken Authentication.

## V2 — Sessions and tokens (`SESS`)

**Guards against:** session fixation, token replay, unrevocable access.
**Chokepoint:** the identity joint's token service — one issuer, one verifier.

| Id | Control |
|---|---|
| SESS-1 | Short-lived access tokens; refresh tokens rotate on every use, and **reuse of a rotated refresh token revokes the whole token family**. |
| SESS-2 | JWT verification uses an explicit algorithm allowlist and requires `aud`, `iss`, `exp`; never trusts the header's `alg`. Asymmetric keys with `kid` when more than one service verifies. |
| SESS-3 | Revocation is a tested path with a stated propagation bound in seconds (denylist, or a per-subject token version). |
| SESS-4 | Session cookies are `HttpOnly`, `Secure`, `SameSite`, `__Host-` prefixed where possible, and **rotated on login and privilege change**. |
| SESS-5 | Logout invalidates server-side state, not only the client copy. |
| SESS-6 | Tokens never travel in URLs, except single-use, short-lived, purpose-bound links. |
| SESS-7 | One-time tokens (reset, invite, magic link, OAuth code, email verification) are stored hashed, expiring, purpose-bound, and **consumed atomically** — a get-and-delete, not a read followed by a delete. |

**Drift signals:** long-lived access tokens; refresh tokens that never rotate;
one-time tokens looked up then deleted in two statements; tokens in query strings.
**Enforcement:** a replayed refresh token fails and revokes its family; a one-time
token consumed concurrently succeeds exactly once; cookie flags asserted on the
login response; a revoked token is rejected within the stated bound.
**Maps to:** A07 · API2.

## V3 — Authorization and tenant isolation (`AUTHZ`)

**Guards against:** reading or changing someone else's data — the most common
serious API vulnerability class.
**Chokepoint:** the authorization seam and structural tenant scoping (main spine
§3).

| Id | Control |
|---|---|
| AUTHZ-1 | Object access decided only by the authorization seam. Zero inline ownership predicates in handlers. |
| AUTHZ-2 | Both object-level (may this subject touch *this row*?) and function-level (may this subject call *this kind of operation*?) checks exist, and neither substitutes for the other. |
| AUTHZ-3 | Property-level: write schemas reject unknown fields, and `tenant_id`, `owner`, `role`, `status`, prices and quotas are never accepted from the client (mass assignment). Response schemas allowlist output fields (excessive data exposure). |
| AUTHZ-4 | Invisible resources are denied as 404, and "does not exist" and "not yours" are indistinguishable — same status, same body, same timing — so identifiers cannot be enumerated. |
| AUTHZ-5 | Tenant scope enforced by construction (row-level security, a session variable, or a base repository), not by a remembered `WHERE`. |
| AUTHZ-6 | List endpoints filter inside the query; never fetch-then-filter. |
| AUTHZ-7 | Impersonation and support access are audited with both identities and cannot exceed the operator's own rights. |
| AUTHZ-8 | The tenant comes from the authenticated context — never from the URL, query or body. Tenant-scoped identifiers are non-enumerable as defence in depth: sequential ids turn one missing check into a sweep of every tenant in a loop. Opaque ids are never the control itself. |
| AUTHZ-9 | A subject can never grant a role above their own. Invitations, role changes and share links carry at most the granting subject's privilege — an invitation to an existing user is never an automatic grant of whatever role the request names. |

**Drift signals:** `owner_id ==` / `user_id ==` in handlers; request models
without `extra = forbid` (or equivalent); response models returning ORM objects
wholesale; list endpoints that filter in application code.
**Enforcement:** the matrix test generated from the resource registry; another
tenant's id returns 404 on every registered route; posting `tenant_id`/`role` in a
body is rejected or ignored, asserted.
**Maps to:** A01 Broken Access Control · API1 BOLA · API3 Broken Object Property
Level Authorization · API5 BFLA.

## V4 — Credentials, secrets and environment (`SECRETS`)

**Guards against:** credential exposure through repositories, logs, bundles,
images, tracebacks and screenshots.
**Chokepoint:** one typed configuration loader, one secret store, one credential
resolver for tenant credentials. Full treatment: `credentials-and-env.md`.

| Id | Control |
|---|---|
| SECRETS-1 | One typed configuration object, validated at startup; no `getenv` / `process.env` outside the loader. |
| SECRETS-2 | Secrets are redacted in `repr`, `str`, serialisation, logs and tracebacks **by marker or type** (`PASSWORD`, `SECRET`, `KEY`, `TOKEN`, a `SecretStr` type) — never by a list of known field names. |
| SECRETS-3 | No `.env` file with real values is committed, now or in history. `.env.example` is the declared registry and matches the configuration schema exactly, in both directions. |
| SECRETS-4 | No secret in a client bundle. Variables with a public prefix (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, `EXPO_PUBLIC_`, `PUBLIC_`) never hold secrets. |
| SECRETS-5 | Environments are separated: a local or CI environment never holds production credentials or points at production data. |
| SECRETS-6 | Tenant credentials (their API keys, OAuth tokens) are data, not environment: encrypted in the database with a managed, rotatable key, decrypted only in the credential resolver. |
| SECRETS-7 | Every platform credential has an owner, a scope, and a rotation procedure that has actually been run. |
| SECRETS-8 | Secret scanning in pre-commit and CI, plus a one-time full-history scan. |
| SECRETS-9 | Secrets are not baked into images, build arguments, compose files, or echoed in CI logs. |
| SECRETS-10 | Startup refuses weak or default secrets (`changeme`, short signing keys, example values). |
| SECRETS-11 | **No endpoint returns a decrypted credential.** A service that needs a credential fetches it with its own identity from the secret store, or asks the owning service to make the call so the credential never crosses the wire. If a credential-resolving endpoint is unavoidable, it is service-authenticated, unroutable from any public edge, audited per call and never cached — and a test proves anonymous and user tokens cannot reach it. |
| SECRETS-12 | **Credential fields are write-only, and objects hold references, not values.** A credential is accepted, validated, stored in the vault and replaced by a reference; no response echoes it, and request logging redacts the bodies of endpoints that accept one. Credential-bearing objects never return a free-form `config` blob — a typed, per-kind response schema cannot return a field it does not declare, whereas redacting by key name at response time is only a second line of defence. Third-party credentials are collected by the integration install flow, not as extra fields on a profile update. |

**Drift signals:** `getenv` counts across files; committed `.env*` other than
examples; secrets in `docker-compose*.yml`; public-prefixed names containing
`SECRET`/`KEY`/`TOKEN`; config objects printed or logged; **route handlers that call
`decrypt(` and return the result**.
**Enforcement:** env-parity test (code ↔ schema ↔ example ↔ deployment); a `repr`
redaction test that plants a marker value; a built-bundle scan; secret scanning in
CI; startup refuses defaults.
**Maps to:** A02 Cryptographic Failures · A05 Security Misconfiguration · OWASP
Top 10 for LLM Applications (2025) LLM02 Sensitive Information Disclosure.

## V5 — Input validation and injection (`INPUT`)

**Guards against:** SQL, command, template, path and deserialisation injection.
**Chokepoint:** schema validation at the request edge; parameterised data access
in the database joint; no dangerous sinks anywhere.

| Id | Control |
|---|---|
| INPUT-1 | Every input validated by a schema at the edge: types, lengths, ranges, enums; unknown fields rejected. |
| INPUT-2 | Parameterised queries only. Raw SQL exists only with bound parameters; no string-built queries. |
| INPUT-3 | No shell invocation with user-influenced input (`shell=True`, `os.system`, backticks, `exec` with interpolation). Argument arrays only. |
| INPUT-4 | No unsafe deserialisation of untrusted data: `pickle`, unsafe YAML loaders, `eval`, `new Function`, native object serialisation. |
| INPUT-5 | User input is never joined into a filesystem path; paths are resolved and verified to stay under their root. |
| INPUT-6 | User content is never used *as* a template. |
| INPUT-7 | XML parsers have external entities disabled. |
| INPUT-8 | User-supplied regular expressions are bounded or disallowed (ReDoS). |
| INPUT-9 | Body size, page size and query complexity limits enforced at the edge. |
| INPUT-10 | Every client-side constraint is re-enforced on the server — lengths, formats, enums, password policy, file types, page sizes. Client-side validation is user experience, not a control: the API is callable without the client. |

**Drift signals:** f-strings or concatenation inside `execute(`; `shell=True`;
`pickle.load`; `yaml.load(` without a safe loader; `eval(`; `os.path.join` with
request data; `render_template_string` with user content.
**Enforcement:** a structural ban-list test for dangerous sinks with an enumerated,
non-widening exemption list; schema-negative tests generated from the API
description.
**Maps to:** A03 Injection · A08 Software and Data Integrity Failures
(deserialisation).

## V6 — Output, errors and information disclosure (`OUTPUT`)

**Guards against:** stack traces, internal identifiers, XSS, account enumeration.
**Chokepoint:** the one error normaliser and the response schemas (main spine
§4.10).

| Id | Control |
|---|---|
| OUTPUT-1 | One error normaliser. Production responses never contain stack traces, SQL, file paths, internal hostnames or raw upstream error bodies — only a code, a safe message and a correlation id. |
| OUTPUT-2 | Output encoding is the template engine's job. Raw-HTML sinks (`dangerouslySetInnerHTML`, `v-html`, `|safe`, `innerHTML`) are enumerated and sanitised, and the list cannot widen silently. |
| OUTPUT-3 | Response schemas allowlist fields (see AUTHZ-3). |
| OUTPUT-4 | Existence-sensitive flows (login, signup, password reset, invite) respond identically for existing and non-existing accounts — message, status **and timing**. |
| OUTPUT-5 | Framework and server version banners suppressed. |
| OUTPUT-6 | Unexpected exceptions fail **closed**: a crash inside an authorization or validation path denies, never allows. |
| OUTPUT-7 | Responses never carry internal topology: container hostnames, internal ports, private addresses, internal service URLs, bucket paths or infrastructure identifiers. Clients receive public identifiers; the mapping to internal addresses stays server-side. An internal URL in a response is an attacker's map and a ready-made SSRF target list. |
| OUTPUT-8 | **Every rendering sink encodes for its context — not only the main frontend.** A framework that auto-escapes protects one sink. Admin consoles, email templates, PDF and document renderers, notification previews, mobile clients and spreadsheet exports each encode separately. Spreadsheet exports neutralise formula injection: cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed. |
| OUTPUT-9 | **Validate on input, encode on output, sanitise only rich text.** Plain-text fields — names, titles, comments — are stored as text and encoded at each sink; rewriting them on input corrupts data and still misses sinks. Fields genuinely meant to hold markup are sanitised on the server with an allowlist sanitiser. |

**Drift signals:** `detail=str(e)`; exception handlers returning `traceback`;
raw-HTML sinks; different messages for "no such user" and "wrong password"; CSV/XLSX
writers with no formula guard; admin or email templates marking fields safe;
`http://service-name:port` values in response models.
**Enforcement:** force an exception in a test route and assert the body contains no
traceback and does contain a correlation id; the raw-HTML sink list does not grow.
**Maps to:** A03 (XSS) · A05 · A07.

## V7 — Rate limiting, abuse and resource consumption (`ABUSE`)

**Guards against:** brute force, scraping, cost exhaustion, denial of service,
automated abuse of business flows.
**Chokepoint:** one limiter in the request edge, plus quota and budgets in the
quota joint (main spine §4.8).

| Id | Control |
|---|---|
| ABUSE-1 | **One** limiter implementation, backed by a shared store. An in-process limiter multiplies every limit by the number of workers — a classic silent bypass. |
| ABUSE-2 | Limits are declared as data per route *class* (public, authenticated, sensitive, expensive), keyed by subject, tenant and source as appropriate — not literals in per-route decorators. |
| ABUSE-3 | Every route belongs to a limit class, and a test derived from the route table proves it. Unauthenticated routes get the strictest class. |
| ABUSE-4 | Sensitive flows — login, OTP, password reset, signup, invite, email send, export — have per-account **and** per-source limits with backoff. |
| ABUSE-5 | Consumption caps: body size, upload size, page size, query depth/complexity, request timeouts, per-tenant concurrency. |
| ABUSE-6 | AI spend caps per tenant, run and agent: max tokens, max tool calls, wall-clock, cost. |
| ABUSE-7 | Client address derived only through an explicit trusted-proxy list. Trusting `X-Forwarded-For` from any peer lets an attacker pick their own rate-limit key. |
| ABUSE-8 | Limited requests return 429 with `Retry-After` and emit a security event. |

**Drift signals:** several limiter libraries or decorators; limits as inline
literals; `X-Forwarded-For` read directly; routes with no limit; memory-backed
limiter storage in production configuration.
**Enforcement:** route-table coverage test for limit classes; production
configuration asserts a shared limiter store; a request with a spoofed forwarding
header from an untrusted peer is keyed on the real peer.
**Maps to:** API4 Unrestricted Resource Consumption · API6 Unrestricted Access to
Sensitive Business Flows · LLM10 Unbounded Consumption.

## V8 — Edge middleware: headers, CORS, CSRF, cookies, transport (`EDGE`)

**Guards against:** clickjacking, cross-origin data theft, CSRF, downgrade, host
header poisoning.
**Chokepoint:** the declared middleware pipeline (main spine §4.1).

| Id | Control |
|---|---|
| EDGE-1 | One middleware pipeline, declared once, in a fixed order — and security headers are applied **after** the error handler, so error responses carry them too. |
| EDGE-2 | Security headers set in one place: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `frame-ancestors` / `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. |
| EDGE-3 | CORS configured in one place with an explicit origin allowlist. Never `*` together with credentials; echo an Origin back **only when it is on the allowlist** and send `Vary: Origin` — never reflect an arbitrary Origin. Methods and request headers are allowlisted too. |
| EDGE-4 | CSRF protection for cookie-authenticated state-changing requests (`SameSite` plus a token or strict origin check). |
| EDGE-5 | TLS on every hop, including internal ones; HTTP redirects to HTTPS. |
| EDGE-6 | Allowed-hosts validation. Links in emails are built from configured base URLs, never from the request `Host` header (password-reset poisoning). |
| EDGE-7 | Trusted proxies declared explicitly (see ABUSE-7). |
| EDGE-8 | A request id is assigned at the edge and returned on every response. |

**Drift signals:** more than one CORS configuration; `allow_origins=["*"]` with
`allow_credentials=True`; headers set per route; absolute URLs built from
`request.host`.
**Enforcement:** header presence asserted on a success, a 404 **and** a 500
response; a preflight from a disallowed origin is rejected; configuration
validation makes wildcard-plus-credentials impossible to boot.
**Maps to:** A05 Security Misconfiguration · API8 Security Misconfiguration.

## V9 — Cryptography and key management (`CRYPTO`)

**Guards against:** weak algorithms, predictable tokens, unrotatable keys.
**Chokepoint:** one crypto module; keys from the secret store.

| Id | Control |
|---|---|
| CRYPTO-1 | One crypto module. No algorithm, mode or key-length choices at call sites. |
| CRYPTO-2 | Vetted libraries and modern primitives: AEAD ciphers, modern signatures, HMAC. No ECB, no MD5 or SHA-1 for security purposes, no custom constructions. |
| CRYPTO-3 | Security randomness only from a CSPRNG (`secrets`, `crypto.randomBytes`, `crypto.getRandomValues`) — never a general-purpose `random`. |
| CRYPTO-4 | Keys are versioned with key ids, and rotation is supported by design (a keyring that decrypts old ciphertext and encrypts with the newest key). |
| CRYPTO-5 | Sensitive columns and blobs encrypted at rest through the one module; per-tenant envelope keys where isolation requires. |
| CRYPTO-6 | Signatures are verified before a payload is parsed or used. |

**Drift signals:** `hashlib.md5`/`sha1` outside checksums; `random.` near
"token"/"code"; keys as literals; more than one encryption helper.
**Enforcement:** ban-list test; a rotation test that encrypts with key A, rotates to
B, and still decrypts.
**Maps to:** A02 Cryptographic Failures.

## V10 — Egress and SSRF (`EGRESS`)

**Guards against:** server-side request forgery, cloud metadata theft, internal
network pivoting.
**Chokepoint:** the one outbound client (main spine §4.3).

| Id | Control |
|---|---|
| EGRESS-1 | One outbound client. No module constructs its own. |
| EGRESS-2 | Destinations checked **after DNS resolution** against an allowlist; loopback, private, link-local and cloud-metadata ranges refused; the connection is pinned to the checked address (DNS rebinding). |
| EGRESS-3 | Redirects capped and every hop re-validated. |
| EGRESS-4 | Timeouts and response-size limits on every call. |
| EGRESS-5 | Every user-supplied URL — webhooks, imports, avatars, link previews, an agent's "fetch this page" tool — goes through the gate or not at all. |
| EGRESS-6 | TLS verification is never disabled. |
| EGRESS-7 | Credentials are attached by the client from the credential resolver, never by callers. |
| EGRESS-8 | A stored credential is bound to its destination. Changing an integration's base URL, webhook target or redirect is a privileged, audited operation that re-validates the destination and requires the credential to be re-authorised. Otherwise anyone who can edit the URL can point it at their own server and receive the credential on the next call. |

**Drift signals:** HTTP client constructors across many files; `verify=False`;
`follow_redirects=True` on user URLs; fetches of request-supplied URLs.
**Enforcement:** an SSRF suite with a **stub resolver and a local redirect server**
(never live DNS) — loopback in every encoding (`127.0.0.1`, `127.1`, `0`,
`0x7f000001`, `[::1]`, `[::ffff:127.0.0.1]`), link-local `169.254.169.254` and
`metadata.google.internal`, private and CGNAT ranges (`10.x`, `192.168.x`,
`100.64.x`, `[fd00::1]`), a redirect hop to an internal address, and a DNS-rebinding
case (first resolution public, second private) are all refused; a structural test
permits client construction only inside the gate.
**Maps to:** A10 Server-Side Request Forgery · API7 SSRF · API10 Unsafe Consumption
of APIs.

## V11 — Files and uploads (`FILES`)

**Guards against:** stored XSS via uploads, malware distribution, path traversal,
decompression bombs, public data exposure.
**Chokepoint:** the storage joint (main spine §4.7).

| Id | Control |
|---|---|
| FILES-1 | Upload size limits at the edge; content type determined server-side, not trusted from the client; extension allowlist. |
| FILES-2 | Stored under opaque keys; user filenames sanitised before use in `Content-Disposition`. |
| FILES-3 | Scanned before becoming readable. |
| FILES-4 | Downloads via short-lived signed URLs minted after an authorization check. No public buckets. |
| FILES-5 | Untrusted types (HTML, SVG, XML) served as attachments with `nosniff`, from a separate origin if served inline at all. |
| FILES-6 | Archive extraction guards against path traversal ("zip slip") and decompression bombs; document and image parsers are resource-limited. |
| FILES-7 | Bucket policy blocks public access; tenant prefixes; least-privilege credentials. |

**Enforcement:** uploading HTML/SVG yields an attachment response; a traversal entry
in an archive is rejected; a signed URL expires.
**Maps to:** A01 · A05 · A08.

## V12 — Webhooks and inbound integrations (`HOOKS`)

**Guards against:** forged events, replays, slow-loris on the receiver.
**Chokepoint:** one inbound receiver and one outbound sender (main spine §4.2).

| Id | Control |
|---|---|
| HOOKS-1 | Signatures verified over the **raw body**, with a constant-time compare, before any parsing. |
| HOOKS-2 | Timestamp window enforced; replays rejected by provider event id. |
| HOOKS-3 | Acknowledge fast, enqueue the work, translate the payload into internal events at the boundary. |
| HOOKS-4 | Outbound webhooks signed with per-endpoint secrets; destinations pass the egress gate. |
| HOOKS-5 | Webhook secrets are per integration installation, rotatable, never shared across tenants. |

**Enforcement:** unsigned, badly signed, stale and replayed events are each
rejected, asserted.
**Maps to:** A08 · API10.

## V13 — Queues and background jobs (`QUEUE`)

**Guards against:** the queue as an unauthenticated back door; tenant confusion on
replay; code execution via serialisation.
**Chokepoint:** the enqueue seam and worker runtime (main spine §4.6).

| Id | Control |
|---|---|
| QUEUE-1 | Jobs carry a sealed capability envelope — tenant, actor, scopes, expiry — validated by the worker. Never a bare id. |
| QUEUE-2 | The broker requires authentication and TLS and is not reachable from the public network. |
| QUEUE-3 | Result backends do not hold secrets or sensitive payloads, and results expire. |
| QUEUE-4 | Task payloads are serialised as JSON (or another data-only format) — never `pickle`. |
| QUEUE-5 | Jobs are enqueued through an outbox, never inside an open transaction. |
| QUEUE-6 | Dead-letter contents are sensitive data: access-controlled, with retention. |
| QUEUE-7 | Scheduled jobs run as named service subjects with minimal scopes. |
| QUEUE-8 | Task dashboards and broker admin UIs are never public. |

**Drift signals:** task signatures taking only ids; `pickle` in accept content;
broker URLs without credentials; `.delay(` sites outside the seam.
**Enforcement:** a worker rejects an envelope for another tenant and an expired
one; configuration test asserts a data-only serialiser and an authenticated broker
in production.
**Maps to:** A01 · A08.

## V14 — Data protection and privacy (`DATA`)

**Guards against:** leakage of regulated or sensitive data through any egress.
**Chokepoint:** field classification in the schema and redaction at every egress
seam (main spine §4.16).

| Id | Control |
|---|---|
| DATA-1 | Field-level classification lives in the schema; one policy matrix decides per destination. |
| DATA-2 | Minimisation and retention per data class; deletion propagates to replicas, caches, search and vector indexes. |
| DATA-3 | Logs and traces are redacted in the formatter and tracer, not by callers. |
| DATA-4 | Backups encrypted, access-controlled, and a restore has actually been performed. |
| DATA-5 | Subject export and deletion run through one path. |
| DATA-6 | Non-production environments use synthetic or masked data. |
| DATA-7 | A canary test: planted synthetic PII and a fake credential never appear in logs, traces, emails, exports, webhooks or model payloads. |

**Maps to:** A02 · LLM02 Sensitive Information Disclosure.

## V15 — AI and agent security (`AI`)

**Guards against:** prompt injection, excessive agency, unsafe output handling,
retrieval leaks, runaway cost.
**Chokepoint:** the model seam, the tool `invoke()`, the run registry and retrieval
(main spine §4.14, §4.15, §6).

| Id | Control |
|---|---|
| AI-1 | Content from models, tools, retrieved documents and other agents is data, never instructions. Provenance travels with it as taint. |
| AI-2 | Tools with destructive, financial or externally visible side effects require a human decision when their input is tainted — enforced in `invoke()`, not in a prompt. |
| AI-3 | Agent permission is the intersection with its principal's, with bounded delegation depth and budget. |
| AI-4 | Model output is untrusted: never executed, never rendered as raw HTML, never used in SQL, shell or paths without validation; structured output is schema-validated. |
| AI-5 | System prompts and tool definitions contain no secrets and no authorization logic. Assume both leak — a model will describe its tools and their parameters when asked — so design as if the catalogue were public. Prompts and agent configuration are served only to authorised administrators; list endpoints never include them. |
| AI-6 | Retrieval is filtered by the authorization resolver **before** the search; indexes are tenant-scoped; ingestion records provenance. |
| AI-7 | Token, tool-call, wall-clock and cost budgets per tenant and per run. |
| AI-8 | Prompt and response logging is redacted; provider retention, residency and training policy enforced per tenant in the router. |
| AI-9 | Model, prompt and embedding versions are pinned and recorded on every call. |
| AI-10 | An adversarial eval set (injection in documents, tool results and user input) runs in CI against every agent that holds a side-effecting tool. |
| AI-11 | **A prompt is not a permission.** A restriction that lives in instructions ("only use this tool for the current project") restricts nothing if the tool would succeed when called. Tools are bound server-side to the resource in context, and every call is authorised against the principal through the same seam as the API — which is exactly what stops a model being used as a pivot into someone else's data. |
| AI-12 | **No query-anything tools.** A tool that accepts any table, model, collection or filter expression — or raw SQL — is an exfiltration primitive for anyone who can steer the model, including through injected content. Tools take narrow, typed parameters over a server-side allowlist of entities and fields, and their results pass through the caller's authorization. |

**Maps to:** OWASP Top 10 for LLM Applications (2025): LLM01 Prompt Injection ·
LLM02 Sensitive Information Disclosure · LLM03 Supply Chain · LLM04 Data and Model
Poisoning · LLM05 Improper Output Handling · LLM06 Excessive Agency · LLM07 System
Prompt Leakage · LLM08 Vector and Embedding Weaknesses · LLM10 Unbounded
Consumption.

## V16 — MCP and tool surfaces (`MCP`)

**Guards against:** token passthrough, confused deputies, tool poisoning, silent
tool redefinition.
**Chokepoint:** the tool catalogue and MCP connection manager (main spine §4.2).

| Id | Control |
|---|---|
| MCP-1 | An exposed HTTP MCP server is an OAuth 2.1 **resource server**: it publishes Protected Resource Metadata (RFC 9728), answers 401 with `WWW-Authenticate`, and accepts only tokens whose audience/resource (RFC 8707) is this server. Tokens minted for another resource are rejected, and a token is **never passed through** to an upstream API. PKCE is enforced between the client and the authorization server. |
| MCP-2 | Exposed MCP tools call the same service functions and the same authorization seam as HTTP routes — no capability the API lacks. |
| MCP-3 | The exposed tool set is small and coarse; destructive tools are flagged and gated. |
| MCP-4 | For servers you consume: per-tenant credentials in the secret store, tool definitions pinned by digest, and re-approval required when a server's tools change. |
| MCP-5 | Tool names, descriptions, schemas and results from external servers are untrusted data (tool poisoning). |
| MCP-6 | Local servers run with least privilege, no ambient credentials, and a restricted filesystem. |
| MCP-7 | A proxy server that uses one static client identity obtains user consent **for each dynamically registered client** before forwarding to the third-party authorization server (confused deputy). |
| MCP-8 | Connectors to third-party systems (ERP, CRM, ticketing) expose allowlisted entities and fields per connector — never the source system's full query surface (AI-12). |

**Note:** the MCP authorization specification is still evolving. Verify these
controls against the current revision before treating them as complete.
**Maps to:** LLM06 Excessive Agency · API2 · API10.

## V17 — Security logging, audit and detection (`LOG`)

**Guards against:** breaches nobody sees, and incidents nobody can reconstruct.
**Chokepoint:** the audit and observability joints, written by the seams (main
spine §4.9, §4.17).

| Id | Control |
|---|---|
| LOG-1 | Security events are emitted by the seams themselves: authentication success and failure, authorization denials, limit hits, token revocation, privilege changes, secret access, admin actions, exports. |
| LOG-2 | Structured, carrying tenant, actor and correlation id; secrets and PII removed by the formatter. |
| LOG-3 | The audit log is append-only, separately retained, and tamper-evident where required. |
| LOG-4 | Alerts on signals: denial spikes, authentication-failure bursts, new administrators, rate-limit storms, tripped honeytokens. |
| LOG-5 | Log access is itself access-controlled and audited. |

**Maps to:** A09 Security Logging and Monitoring Failures.

## V18 — Supply chain and build integrity (`SUPPLY`)

**Guards against:** vulnerable or malicious dependencies, tampered builds, deploying
untested code.
**Chokepoint:** CI — the one path from a commit to production.

| Id | Control |
|---|---|
| SUPPLY-1 | **Tests run before every deploy, and nothing reaches production any other way.** Without this, every other enforcement test in both spines is advisory. |
| SUPPLY-2 | Lockfiles committed; runtime dependencies pinned; builds reproducible. |
| SUPPLY-3 | Dependency vulnerability scanning in CI with a severity gate and a non-widening exemption list. |
| SUPPLY-4 | Container base images pinned by digest, minimal, scanned, running as non-root. |
| SUPPLY-5 | CI actions pinned by commit SHA; least-privilege CI tokens; no secrets exposed to builds from forks. |
| SUPPLY-6 | A software bill of materials is generated per release. |
| SUPPLY-7 | A new dependency is a reviewed decision (typosquatting, maintenance, licence); install scripts disabled where the ecosystem allows. |

**Maps to:** A06 Vulnerable and Outdated Components · A08 Software and Data
Integrity Failures · LLM03 Supply Chain.

## V19 — Configuration and deployment hardening (`DEPLOY`)

**Guards against:** debug consoles, public admin tools, exposed data stores.
**Chokepoint:** startup validation plus infrastructure-as-code.

| Id | Control |
|---|---|
| DEPLOY-1 | Debug mode, auto-reload and verbose errors are off in production — and the application **refuses to start** if they are on. |
| DEPLOY-2 | API docs and schema endpoints, admin panels, **developer consoles and API test pages**, metrics, profilers and detailed health checks are disabled or authenticated in production, from an enumerated list. No served page carries identifiers of privileged accounts — an administrator email pre-filled in a login form is half of a credential. |
| DEPLOY-3 | Only intended ports are exposed. Databases, brokers, caches and task dashboards are never reachable from the internet. |
| DEPLOY-4 | Containers run as non-root with dropped capabilities, resource limits, and read-only filesystems where feasible. |
| DEPLOY-5 | No default credentials, sample accounts or seed passwords in any deployed environment. |
| DEPLOY-6 | Least-privilege cloud IAM; no long-lived cloud keys on servers. |
| DEPLOY-7 | Administrative surfaces are separate: stronger authentication, network restriction, full audit. |
| DEPLOY-8 | Server access is key-only, restricted and audited. |
| DEPLOY-9 | An inventory of every exposed host, API version and endpoint exists, and deprecated versions are actually retired. |
| DEPLOY-10 | **Network segmentation is not authentication.** A route is internal only if it demands an internal credential. Any tunnel, ingress rule, published port, reverse proxy or SSRF collapses a "reachable only inside the network" assumption — and a tunnel typically exposes a whole origin, not the few paths someone had in mind. Reachability is verified from the public edge, never inferred from a diagram, a compose file or a previous audit. |
| DEPLOY-11 | Every public entry point — tunnels, ingress rules, load-balancer listeners — is enumerated as hostname → service → allowed path prefixes. Shared edge configuration is a shared blast radius: many products behind one tunnel means one bad write takes all of them down, so snapshot before any change and verify every hostname after it. |
| DEPLOY-12 | **No general-purpose data access in production** — no raw-SQL endpoint, no read-any-table browser, no arbitrary model query — even behind administrator authentication. A stolen admin session should yield the specific, audited operations administrators need, not the database. Ad-hoc data access is a separate, network-restricted, break-glass path with its own audit. |
| DEPLOY-13 | **Demo, sample and sales accounts are production accounts.** They hold only synthetic data — never real or recognisable client names — carry least privilege and tight quotas, do not retain conversation history, and have credentials rotated whenever they are shared. A shared demo credential is a public credential. |

**Enforcement:** startup refuses debug in production; unauthenticated requests to
`/docs`, `/openapi.json`, `/metrics` and admin paths under production configuration
return 401/404; an external probe, run from **outside** the network against every
public hostname, confirms internal-only paths are unreachable — using requests that
cannot return real data (non-existent ids, nonsense parameters) and never touching
a write route.
**Maps to:** A05 · API8 · API9 Improper Inventory Management.

## V20 — Account lifecycle and recovery (`ACCOUNT`)

**Guards against:** account takeover through the side doors: reset, linking,
invites.
**Chokepoint:** the identity joint.

| Id | Control |
|---|---|
| ACCOUNT-1 | Password reset tokens follow SESS-7; a successful reset revokes existing sessions; reset links are built from a configured base URL. |
| ACCOUNT-2 | No account enumeration across signup, login and reset (see OUTPUT-4). |
| ACCOUNT-3 | Email verification before sensitive capability; changing an email verifies the new address and notifies the old. |
| ACCOUNT-4 | Social / OIDC sign-in keys identity on `iss`+`sub`, **never on email** — a mutable, unverified `email` claim is the "nOAuth" takeover. Auto-link to an existing account only when the provider is authoritative for that email domain **and** the email is provider-verified; otherwise require proving control of the existing account. |
| ACCOUNT-5 | Invitations are bound to the invited address, expiring and single-use. |
| ACCOUNT-6 | Deleting or suspending an account revokes its sessions, tokens, API keys and integration grants. |

**Maps to:** A07 · API2.

## V21 — Business logic integrity (`LOGIC`)

**Guards against:** races, replays and client-trusted values — bugs no scanner finds.
**Chokepoint:** the service layer and database constraints.

| Id | Control |
|---|---|
| LOGIC-1 | Idempotency keys on operations with money or external side effects. |
| LOGIC-2 | Quotas, balances and one-time actions use atomic check-and-set (constraints, conditional updates, locks) — never read-then-write. |
| LOGIC-3 | Workflow transitions are enforced server-side by a state machine. |
| LOGIC-4 | Prices, quotas, roles and tenant are never taken from the client. |
| LOGIC-5 | Sensitive business flows are protected against automation. |

**Enforcement:** N concurrent requests spending one unit of quota succeed exactly
once.
**Maps to:** A04 Insecure Design · API6.

## V22 — Incident readiness (`IR`)

**Guards against:** a bad day becoming a bad month.
**Chokepoint:** the flag service, identity revocation, and written runbooks.

| Id | Control |
|---|---|
| IR-1 | Kill switches per tool, integration and risky feature, flippable without a deploy. |
| IR-2 | A rotation runbook per credential, rehearsed. |
| IR-3 | Mass revocation of sessions and tokens per subject and per tenant. |
| IR-4 | Restores tested, with recovery point and time objectives stated. |
| IR-5 | A security contact and disclosure path (`/.well-known/security.txt`). |
| IR-6 | A credential-leak procedure exists and puts **rotation before cleanup** (see `credentials-and-env.md`). |
| IR-7 | Containment is planned before it is needed: which paths can be blocked at the edge in minutes and reversibly, and who approves a change to shared edge configuration. |

**Maps to:** A09.

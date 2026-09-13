# Credentials and environment

Configuration is the most drifted surface in an agent-written codebase. Every new
integration arrives with "just read it from an env var", and every one of those is
locally correct. A year later the system has a hundred `getenv` calls, three `.env`
files at different depths, a `VITE_` variable holding a key, and a settings object
whose default `repr` prints every credential the company owns.

This file is both halves: the **architecture** that keeps it single, and the
**audit** that finds where it is not.

---

## 1. Three kinds of value, three homes

Most credential incidents start with a value living in the wrong one of these.

| Kind | Examples | Home | Never |
|---|---|---|---|
| **Configuration** | base URLs, feature toggles, pool sizes, region | Typed config object, loaded from env or files | Hardcoded at call sites |
| **Platform secrets** | database password, signing keys, provider API keys, SMTP password | Secret store / KMS in deployed environments, injected at runtime; a local `.env` only for local development | Committed, baked into images, public-prefixed, logged |
| **Tenant credentials** | a customer's OAuth tokens, their API keys for an integration | The database, encrypted with a managed rotatable key, decrypted only in the credential resolver | Environment variables; a shared platform token standing in for a per-tenant one |

The third row is the one people get wrong: a customer's credential is **data**
belonging to a tenant, with a lifecycle (install, refresh, revoke). Putting it in
the environment makes it global, unrotatable per customer, and invisible to the
authorization model.

## 2. The architecture

**Registry:** the configuration schema. Every variable the system reads is declared
once, typed, with a default or marked required, and marked secret where it is one.
**Resolver:** one loader, run at startup.
**Seam:** the typed config object. No `os.getenv`, `os.environ[...]`,
`process.env.X` or `import.meta.env.X` anywhere else.

Rules:

1. **Fail at startup, not at first use.** A missing required value, a malformed
   URL, a signing key under its minimum length, or a known placeholder
   (`changeme`, `your-api-key-here`, the example file's values) stops the process
   with a message naming the variable — never the value.
2. **Redact by marker or type, never by list.** Secret fields use a secret type, or
   the config object's `repr`/`str`/serialisation redacts any field whose name
   contains `PASSWORD`, `SECRET`, `KEY`, `TOKEN`, `CREDENTIAL`, `HASH`, `PAT`,
   `PRIVATE`. A list of known fields protects last year's credentials; a marker
   protects next year's.
   Exempt deliberately and narrowly — `*_PUBLIC_KEY` and `*_URL` are not secrets,
   and redacting them teaches people the marker means nothing.
3. **Why rule 2 matters more than it looks.** The default representation of most
   settings objects *is* a credential dump. The only thing standing between it and
   a CI log, an error tracker or a screenshotted terminal is whether anything ever
   raises — and a single `AttributeError` on the settings object is enough to print
   the whole thing. This is not a theoretical path; it is how these leaks are
   usually found, by accident.
4. **One `.env` location per deployable.** Two `.env` files at different depths
   (repo root and a service directory) are two configurations that will disagree,
   and nobody will know which one the process read. Pick one, and make the loader
   refuse to start if a second is present.
5. **`.env.example` is generated from the schema, or tested equal to it.** It is
   the human-readable registry, and it lies the moment it drifts.
6. **Public prefixes are publication.** Anything named `VITE_*`, `NEXT_PUBLIC_*`,
   `REACT_APP_*`, `EXPO_PUBLIC_*` or `PUBLIC_*` is compiled into code shipped to
   every browser. Treat the prefix as the word "published".
7. **Environments do not share credentials.** Local and CI never hold production
   secrets or connection strings. When a developer's local file does point at a
   production database, write that down as a known risk and plan its removal —
   do not normalise it.
8. **Secrets are injected at runtime**, not at build time: no `ARG`/`ENV` with
   secrets in a Dockerfile (they persist in image layers), no secrets inline in
   compose files, and CI masks every secret it holds.
9. **Test speed shortcuts stay in tests.** Lowering password-hash cost makes a
   suite dramatically faster; do it in test configuration only, and keep a test that
   asserts production cost is at or above the floor.

## 3. The four-way drift test

A variable exists in up to four places. Each pair can disagree, and each
disagreement is a different bug.

```
code references  ↔  config schema  ↔  .env.example  ↔  deployment (compose / k8s / CI)
```

| Disagreement | What it means |
|---|---|
| Read in code, not in schema | A `getenv` bypassing the loader |
| In schema, never read | Dead configuration someone will set and expect to work |
| In schema, not in example | A new developer cannot run the system |
| In example, not in schema | Documentation of a variable that does nothing |
| Required in schema, missing from deployment | A production boot failure waiting for the next deploy |

One test covers all five:

```python
def test_env_registry_is_consistent():
    schema   = set(Settings.model_fields)                     # the registry
    example  = parse_env_keys(".env.example")
    code     = scan_for_env_reads(SRC, exclude=LOADER_PATH)   # must be empty
    deployed = parse_deploy_env_keys(DEPLOY_FILES)

    assert not code,                      f"env read outside the loader: {code}"
    assert schema == example,             f"schema/example drift: {schema ^ example}"
    assert required(Settings) <= deployed, f"missing in deployment: {required(Settings) - deployed}"
```

**Beware the grep blind spot.** Configuration is referenced in ways a
`settings\.NAME` search cannot see — the attribute named as a *string* in
`monkeypatch.setattr(settings, "NAME", ...)`, `getattr(settings, name)`, or a value
assembled from parts. Audits of configuration are wrong in exactly this way more
often than any other: exclude the config module and miss an assembled connection
string, exclude migrations and miss a seed, match one syntax and miss another. Use
the language's AST where you can, and re-measure before claiming a variable is dead.

## 4. The redaction test

```python
def test_settings_never_print_secrets(monkeypatch):
    marker = "CANARY-9f3a-do-not-print"
    for name in secret_like_fields(Settings):          # by marker, not by list
        monkeypatch.setenv(name, marker)
    s = Settings()
    for rendering in (repr(s), str(s), s.model_dump_json(), format_exception_with(s)):
        assert marker not in rendering
```

The last rendering matters most: provoke an exception that includes the settings
object and assert the marker is absent from the formatted traceback.

## 5. Audit checklist

Run these, then **open the files behind the top findings** before reporting them.

**In the repository**

- [ ] `git ls-files | grep -E '(^|/)\.env'` — anything other than `*.example` /
      `*.sample` / `*.template` is a finding.
- [ ] History: `git log --all --diff-filter=A --name-only --format= | grep -E '(^|/)\.env'`
      — a `.env` ever added is a finding even if it was deleted.
- [ ] If available, run a real secret scanner over the working tree **and** history
      (`gitleaks detect`, `trufflehog git file://.`). Greps find shapes; scanners
      find verified live keys.
- [ ] More than one `.env` / `.env.*` location per deployable.
- [ ] `getenv` / `environ` / `process.env` / `import.meta.env` reads outside the
      loader — count files.
- [ ] Public-prefixed variables whose names contain `SECRET`, `KEY`, `TOKEN`,
      `PASSWORD`, `PRIVATE`.
- [ ] Secrets inline in `docker-compose*.yml`, Kubernetes manifests, CI workflow
      files, or Dockerfile `ARG`/`ENV`.
- [ ] Settings objects passed to `print`, `logger.*`, error trackers, or returned
      from any endpoint (including debug and health endpoints).
- [ ] Placeholder or default values accepted at startup.
- [ ] Tenant credentials stored in plaintext columns, or in environment variables.

**In the built and deployed system**

- [ ] Scan the built frontend bundle for key-shaped strings and for every secret
      value's prefix.
- [ ] `docker history --no-trunc <image>` for secrets in layers.
- [ ] CI logs for unmasked values.
- [ ] Error-tracker events and log storage for secret-shaped strings.

## 6. When a credential has leaked

The order matters, and two instincts are wrong. People reach for the history rewrite
first because it feels like cleaning up — it is the *last* step. And people rotate
immediately — which is right, **unless the leak is still open**.

1. **Close the channel if it is still live.** If the exposure is ongoing — an
   endpoint that returns secrets, a public bucket, a debug page, a published port —
   contain it first with the fastest *reversible* step: block the path at the edge,
   disable the route, revoke public access. Rotating while the channel is open just
   leaks the new value through the same hole.
   If the edge configuration is shared by several systems, **snapshot it before the
   change and verify every hostname after it** — one bad write to a shared tunnel or
   ingress takes every product behind it down. Changing shared production edge
   configuration is the owner's decision.
2. **Rotate or revoke — before any cleanup.** Once a secret has been pushed, logged,
   shared or served, assume it has been copied. Treat **every** credential the
   channel could have returned as exposed: you cannot prove it was not read.
   Prioritise by blast radius — credentials with write access to other systems
   before read-only ones.
3. **Rotate what depends on it.** A leaked signing key means every token it signed
   is suspect: revoke sessions. A leaked database password means reviewing what
   else used the same credential.
4. **Assess the window, using the clean signals.** If internal callers never pass
   through the public edge, edge logs are a clean signal: **any** edge request to an
   internal-only path came from outside. Provider-side signals help too — billing
   spikes, unexplained quota exhaustion, unfamiliar source addresses in provider
   access logs. Write the window down.
5. **Fix the cause, then make recurrence a red build.** The code fix — require
   authentication, take the tenant from the token, stop returning the credential —
   plus the test that would have caught it. For exposed routes that is almost
   always the route-authentication coverage test, which runs in CI and touches no
   deployed system. Where callers already exist, roll authentication out in two
   steps: callers send the credential first, the route requires it second.
6. **Clean up.** Remove the value from the working tree. Rewriting shared git
   history is destructive — it requires a force-push and every clone to re-sync —
   so it is the repository owner's decision, made after rotation, never before and
   never automatically.
7. **Check the siblings.** If the gap came from a shared template, a common backend
   skeleton or shared infrastructure, every system built the same way probably has
   it. List them, and check each.
8. **Write it up** in a few lines: what leaked, how, the window, what was rotated,
   and which test now prevents it.

**Verifying an exposure without making it worse:** prove reachability with requests
that cannot return real data — a non-existent id, a nonsense parameter — and never
exercise write routes. **A 404 does not prove a route is closed:** a reachable
internal route returns 404 for a missing id too. Compare the response against one for
a path the edge genuinely does not serve; "answers differently from an unknown path"
means reachable. A 200 with an empty or error body still proves the route is open.

## 7. Enforcement tests for this vertebra

| Test | Catches |
|---|---|
| Env registry consistency (§3) | `getenv` outside the loader, dead and undeclared variables, deployment gaps |
| Redaction by marker (§4) | Settings `repr`/traceback credential dumps |
| No committed `.env` | Real values in the repository |
| Client bundle scan | Secrets shipped to browsers via public prefixes |
| Startup refuses placeholders and weak keys | Default and example secrets in deployed environments |
| Production hash cost floor | Test-speed shortcuts leaking into production |
| Secret scanning in CI | New credentials in any file |
| No response carries a secret-marked field; service-only routes reject anonymous and user tokens | A "resolve config" endpoint handing out decrypted keys |
| Route-authentication coverage with a ratchet baseline | Any new unauthenticated route — the usual channel for a credential leak |

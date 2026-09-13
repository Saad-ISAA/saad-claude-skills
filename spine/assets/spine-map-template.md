# Spine map

Every spine in this repository, in one place. This file is the **registry of
registries**: `tests/uniformity/test_spine_map.py` asserts that every package,
symbol and test named below exists, and that every spine states its boundary. Update
it in the same commit that creates, extends or retires a spine.

"Spine" is the pattern — registry, resolver, seam, enforcement test. Each instance is
named after what it governs.

## Spines

| Spine | Package | Joint(s) | Registry | Resolver | Seam | Enforcement | Owns | Does not own |
|---|---|---|---|---|---|---|---|---|
| access | `app/access/` | authorization | `ResourceType` | `resolve_role()` | `require_read` / `require_role` | `tests/uniformity/test_authz_matrix.py` | who may read or change a registered resource | tenancy resolution (`tenancy/`), rate limits (`edge/`) |
| gateway | `app/gateway/` | tools & integrations, egress | `TOOL_CATALOGUE` | `build_client()` | `invoke()` | `tests/gateway/test_declarations.py` | how an external system is reached: auth, transport, per-tenant telemetry | model routing, prompts, retrieval semantics, authorization |

## Status

**Migration mode:** W3 — opportunistic (a bug in old code is a migration).

**Gate:** CI runs the full suite before every deploy — <yes / no: Spine 0 open>.

**Ratchet:** `tests/uniformity/baseline_violations.txt` — <N> entries (ceiling, not
target). Regenerate after a fix: `<command>`.

**Known-absent joints — do not assume these exist:**

- <joint> — <what exists instead, with a number>

**Healthy joints — protect them, copy them:**

- <joint> — <what is right, and where the template lives>

## Debt register

```
DEBT  <joint>  <path>
  Fixed in place because: <reason>
  Migrating this path requires: <what>
  Escalate to a scheduled phase when: <trigger>
```

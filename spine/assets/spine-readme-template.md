# `<name>/` — <one line: what this spine governs>

<!-- One README per spine. The package is named after what it governs
     (access, gateway, dispatch, vault, ledger) — never spine/, core/ or common/. -->

This package is the **only** implementation of <concern> in this repository. If you
are about to write <the tempting parallel thing — "a unified HTTP client", "a usage
table", "an ownership check"> anywhere else, you are rebuilding this package. Read
this file first.

## The four parts

| Part | Where |
|---|---|
| **Registry** | `<symbol or table>` — <what it enumerates> |
| **Resolver** | `<function>` — <the one decision or dispatch it makes> |
| **Seam** | `<entry point(s)>` — every caller uses these, nothing bypasses them |
| **Enforcement** | `<test file>` — <what goes red, and when> |

**Adding a new <type / adapter / tool> means registering it — nothing more.** If you
find yourself editing the resolver to add one, the design has been bypassed; stop
and ask.

## Boundary

**Owns:** <what this spine decides or carries>

**Does not own:** <adjacent concerns people will assume live here, and where they
actually live — or "not built yet">

Extending this package beyond its boundary is how a clean layer becomes a
god-package. A new concern gets its own domain-named spine.

## Laws

<!-- Invariants specific to this spine that a caller or implementer can break.
     One short paragraph each, with the reason. -->

- <law> — <why>

## Migration roadmap

Order is fixed; each step is behaviour-preserving on its own:

```
<step 1> → <step 2> → <step 3>
```

- [x] <step 1> — <commit / date>
- [ ] <step 2> — <what it collapses as a consequence>

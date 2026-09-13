# Enforcement recipes

Rules decay into suggestions unless a test fails when they are broken. These are
the four tests that carry most of the weight. Language does not matter; the shape
does.

Three tiers, in descending order of value:

1. **Matrix tests** — behavioural, parametrized **from the registry**.
2. **Exhaustiveness tests** — every registry entry has its wiring.
3. **Structural tests** — greps with opinions. Useful, but they check shape, not
   behaviour, so they sit *under* the first two, never instead of them.

---

## 1. The matrix test (the centrepiece)

The parameters come from the registry, so a module registered without gates fails
on the day it is registered — nobody has to remember to add a case.

```python
# tests/uniformity/test_authz_matrix.py
import pytest
from spine.authz.registry import RESOURCE_TYPES          # the registry, not a list

EXPECTED = {
    # role         read   update  delete  share
    "none":       (404,   404,    404,    404),
    "other_tenant":(404,  404,    404,    404),
    "guest":      (200,   403,    404,    404),   # grant, no container membership
    "viewer":     (200,   403,    404,    404),
    "editor":     (200,   200,    404,    404),
    "admin":      (200,   200,    200,    200),
}

@pytest.mark.parametrize("rtype", RESOURCE_TYPES)        # ← generated
@pytest.mark.parametrize("role", EXPECTED)
def test_matrix(client, rtype, role):
    res = make_resource(rtype)
    actor = make_actor(role, res)
    for op, expected in zip(("read", "update", "delete", "share"), EXPECTED[role]):
        assert call(client, rtype, res, op, actor).status_code == expected
```

Add the same shape for tenancy (every type × another tenant's id → 404) and for
archived/suspended states. When you add a module, the only new line is its entry in
the registry.

---

## 2. Route coverage

Enumerate routes from the framework itself, never from a hand-written list.

```python
PUBLIC = {"/health", "/api/auth/login", "/api/auth/callback"}   # enumerated, small

def test_every_route_is_gated(app):
    for route in app.routes:
        if route.path in PUBLIC:
            continue
        assert requires_authentication(route), f"{route.path} has no auth"
        assert declares_scope_or_resource(route), f"{route.path} declares no gate"
```

A new endpoint with no gate becomes a red build instead of a review comment. This
single test is worth more than most of the rest.

---

## 3. The layer map + the baseline ratchet

The test that turns a folder structure into architecture — and the technique that
makes a retrofit possible without a big-bang move.

```python
# tests/uniformity/test_import_direction.py
"""The architecture ratchet: today's violations are the ceiling.

WHY: behavioural tests cannot see drift, because drift is made of individually
correct code. A second implementation passes CI.

HOW: violations are frozen in baseline_violations.txt. No new entry may appear,
the count may never grow, and no stale entry may remain.

REJECTED RULES: <a rule you considered and why it would fail your best module>

BLIND SPOTS: import rules cannot see semantic duplication — two modules each
defining create_api_key import nothing illegal.

REGENERATE after fixing violations:  python -m tests.uniformity.test_import_direction
"""
import ast, pathlib

# Declared from what THIS repository has today. Lower rank = closer to the edge.
# A module may import its own rank or below — never above.
LAYERS = (
    (0, "transport",     ("app/api/",)),
    (1, "orchestration", ("app/services/", "app/tasks/")),
    (2, "domain",        ("app/gateway/", "app/access/")),      # domain-named spines
    (3, "foundation",    ("app/db/", "app/schemas/", "app/config/")),
)
COMPOSITION_ROOT = "app/main.py"    # wiring everything is its job
VENDOR_MODULES = {"boto3", "openai", "anthropic", "litellm", "qdrant_client"}
ADAPTER_PREFIXES = ("app/adapters/",)

def violations() -> set[str]:
    found = set()
    for path in source_files():
        if path == COMPOSITION_ROOT:
            continue
        for node in ast.walk(ast.parse(path.read_text())):   # walk = function-local imports COUNT
            for target in imported_modules(node):
                if rank(target) is not None and rank(target) < rank(path):
                    found.add(f"LAYER  {path} -> {target}")
                if top_level(target) in VENDOR_MODULES and not path.startswith(ADAPTER_PREFIXES):
                    found.add(f"VENDOR {path} -> {target}")
    return found

BASELINE = pathlib.Path(__file__).with_name("baseline_violations.txt")

def test_no_new_violations():
    new = violations() - load(BASELINE)
    assert not new, f"New violations (fix them, or add with a reason in the commit): {sorted(new)}"

def test_count_never_grows():
    assert len(violations()) <= len(load(BASELINE))

def test_no_stale_entries():
    stale = load(BASELINE) - violations()
    assert not stale, f"Fixed — remove from baseline and regenerate: {sorted(stale)}"

if __name__ == "__main__":
    BASELINE.write_text("\n".join(sorted(violations())) + "\n")
```

Rules of use:

- **Declare layers from what exists**, not from the ideal layout. The map is a
  description of today with a direction attached.
- **The baseline is a ceiling, not a target.** The stale-entry test is what makes
  that true: without it, a fixed violation stays listed and the headroom silently
  returns for someone to spend.
- **Adding an entry is allowed, deliberately.** A violation that is genuinely
  correct may be added — with the reason in the commit message. Adding a line
  grants permission for drift; it should be visible in review.
- **A rule your best module would fail is a bad rule.** Record the rejection in the
  docstring so the next agent does not re-propose it.
- **Scope rules narrowly and name them** (`LAYER`, `VENDOR`, `EGRESS`). A baseline
  entry for one rule — say ad-hoc HTTP clients outside the gateway — doubles as that
  migration's progress bar.
- **Verify the test bites**: add a probe module that breaks each rule and confirm the
  failure names it; add a fixed entry to the baseline and confirm the stale check
  fails. Then delete the probe.

---

## 4. Exhaustiveness from the registry

```python
def test_every_resource_type_has_a_module():        # authz
    for t in RESOURCE_TYPES: assert module_for(t)

def test_every_event_type_has_a_schema():           # events
    for t in EVENT_TYPES:    assert schema_for(t)

def test_every_tool_is_complete():                  # tools
    for tool in TOOL_CATALOGUE.values():
        assert tool.input_schema and tool.output_schema
        assert tool.side_effect and tool.required_scopes is not None
        assert tool.credential_ref is None or resolves(tool.credential_ref)

def test_error_codes_and_messages_match():          # both directions
    assert set(ERROR_CODES) == set(MESSAGES["en"]) == set(MESSAGES["ar"])
```

---

## 5. The DLP canary

One test, every egress, catches an entire class of failure.

```python
CANARIES = ["555-00-CANARY", "sk-test-CANARY-not-a-real-key"]

def test_canaries_never_leave(test_tenant, capture_all_egress):
    seed_tenant_with(CANARIES, test_tenant)
    exercise_the_app(test_tenant)          # requests, jobs, notifications, model calls
    for sink in capture_all_egress:        # logs, traces, email, exports, webhooks, llm
        for canary in CANARIES:
            assert canary not in sink.body, f"{canary} leaked via {sink.name}"
```

---

## 6. Structural tests (tier 3)

Cheap, and honest about their limits.

- No registered model is gated by an owner-equality check in a handler.
- No module defines its own role names, status strings or error literals.
- Deleted modules are not recreated — assert the names stay absent.
- Only the sharing service writes grants; the sharing service never decides access.
- Only the dispatcher queues mail; only the publisher writes to the broker; only the
  enqueue seam touches the queue; only adapters import vendor SDKs.
- No module constructs its own HTTP client; no credential-shaped literal in source.
- No model id or prompt string outside the model route catalogue and prompt registry.

---

## 7. The exemption list

Exemptions are how a spine dies — not by being rejected, but by accumulating "just
this one." So make each one a deliberate, reviewable act:

```python
EXEMPTIONS = {                       # every entry needs a reason and a trigger
    "modules/legacy_export/render.py": "pre-spine; converts when export v2 ships",
}

def test_exemptions_do_not_widen():
    assert set(current_exemptions()) <= set(EXEMPTIONS)
    assert len(EXEMPTIONS) <= 12       # a number someone has to argue to raise
```

---

## 8. The spine-map integrity test

The spine map is the registry of registries, so it gets a registry's test.

```python
# tests/uniformity/test_spine_map.py
SPINES = parse_markdown_table("docs/spines.md")     # or a YAML/TOML file

def test_every_spine_in_the_map_is_real():
    for row in SPINES:
        assert pathlib.Path(row.package).is_dir(),     f"{row.spine}: package missing"
        assert resolves(row.registry),                 f"{row.spine}: registry {row.registry} not found"
        assert resolves(row.resolver),                 f"{row.spine}: resolver {row.resolver} not found"
        assert pathlib.Path(row.enforcement).exists(), f"{row.spine}: enforcement test missing"
        assert row.owns and row.does_not_own,          f"{row.spine}: boundary not stated"

def test_no_generic_spine_packages():
    for name in ("spine", "core", "common", "shared", "misc", "utils"):
        assert not any(p.name == name for p in top_level_packages()), \
            f"'{name}/' has no boundary in its name — name the spine for what it governs"
```

Adjust the generic-name list to the repository: if a `core/` package already exists
and is not a spine, put it on the exemption list with its reason rather than
pretending it is not there.

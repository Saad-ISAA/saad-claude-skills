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

## 3. Import direction + the baseline ratchet

The test that turns a folder structure into architecture — and the technique that
makes a retrofit possible without a big-bang move.

```python
# tests/uniformity/test_import_direction.py
LAYERS = ["transports", "modules", "spine", "adapters"]   # may import rightward only

BASELINE = Path("tests/uniformity/baseline_violations.txt").read_text().split()

def test_import_direction():
    current = set(scan_imports_violating_layer_order(LAYERS))
    new = current - set(BASELINE)
    assert not new, f"New layering violations: {new}"        # never grows
    assert len(current) <= len(BASELINE)                     # only shrinks

def test_no_cross_module_imports():
    assert not imports_between("modules/*", "modules/*")
```

Rules of use:

- Generate the baseline **once**, on the day you create `spine/`.
- Every migration commit removes lines from it. The file's line count is the best
  single progress number you have — measured, not asserted.
- Never append to it. A new violation is the failure the test exists to catch.

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

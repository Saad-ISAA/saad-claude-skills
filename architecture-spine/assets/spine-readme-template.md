# `spine/` — one implementation per concern

Everything in this directory is the **only** implementation of its concern. There
is no second authorization check, no second mail sender, no second HTTP client, no
second role vocabulary — anywhere in this repository.

Each subdirectory is a spine with four parts: a **registry** (the one enumeration),
a **resolver** (the one function that decides or dispatches), a **seam** (one or two
entry points every caller uses), and an **enforcement test** in
`tests/uniformity/`, generated from the registry.

## Before you add code here

**Adding a module means registering a type and adding one foreign key. If you find
yourself editing a resolver in order to add a module, the design has been bypassed —
stop and ask.**

## Dependency direction (one-way, enforced by a test)

```
transports → modules → spine → adapters
```

Modules never import each other. The spine never imports a module. Vendors appear
only in `adapters/`.

## If uniformity seems impossible here

Stop and ask. Do not add a parallel path. If an exemption is genuinely right, it
goes in the enumerated exemption list with a reason and the trigger that reverses
it — never as an untracked second implementation.

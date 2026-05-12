---
name: drawio-alibaba-cloud
description: Create professional Alibaba Cloud architecture diagrams as native .drawio files using official mxgraph.alibaba_cloud icons and proven layout conventions (hub-and-spoke landing zones, Cloud Firewall + WAF security stack, traffic-flow color coding, orthogonal routing). Use when the user asks to draw, design, or modify any Alibaba Cloud architecture — landing zones, VPC topologies, CEN routing, hybrid connectivity (Express Connect / IPsec VPN), perimeter security stacks, inbound publishing flows, AD/DNS topology, backup data flows, or any diagram referencing ECS / VPC / vSwitch / CEN / OSS / CFW / WAF / NAT / SLB / RDS / Anti-DDoS / Express Connect / VPN Gateway.
---

# drawio Alibaba Cloud diagrams

This skill is **self-contained** — it does not require any other drawio skill to be installed. It covers the full workflow from generating the `.drawio` XML to opening / exporting the result.

## drawio file basics

A `.drawio` file is native mxGraphModel XML. Every file needs this minimum structure (everything else goes inside `<root>`):

```xml
<mxfile host="Electron" agent="drawio" version="29.6.6">
  <diagram name="Page-1" id="diagram-1">
    <mxGraphModel dx="1843" dy="1380" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2700" pageHeight="1720" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- Diagram cells with parent="1" go here -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

Save as `<descriptive-name>.drawio` in the current working directory (lowercase-hyphens).

## Workflow

1. **Confirm scope** — Is this a full landing zone, or a single sub-system (CEN routing, AD/DNS, backup flow, etc.)? For full landing zones, follow the hub-and-spoke pattern in `references/layout-patterns.md`.

2. **Start from the reference example** — Read `assets/example-landing-zone.drawio` as a structural starting point, then adapt. It implements the canonical hub-and-spoke layout with all conventions correctly applied. Reading it is faster than building from scratch.

3. **Use official icons** — Every Alibaba service icon uses `shape=mxgraph.alibaba_cloud.<name>` with `fillColor=#FF6A00`. See `references/icons.md` for the verified shape names, sizing, and the external (non-Alibaba) entity styles (Internet cloud, on-prem DC, MPLS router, office building).

4. **Use the standard style strings** — Containers (VPC / vSwitch / region / edge band / CEN bar / AZ swimlane), flow edges (inbound / outbound / E-W / hybrid / cross-tenant), and vendor-branded ECS cells are all standardized. See `references/styles.md`.

5. **Apply layout best practices** — Hub-and-spoke topology, region-encompasses-everything-cloud, transit-vsw on right edge for clean Express Connect outflow, slb-vsw aligned below WAF for clean drop, flows routed orthogonally through gap bands. See `references/layout-patterns.md` for the canonical layout and anti-patterns to avoid.

## Security stack options

The reference example uses **Cloud Native** managed services (Alibaba Cloud Firewall + Alibaba WAF + F5 BIG-IP VE). For deployments needing 3rd-party appliances (Palo Alto VM-Series + FortiGate VM + F5 with ASM-WAF) — see the "Option 2" notes in `references/layout-patterns.md` for the structural changes to apply.

## Reference files

- **[icons.md](references/icons.md)** — Verified `mxgraph.alibaba_cloud.*` shape names for VPC, vSwitch, CEN, CFW, WAF, DDoS, NAT, SLB/ALB, Express Connect, VPN Gateway, ECS, RDS, OSS, plus non-Alibaba entity styles and vendor brand colors for 3rd-party appliances
- **[styles.md](references/styles.md)** — Copy-paste XML for containers (VPC, vSwitch, region, edge band, CEN bar, AZ swimlane), flow edge styles by traffic class, edge label style, vendor-branded ECS cells, and routing-with-waypoints syntax
- **[layout-patterns.md](references/layout-patterns.md)** — Canonical hub-and-spoke landing zone layout, critical rules, flow routing through gap bands, Hub VPC vSwitch order, Cloud Native vs 3rd-party security stack differences, two-AZ HA convention, page sizing, and anti-patterns

## Reference example

- **[example-landing-zone.drawio](assets/example-landing-zone.drawio)** — Anonymized 6-VPC hub-and-spoke landing zone: two-AZ HA, Express Connect primary + IPsec VPN backup, Cloud Firewall + Alibaba WAF + F5 BIG-IP VE perimeter, temporary cross-tenant migration spoke, OSS Archive backup, complete legend with rationale

When adapting the reference example, replace the placeholder names (Example-Corp, example.local, Business-App-*, Branch-Site-*, 203.0.113.0/24, Legacy-Tenant, etc.) with the user's actual values and remove components that aren't relevant.

## Output — open and export

After writing the `.drawio` file:

**Open it** so the user can see the result:
| Environment | Command |
|-------------|---------|
| macOS | `open <file>` |
| Linux (native) | `xdg-open <file>` |
| WSL2 | `cmd.exe /c start "" "$(wslpath -w <file>)"` |
| Windows | `start <file>` |

**Export to PNG / SVG / PDF** (optional — only if the user requested a non-editable format). Locate the draw.io desktop CLI then run:

```bash
drawio -x -f <png|svg|pdf> -e -b 10 -o <output.png> <input.drawio>
```

CLI locations:
| Environment | Path |
|-------------|------|
| macOS | `/Applications/draw.io.app/Contents/MacOS/draw.io` |
| Linux | `drawio` (on PATH via snap/apt/flatpak) |
| Windows | `"C:\Program Files\draw.io\draw.io.exe"` |
| WSL2 | `` `/mnt/c/Program Files/draw.io/draw.io.exe` `` |

Key export flags: `-x` (export mode) · `-f` (format) · `-e` (embed editable XML in PNG/SVG/PDF) · `-b 10` (border) · `-o` (output path).

After exporting with `-e`, delete the intermediate `.drawio` — the exported file contains the full editable diagram. Use double extensions like `name.drawio.png` to signal embedded XML.

If the CLI is not found, keep the `.drawio` and tell the user to install the draw.io desktop app from <https://www.drawio.com/> to enable export, or simply open the file directly.

## CRITICAL: XML well-formedness

Never include XML comments (`<!-- -->`) — they waste tokens and can break draw.io parsers. Escape `&` `<` `>` `"` in attribute values (use `&amp;` `&lt;` `&gt;` `&quot;`). Every `mxCell` needs a unique `id`. Every edge cell needs a child `<mxGeometry relative="1" as="geometry"/>` (or one containing the `<Array as="points">` for explicit routing).

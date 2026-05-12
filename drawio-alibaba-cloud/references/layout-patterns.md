# Alibaba Cloud Landing Zone Layout Patterns

## Hub-and-spoke landing zone — canonical layout

This is the layout used in `assets/example-landing-zone-*.drawio`. Match it for any hub-and-spoke Alibaba Cloud landing zone diagram unless the user explicitly asks for a different topology.

```
+----------------------------------------------------------------------+
| TITLE BAR                                                            |
+----------------------------------------------------------------------+
| [Internet]  [Public Users]  [Legacy-Tenant]      (external, top)     |
|                                                                      |
| +================== REGION CONTAINER ============================+   |
| |                                                                |   |
| | +---------- Edge Band (managed services) ------------------+   |   |
| | | [DDoS Pro] → [CFW] → [WAF]               [ALB/EIP]       |   |   |
| | +----------------------------------------------------------+   |   |
| |                                                                | [HQ DC]
| | +========== HUB VPC =====================================+    | [Office]
| | |  AZ-a: [mgmt][perim][f5][ddei][duo][slb][nat][vbr]    |    +---[MPLS]
| | |  AZ-b: [mgmt][perim][f5][ddei][duo][slb][nat][vpngw]  |    |  (right)
| | +========================================================+    |
| |                                                                |   |
| | ===== CEN (Cloud Enterprise Network) — full-width bar =====    |   |
| |                                                                |   |
| | [Shared-Svcs] [Production] [Non-Prod] [Backup] [Website]       |   |
| |                                                                |   |
| +================================================================+   |
|                                                                      |
| LEGEND (full-width footer)                                           |
+----------------------------------------------------------------------+
```

### Critical rules

1. **The region container MUST encompass all cloud services** including managed services (DDoS, CFW, WAF). Never let them float outside the region — this is the #1 mistake.

2. **External entities go OUTSIDE the region**:
   - Internet + Public Users — top-left
   - Legacy tenant / migration sources — top-center or top-right
   - HQ DC + MPLS + on-prem office — right side (vertical column outside region)

3. **Transit-vsw / VBR / VPN-GW go on the RIGHT edge of Hub VPC** so Express Connect / IPsec arrows go straight right out of the region to HQ — no diagonal crossings.

4. **slb-vsw (with ALB icon) goes directly below the WAF icon in the edge band** so the WAF→ALB drop is a clean vertical arrow.

5. **AZ-a and AZ-b are stacked rows inside the Hub VPC** as light-dashed swimlanes. Mirror the vSwitch order in both.

6. **CEN is a thick orange full-width bar** between Hub VPC and the spoke row. The East-West Firewall icon sits at the left edge of the CEN bar.

7. **All 5 spoke VPCs aligned in a single row below CEN with equal heights** (typical: Shared-Services / Production / Non-Production / Backup / Public-Website).

8. **Legend is a full-width footer band** with all flow types and the option-specific rationale.

## Flow routing — orthogonal, never crossing components

### Use the gap bands between major sections

There's always a small gap (~20-30 px) between the edge band, Hub VPC, CEN bar, and spoke row. Route outbound/internal flows through these gaps to avoid crossing component boxes:

| Flow | Routing |
|------|---------|
| Internet → DDoS | Down through external gap, enters DDoS left side |
| DDoS → CFW → WAF | Horizontal chain inside edge band |
| WAF → slb-vsw-a | Straight vertical drop (align icons!) |
| slb → F5 (inside Hub) | Horizontal at bottom of AZ-a row (y just above vSwitch bottom border) |
| NAT GW → CFW (outbound) | UP through gap between edge band and Hub VPC, then LEFT to CFW |
| CFW → Internet (outbound) | UP through gap between top external row and region, then LEFT to Internet |
| VBR → MPLS (Express Connect) | RIGHT through gap between region right edge and HQ container, then DOWN to MPLS |
| VPN-GW → MPLS (IPsec) | RIGHT through gap, then UP to MPLS |
| Legacy → CEN | LEFT along outside top of region, DOWN along outside left edge, RIGHT into CEN |

### Always specify explicit waypoints

Drawio's auto-router will route through components. Use `<Array as="points">` in every flow arrow to force the correct path. See `references/styles.md` for the syntax.

## Hub VPC content — recommended vSwitch order

Left to right in AZ-a (mirror in AZ-b):

| # | vSwitch | Purpose | CIDR pattern |
|---|---------|---------|--------------|
| 1 | mgmt-vsw-a | Bastion · ITSM · Ops jumphost | /24 |
| 2 | perimeter-vsw-a | N-S FW (CFW endpoint or PA-VM) | /24 |
| 3 | f5-vsw-a | F5 BIG-IP VE | /24 |
| 4 | ddei-vsw | Trend Micro DDEI (SMTP) | /24 |
| 5 | duo-mfa-vsw | Cisco Duo connector | /26 |
| 6 | slb-vsw-a | ALB / EIP — inbound landing | /24 |
| 7 | natgw-vsw | NAT Gateway egress | /28 |
| 8 | transit-vsw-a | VBR (Express Connect peer) | /26 |

AZ-b vSwitch #8 hosts vpngw-vsw (VPN Gateway for IPsec backup) instead of VBR.

## Option 1 (Cloud Native) vs Option 2 (3rd-party) — what changes

### Option 1 — Cloud Native (managed services)

- **Edge band** contains the Alibaba-managed CFW + WAF icons (visible)
- **perimeter-vsw-a/b** is mostly empty / shows CFW + WAF *integration endpoints* — these are placeholders since the actual inspection is done by the managed service
- **f5-vsw-a/b** runs F5 BIG-IP VE with LTM + APM + DNS (no ASM-WAF needed — Alibaba WAF does this)
- Inbound flow: Internet → DDoS → **CFW → WAF** → ALB → F5 → spoke
- East-West Firewall on CEN bar = "(CFW)"

### Option 2 — 3rd-Party (Palo Alto + FortiGate + F5)

- **Edge band** has only DDoS Pro + ALB/EIP — no managed CFW/WAF (replace with an informational box explaining the 3rd-party stack)
- **perimeter-vsw-a/b** contains Palo Alto VM-Series ECS instances (gold #F4B71F) AND FortiGate VM ECS instances (magenta #E20074), each in a tinted vendor-branded sub-box
- **f5-vsw-a/b** runs F5 BIG-IP VE with LTM + APM + **ASM-WAF** + AFM + DNS (ASM replaces Alibaba WAF)
- Inbound flow: Internet → DDoS → ALB → **PA-VM** → F5 (with ASM-WAF) → spoke
- East-West Firewall on CEN bar = "(FortiGate VM)"
- Add vendor color swatches to legend

## Two-AZ deployment convention

- AZ-a hosts the Active appliances (PA-VM, F5, FortiGate VM, SLB)
- AZ-b hosts the Standby peers with dashed borders to indicate standby state
- HA pairs synchronize via HA1/HA2 (PA-VM), A/P config sync (FortiGate), floating VIP (F5)
- Sub-second failover for stateful flows

## Sizing reference (page coordinates)

- **Page**: 2700 × 1720 px (landscape, accommodates 5 spokes + right-side HQ external column)
- **Region container**: x=40, y=240, w=2370, h=1380
- **Edge band**: x=80, y=290, w=2290, h=180
- **Hub VPC**: x=60, y=490, w=2330, h=620
- **CEN bar**: x=60, y=1130, w=2330, h=48
- **Spoke row**: y=1200, h=400, 5 spokes side-by-side
- **Legend footer**: x=40, y=1635, w=2640, h=75

## Anti-patterns — never do these

1. ❌ Place the managed services (DDoS/CFW/WAF) outside the cloud region container
2. ❌ Route arrows diagonally or across multiple components
3. ❌ Use `mxgraph.alibaba_cloud.xxx` shape names with `fillColor` other than `#FF6A00` unless deliberately representing a 3rd-party vendor
4. ❌ Mix solid and dashed borders inconsistently — solid = VPC, dashed = vSwitch
5. ❌ Forget to specify `aspect=fixed` on icon cells — they will distort
6. ❌ Use auto-routing edges without `<Array as="points">` — they will cross components
7. ❌ Leave the East-West Firewall icon floating without anchoring it to the CEN bar

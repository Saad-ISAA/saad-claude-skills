# Official Alibaba Cloud Icons for drawio

Always use `shape=mxgraph.alibaba_cloud.<name>` to render the official icon. Without this prefix the cell renders as a plain rectangle.

## Mandatory icon-cell style

Every icon cell must use this style template — only the `shape=` value changes:

```
points=[];aspect=fixed;html=1;align=center;shadow=0;dashed=0;fillColor=#FF6A00;strokeColor=none;shape=mxgraph.alibaba_cloud.<NAME>;
```

`fillColor=#FF6A00` is the Alibaba brand orange — keep it unless intentionally coloring an icon by vendor (e.g. gold for Palo Alto VM-Series, magenta for FortiGate VM, blue for F5 BIG-IP).

## Verified shape names

These names are confirmed to render in drawio 21.x+ (used in `assets/example-landing-zone-*.drawio`).

### Networking

| Component | Shape name |
|-----------|-----------|
| Virtual Private Cloud | `mxgraph.alibaba_cloud.vpc_virtual_private_cloud` |
| vSwitch (subnet) | `mxgraph.alibaba_cloud.vswitch` |
| Cloud Enterprise Network | `mxgraph.alibaba_cloud.cen_cloud_enterprise_network` |
| Express Connect | `mxgraph.alibaba_cloud.express_connect` |
| VPN Gateway | `mxgraph.alibaba_cloud.vpn_gateway` |
| NAT Gateway | `mxgraph.alibaba_cloud.nat_gateway` |
| Application Load Balancer | `mxgraph.alibaba_cloud.alb_application_load_balancer_01` |

### Security

| Component | Shape name |
|-----------|-----------|
| Cloud Firewall (CFW) | `mxgraph.alibaba_cloud.cfw_cloud_firewall` |
| Web Application Firewall | `mxgraph.alibaba_cloud.waf_web_application_firewall` |
| Anti-DDoS (DDoS Protection) | `mxgraph.alibaba_cloud.ddos_protection` |

### Compute & data

| Component | Shape name |
|-----------|-----------|
| Elastic Compute Service (ECS) | `mxgraph.alibaba_cloud.ecs_elastic_compute_service` |
| ApsaraDB for RDS | `mxgraph.alibaba_cloud.apsaradb_rds` |
| Object Storage Service (OSS) | `mxgraph.alibaba_cloud.oss_object_storage_service` |

## External (non-Alibaba) entities used in landing zones

For Internet, on-prem datacenter, MPLS router, and office building — use drawio's built-in image / shape libraries:

| Entity | Style |
|--------|-------|
| Internet cloud | `image;aspect=fixed;perimeter=ellipsePerimeter;html=1;align=center;shadow=0;dashed=0;image=img/lib/active_directory/internet_cloud.svg;` |
| On-prem datacenter | `image;points=[];aspect=fixed;html=1;align=center;shadow=0;dashed=0;image=img/lib/allied_telesis/storage/Datacenter_Server_Storage_Unit_Large.svg;` |
| MPLS / generic router | `image;html=1;image=img/lib/clip_art/networking/Router_128x128.png;` |
| Office building (users) | `shape=mxgraph.aws3.office_building;fillColor=#7D7C7C;gradientColor=none;outlineConnect=0;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;` |

## Vendor brand colors for 3rd-party security appliances

When representing 3rd-party VMs deployed on ECS, use vendor-branded fill/stroke colors on the ECS icon to differentiate them visually:

| Vendor | Fill (`fillColor`) | Stroke (`strokeColor`) |
|--------|--------------------|-----------------------|
| Palo Alto VM-Series | `#F4B71F` (gold) | `#B5851A` |
| FortiGate VM | `#E20074` (magenta) | `#A30055` |
| F5 BIG-IP VE | `#0090DA` (blue) | `#005A9C` |

## Sizing conventions (px)

Match these sizes for consistency with `assets/` examples:

| Icon | Width × Height |
|------|---------------|
| VPC icon (in VPC header) | 31 × 20 |
| vSwitch icon (in vSwitch header) | 14 × 10 |
| ECS instance | 22 × 20 |
| Apsara RDS | 24 × 22 |
| ALB | 24 × 22 |
| NAT Gateway | 34 × 26 |
| CFW (small/endpoint) | 40 × 28 |
| CFW (edge band) | 56 × 40 |
| WAF (small/endpoint) | 36 × 32 |
| WAF (edge band) | 50 × 44 |
| Anti-DDoS Pro | 42 × 48 |
| Express Connect | 52 × 46 |
| VPN Gateway | 42 × 42 |
| CEN | 40-50 × 40-50 |
| OSS | 45-55 × 34-42 |

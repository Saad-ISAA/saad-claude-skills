# Alibaba Cloud drawio Styles

Copy these style strings verbatim. Coordinates are placeholders.

## Containers

### VPC container (solid orange border)

```xml
<mxCell id="vpc-xxx" value="" style="dashed=0;verticalAlign=top;whiteSpace=wrap;html=1;strokeColor=#FF8000;fillColor=#FFFBF5;strokeWidth=2;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>
<!-- VPC icon top-left -->
<mxCell id="vpc-xxx-i" value="" style="points=[];aspect=fixed;html=1;align=center;shadow=0;dashed=0;fillColor=#FF6A00;strokeColor=none;shape=mxgraph.alibaba_cloud.vpc_virtual_private_cloud;" vertex="1" parent="1">
  <mxGeometry x="X+8" y="Y+8" width="31.15" height="20" as="geometry"/>
</mxCell>
<!-- Name + CIDR labels next to icon -->
<mxCell id="vpc-xxx-n" value="&lt;font style=&quot;font-size:10px;&quot;&gt;&lt;b&gt;VPC-Name&lt;/b&gt; · CIDR&lt;/font&gt;" style="text;html=1;align=left;verticalAlign=middle;strokeColor=none;fillColor=none;" vertex="1" parent="1">
  <mxGeometry x="X+45" y="Y+8" width="W-50" height="14" as="geometry"/>
</mxCell>
```

### vSwitch container (dashed orange border)

```xml
<mxCell id="vsw-xxx" value="" style="dashed=1;verticalAlign=top;whiteSpace=wrap;html=1;strokeColor=#FF8000;fillColor=#FFFFFF;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>
<mxCell id="vsw-xxx-i" value="" style="points=[];aspect=fixed;html=1;align=center;shadow=0;dashed=0;fillColor=#FF6A00;strokeColor=none;shape=mxgraph.alibaba_cloud.vswitch;" vertex="1" parent="1">
  <mxGeometry x="X+5" y="Y+5" width="14" height="10" as="geometry"/>
</mxCell>
<mxCell id="vsw-xxx-n" value="&lt;font style=&quot;font-size:9px;&quot;&gt;&lt;b&gt;vsw-name&lt;/b&gt;&lt;br&gt;CIDR&lt;/font&gt;" style="text;html=1;align=left;verticalAlign=middle;strokeColor=none;fillColor=none;" vertex="1" parent="1">
  <mxGeometry x="X+25" y="Y+2" width="W-30" height="24" as="geometry"/>
</mxCell>
```

### Region container (encompasses ALL cloud services — never let managed services float outside it)

```xml
<mxCell id="region" value="" style="dashed=0;verticalAlign=top;whiteSpace=wrap;html=1;strokeColor=#FF6A00;strokeWidth=3;fillColor=#FFFFFF;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>
<mxCell id="region-lbl" value="&lt;font style=&quot;font-size:13px;&quot;&gt;&lt;b&gt;Alibaba Cloud · &lt;region&gt;&lt;/b&gt;&lt;/font&gt;" style="text;html=1;align=left;verticalAlign=middle;strokeColor=none;fillColor=none;fontColor=#FF6A00;spacingLeft=10;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y+10" width="800" height="22" as="geometry"/>
</mxCell>
```

### AZ swimlane (light dashed band inside Hub VPC)

```xml
<mxCell id="az-a" value="&lt;font style=&quot;font-size:10px;font-style:italic;&quot;&gt;&lt;region&gt;-a&lt;/font&gt;" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#FFD3AA;dashed=1;verticalAlign=top;align=left;spacingLeft=8;fontColor=#B24E00;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>
```

### Edge band (managed services band — inside region, above Hub VPC)

```xml
<mxCell id="edge-band" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF5EB;strokeColor=#FFD3AA;dashed=1;verticalAlign=top;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="180" as="geometry"/>
</mxCell>
```

### CEN bar (full-width orange bar between Hub VPC and spokes)

```xml
<mxCell id="cen-rect" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FF6A00;strokeColor=#FF6A00;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="48" as="geometry"/>
</mxCell>
<mxCell id="cen-icon" value="" style="points=[];aspect=fixed;html=1;align=center;shadow=0;dashed=0;fillColor=#FFFFFF;strokeColor=none;shape=mxgraph.alibaba_cloud.cen_cloud_enterprise_network;" vertex="1" parent="1">
  <mxGeometry x="X+W/2-20" y="Y+4" width="40" height="40" as="geometry"/>
</mxCell>
<mxCell id="cen-lbl" value="&lt;font style=&quot;font-size:12px;color:#FFFFFF;&quot;&gt;&lt;b&gt;Cloud Enterprise Network · &lt;name&gt;&lt;/b&gt;&lt;/font&gt;" style="text;html=1;align=center;verticalAlign=middle;strokeColor=none;fillColor=none;" vertex="1" parent="1">
  <mxGeometry x="X+W/2-200" y="Y+6" width="400" height="20" as="geometry"/>
</mxCell>
```

## Flow edges (traffic types)

These edge styles must be used consistently — each color represents a distinct trust/traffic class.

### Inbound (Internet → workload) — black solid

```
endArrow=classic;html=1;rounded=0;endFill=1;strokeWidth=2;
```

### Outbound (NAT → Internet) — green dashed

```
endArrow=classic;html=1;rounded=0;endFill=1;dashed=1;strokeColor=#80FF00;strokeWidth=2;
```

### Internal East-West (inter-VPC via CEN) — red dashed with pattern 8 8

```
endArrow=classic;startArrow=classic;startFill=1;html=1;rounded=0;endFill=1;strokeColor=#FF0E0E;dashed=1;dashPattern=8 8;strokeWidth=2;
```

### Internal Alibaba service traffic (e.g. OSS endpoint) — blue dashed with pattern 12 12

```
endArrow=classic;html=1;rounded=0;endFill=1;strokeColor=#0000CC;dashed=1;dashPattern=12 12;strokeWidth=2;
```

### Hybrid Express Connect (primary) — orange thick solid

```
endArrow=classic;startArrow=classic;startFill=1;html=1;rounded=0;endFill=1;strokeColor=#FF6A00;strokeWidth=3;
```

### Hybrid IPsec VPN (backup) — orange dashed with pattern 6 6

```
endArrow=classic;startArrow=classic;startFill=1;html=1;rounded=0;endFill=1;strokeColor=#FF6A00;dashed=1;dashPattern=6 6;strokeWidth=2;
```

### Cross-tenant temporary attach — dark-red dashed

```
endArrow=classic;startArrow=classic;startFill=1;html=1;rounded=0;endFill=1;strokeColor=#A03030;dashed=1;dashPattern=6 6;strokeWidth=2;
```

### Hub VPC → CEN (structural attachment, not traffic flow) — thick orange no-arrow

```
endArrow=none;html=1;rounded=0;strokeColor=#FF6A00;strokeWidth=4;
```

## Edge label style (small white-background tag on a flow line)

```xml
<mxCell id="lbl-xxx" value="&lt;font style=&quot;font-size:9px;&quot;&gt;Inbound&lt;/font&gt;" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;fillColor=#FFFFFF;strokeColor=none;" vertex="1" connectable="0" parent="<edge-id>">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Routing — always orthogonal with explicit waypoints

Use the `<Array as="points">` element to force the arrow through specific coordinates. This is the only way to guarantee clean routing — automatic routing crosses components.

```xml
<mxCell id="f-xxx" style="endArrow=classic;..." edge="1" parent="1" source="<src-id>" target="<dst-id>">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="1685" y="478"/>
      <mxPoint x="928" y="478"/>
    </Array>
  </mxGeometry>
</mxCell>
```

## Vendor-branded ECS cells (Option 2 / 3rd-party security)

When showing 3rd-party FW VMs running on ECS, override the ECS icon's `fillColor` and `strokeColor`, and wrap in a tinted background box for visual grouping:

```xml
<!-- Tinted backing box -->
<mxCell id="pa-bx" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFF7D9;strokeColor=#B5851A;strokeWidth=1;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="80" height="60" as="geometry"/>
</mxCell>
<!-- Branded ECS icon on top -->
<mxCell id="pa-ecs" value="" style="points=[];aspect=fixed;html=1;align=center;shadow=0;dashed=0;fillColor=#F4B71F;strokeColor=#B5851A;shape=mxgraph.alibaba_cloud.ecs_elastic_compute_service;" vertex="1" parent="1">
  <mxGeometry x="X+25" y="Y+5" width="24" height="22" as="geometry"/>
</mxCell>
<!-- Vendor label below icon -->
<mxCell id="pa-l" value="&lt;font style=&quot;font-size:8px;&quot;&gt;&lt;b&gt;PA-VM&lt;/b&gt;&lt;br&gt;(Active)&lt;/font&gt;" style="text;html=1;align=center;verticalAlign=middle;strokeColor=none;fillColor=none;" vertex="1" parent="1">
  <mxGeometry x="X" y="Y+30" width="80" height="24" as="geometry"/>
</mxCell>
```

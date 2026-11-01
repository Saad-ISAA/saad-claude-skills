#!/usr/bin/env python3
"""Shrink-only CRAP baseline, in the style of spine's uniformity ratchet.

    quality_ratchet.py check [--metric crap|complexity] [--baseline PATH] [--crap .metrics/crap.edn] [--limit 10]
    quality_ratchet.py regen [--metric crap|complexity] [--baseline PATH] [--crap .metrics/crap.edn] [--limit 10] [--init]

Input is the snapshot crapper writes: {:entries [{:name .. :namespace .. :crap ..}]}.
--metric complexity needs no test run (crapper --no-coverage), so it is the fast everyday gate;
--metric crap needs coverage and is the deeper, occasional one. Each has its own baseline file.
A function is keyed by "namespace::name"; a rename or move is a new entry (crapper has no
identity matching), so it must clear the limit like any new code.

check  exits 1 when
         - a function over the limit is not in the baseline (new debt),
         - a baselined function scored worse than its recorded score (worsened),
         - a baseline entry is gone or now under the limit (stale: run regen to drop it).
regen  rewrites the baseline, and refuses to if that would add an entry or raise a score.
       --init is the one exception: it writes the first baseline from today's numbers.
"""
import argparse
import json
import re
import sys
from pathlib import Path

MAP_RE = re.compile(r"\{[^{}]*\}")
PAIR_RE = re.compile(r':([\w-]+)\s+("(?:[^"\\]|\\.)*"|[^\s,}]+)')


def _value(raw):
    if raw.startswith('"'):
        return json.loads(raw)
    if raw == "nil":
        return None
    try:
        return float(raw)
    except ValueError:
        return raw


def parse_scores(text, metric="crap"):
    """Return {"namespace::name": value} for entries that have the metric."""
    scores = {}
    for block in MAP_RE.findall(text):
        entry = {k: _value(v) for k, v in PAIR_RE.findall(block)}
        if entry.get("name") is None or entry.get(metric) is None:
            continue
        scores[f"{entry.get('namespace', '')}::{entry['name']}"] = entry[metric]
    return scores


def over_limit(scores, limit):
    return {k: v for k, v in scores.items() if v >= limit}


def compare(current, baseline):
    new = sorted(k for k in current if k not in baseline)
    worse = sorted(k for k in current if k in baseline and current[k] > baseline[k])
    stale = sorted(k for k in baseline if k not in current)
    return new, worse, stale


def load_baseline(path):
    return json.loads(path.read_text())["scores"] if path.exists() else {}


def write_baseline(path, scores, limit, metric):
    body = {"metric": metric, "limit": limit, "scores": {k: round(v, 2) for k, v in sorted(scores.items())}}
    path.write_text(json.dumps(body, indent=2) + "\n")


def cmd_check(current, baseline):
    new, worse, stale = compare(current, baseline)
    for label, keys, src in (("NEW", new, current), ("WORSE", worse, current), ("STALE", stale, baseline)):
        for k in keys:
            print(f"{label:5} {k}  {baseline.get(k, '-')} -> {src[k] if k in current else '-'}")
    return 1 if (new or worse or stale) else 0


def cmd_regen(current, baseline, path, limit, metric, init):
    new, worse, _ = compare(current, baseline)
    if (new or worse) and not init:
        print("refusing: regen may only shrink the baseline", file=sys.stderr)
        for k in new + worse:
            print(f"  would add/raise {k}", file=sys.stderr)
        return 1
    write_baseline(path, current, limit, metric)
    print(f"baseline: {len(current)} function(s) at or over {limit} ({metric})")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("command", choices=["check", "regen"])
    p.add_argument("--metric", choices=["crap", "complexity"], default="complexity")
    p.add_argument("--baseline", type=Path, default=None,
                   help="default: tests/uniformity/<metric>-baseline.json")
    p.add_argument("--crap", type=Path, default=Path(".metrics/crap.edn"))
    p.add_argument("--limit", type=float, default=10.0)
    p.add_argument("--init", action="store_true")
    a = p.parse_args(argv)
    if not a.crap.exists():
        print(f"{a.crap} not found: run crapper first", file=sys.stderr)
        return 2
    a.baseline = a.baseline or Path(f"tests/uniformity/{a.metric}-baseline.json")
    current = over_limit(parse_scores(a.crap.read_text(), a.metric), a.limit)
    baseline = load_baseline(a.baseline)
    if a.command == "check":
        return cmd_check(current, baseline)
    return cmd_regen(current, baseline, a.baseline, a.limit, a.metric, a.init)


if __name__ == "__main__":
    sys.exit(main())

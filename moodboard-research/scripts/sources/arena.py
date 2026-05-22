#!/usr/bin/env python3
"""
Are.na scraper. Public JSON API, no auth. /v2/search/blocks returns 403 anonymously
since early 2025, so fall back to channels-only path.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"


def log_factory(log_path):
    def log(msg):
        line = f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] [arena] {msg}\n"
        Path(log_path).parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a") as f:
            f.write(line)
        print(line, end="", flush=True)
    return log


def slugify(s, words=3):
    s = (s or "untitled").lower()
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    parts = [p for p in s.split() if p][:words]
    return "-".join(parts) or "untitled"


def score_candidate(signals, brief):
    text = " ".join(s for s in signals if s).lower()
    b = (brief or "").lower()
    if not text:
        return {"score": 0, "breakdown": {k: 0 for k in ["subject", "mood", "composition", "color", "style", "originality"]}}

    SUBJECT = ["apartment", "interior", "living", "bedroom", "kitchen", "bathroom", "home", "flat", "studio", "room", "dining"]
    MOOD = ["warm", "cozy", "cosy", "inviting", "soft", "lived-in", "lived in", "snug", "intimate", "serene", "calm"]
    STYLE = ["modern", "contemporary", "minimalist", "minimal", "scandi", "scandinavian", "japandi", "mid-century", "midcentury", "clean lines"]
    COLOR = ["earthy", "terracotta", "ochre", "taupe", "beige", "sage", "cream", "walnut", "oak", "muted", "natural"]
    COMP = ["layered", "composed", "framed", "editorial", "styled", "curated"]
    NEG = ["luxury", "penthouse", "mansion", "marble", "gold fixture", "chandelier", "opulent", "palatial", "showroom"]

    def hits(keys):
        return sum(1 for k in keys if k in text)
    subj = 2 if hits(SUBJECT) >= 1 else 0
    mood = 2 if hits(MOOD) >= 1 else 0
    style = 2 if hits(STYLE) >= 1 else 0
    color = 2 if hits(COLOR) >= 1 else 0
    comp = 1 if hits(COMP) >= 1 else 0
    orig = max(0, 1 - hits(NEG))

    bd = {"subject": subj, "mood": mood, "composition": comp, "color": color, "style": style, "originality": orig}
    return {"score": sum(bd.values()), "breakdown": bd}


def passes(s, mt=8, ma=4):
    if s["score"] < mt:
        return False
    nz = sum(1 for v in s["breakdown"].values() if v > 0)
    return nz >= ma


def main():
    out_dir = os.environ.get("MB_OUTPUT_DIR")
    log_file = os.environ.get("MB_LOG_FILE")
    queries = json.loads(os.environ.get("MB_QUERIES", "[]"))
    target = int(os.environ.get("MB_TARGET", "25"))
    min_threshold = int(os.environ.get("MB_MIN_THRESHOLD", "8"))
    brief_path = os.environ.get("MB_BRIEF_PATH", "")
    brief = ""
    if brief_path and Path(brief_path).exists():
        brief = Path(brief_path).read_text()

    if not out_dir or not log_file:
        print("MB_OUTPUT_DIR and MB_LOG_FILE required")
        sys.exit(2)
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    log = log_factory(log_file)
    log(f"start; queries={len(queries)} target={target}")

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "application/json"})

    # 1) Find channels
    channel_slugs = []
    for q in queries[:8]:
        try:
            r = session.get("https://api.are.na/v2/search/channels", params={"q": q, "per": 8}, timeout=20)
            if r.status_code != 200:
                log(f"  chan-search '{q}' HTTP {r.status_code}")
                continue
            data = r.json()
            for c in data.get("channels", []):
                title = (c.get("title") or "").lower()
                desc = (c.get("description") or "").lower()
                slug = c.get("slug") or ""
                if not slug:
                    continue
                # Reject obvious SEO-spam (non-Latin, all-caps locations, very long titles)
                if len(title) > 60 or re.search(r"[؀-ۿ一-鿿]", title):
                    continue
                # Accept if query terms appear in title/desc OR title is short and looks topical
                qlow = q.lower()
                qterms = [t for t in re.split(r"\W+", qlow) if len(t) > 2]
                hit = any(t in title or t in desc for t in qterms)
                if hit or len(title) < 30:
                    channel_slugs.append(slug)
        except Exception as e:
            log(f"  chan-search ERR {e}")
        time.sleep(0.6)

    # Also try broader generic queries that surface big curated channels
    for generic in ["interiors", "home", "domestic", "apartment", "cozy interior"]:
        try:
            r = session.get("https://api.are.na/v2/search/channels", params={"q": generic, "per": 5}, timeout=20)
            if r.status_code != 200:
                continue
            for c in r.json().get("channels", []):
                slug = c.get("slug") or ""
                title = (c.get("title") or "").lower()
                if not slug or len(title) > 60:
                    continue
                if re.search(r"[؀-ۿ一-鿿]", title):
                    continue
                channel_slugs.append(slug)
        except Exception:
            pass
        time.sleep(0.5)

    channel_slugs = list(dict.fromkeys(channel_slugs))[:18]
    log(f"productive channels: {len(channel_slugs)} ({', '.join(channel_slugs[:6])}...)")

    # 2) Pull contents
    seen_ids = set()
    candidates = []
    for slug in channel_slugs:
        try:
            r = session.get(f"https://api.are.na/v2/channels/{slug}/contents", params={"per": 80, "page": 1}, timeout=25)
            if r.status_code != 200:
                log(f"  channel {slug} HTTP {r.status_code}")
                continue
            data = r.json()
            for blk in data.get("contents", []):
                if blk.get("class") != "Image" or blk.get("id") in seen_ids:
                    continue
                seen_ids.add(blk["id"])
                img = blk.get("image") or {}
                url = (img.get("original") or {}).get("url") or (img.get("large") or {}).get("url")
                if not url:
                    continue
                candidates.append({
                    "id": blk["id"],
                    "title": blk.get("title") or "",
                    "description": blk.get("description") or "",
                    "channel": slug,
                    "url": url,
                    "source_url": blk.get("source", {}).get("url") if blk.get("source") else "",
                })
        except Exception as e:
            log(f"  channel {slug} ERR {e}")
        time.sleep(0.6)
    log(f"blocks collected: {len(candidates)}")

    # 3) Score — channel curation does the heavy lifting; titles are usually filenames
    scored = []
    for c in candidates:
        # Start with a "curated baseline": channel was query-relevant, so subject/style/mood get default credit
        ch = c["channel"].lower().replace("-", " ")
        s = score_candidate([c["title"], c["description"], ch, ch], brief)
        # Baseline boost: if channel name contains any interior/design keyword, bump subject + style + mood
        if any(k in ch for k in ["interior", "home", "apartment", "house", "japandi", "scandi", "cozy", "cosy", "warm", "domestic", "space"]):
            s["breakdown"]["subject"] = max(s["breakdown"]["subject"], 2)
            s["breakdown"]["style"] = max(s["breakdown"]["style"], 1)
            s["breakdown"]["mood"] = max(s["breakdown"]["mood"], 1)
            s["breakdown"]["composition"] = max(s["breakdown"]["composition"], 1)
            s["score"] = sum(s["breakdown"].values())
        # Lower threshold (curation already filtered)
        arena_min = max(6, min_threshold - 2)
        if s["score"] >= arena_min and sum(1 for v in s["breakdown"].values() if v > 0) >= 3:
            scored.append({**c, **s})
    scored.sort(key=lambda x: -x["score"])
    kept = scored[: target * 2]
    log(f"survivors: {len(kept)} (threshold {max(6, min_threshold-2)}/12, curated baseline)")

    # 4) Download
    entries = []
    for i, c in enumerate(kept[:target], start=1):
        slug_str = slugify(c["title"] or c["channel"])
        fn = f"arena_{i:02d}_{slug_str}.jpg"
        dest = Path(out_dir) / fn
        try:
            r = session.get(c["url"], timeout=25)
            if r.status_code != 200 or len(r.content) < 10_000:
                log(f"  {i}. SKIP HTTP {r.status_code} / tiny")
                continue
            dest.write_bytes(r.content)
            entries.append({
                "filename": fn,
                "source_url": c["url"],
                "page_url": f"https://www.are.na/block/{c['id']}",
                "query": "",
                "description": c["title"] or c["description"][:120],
                "score": c["score"],
                "score_breakdown": c["breakdown"],
                "dimensions": "",
                "channel": c["channel"],
            })
            log(f"  {i}. [{c['score']}/12] {fn} ({len(r.content)} B)")
        except Exception as e:
            log(f"  {i}. SKIP {e}")
        time.sleep(0.9)

    (Path(out_dir) / "manifest.json").write_text(json.dumps(entries, indent=2))
    log(f"done; {len(entries)} images")


if __name__ == "__main__":
    main()

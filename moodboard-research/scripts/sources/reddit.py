#!/usr/bin/env python3
"""
Reddit scraper. Multi-sub JSON API; no auth.
Subs configured here — edit the SUBS list to customize for different briefs.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"

# Subreddits known to produce photographic interior content. Tune per brief.
SUBS = [
    ("CozyPlaces", "year"),
    ("InteriorDesign", "year"),
    ("Houseporn", "year"),
    ("centuryhomes", "year"),
    ("midcenturymodern", "year"),
    ("AmateurRoomPorn", "year"),
    ("malelivingspace", "year"),
    ("femalelivingspace", "year"),
]


def log_factory(log_path):
    def log(msg):
        line = f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] [reddit] {msg}\n"
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
    if not text:
        return {"score": 0, "breakdown": {k: 0 for k in ["subject", "mood", "composition", "color", "style", "originality"]}}
    SUBJECT = ["apartment", "interior", "living", "bedroom", "kitchen", "bathroom", "home", "flat", "studio", "room", "house", "dining"]
    MOOD = ["warm", "cozy", "cosy", "soft", "lived-in", "snug", "intimate"]
    STYLE = ["modern", "contemporary", "minimalist", "scandi", "japandi", "mid-century", "midcentury"]
    COLOR = ["earthy", "terracotta", "ochre", "taupe", "beige", "sage", "cream", "walnut", "oak", "wood", "natural"]
    COMP = ["composed", "styled", "view", "corner"]
    NEG = ["luxury", "penthouse", "mansion", "marble", "gold", "chandelier"]

    def hits(keys):
        return sum(1 for k in keys if k in text)
    bd = {
        "subject": 2 if hits(SUBJECT) >= 1 else 0,
        "mood": 2 if hits(MOOD) >= 1 else 1,  # Reddit subs are pre-filtered by community taste
        "composition": 1 if hits(COMP) >= 1 else 1,
        "color": 2 if hits(COLOR) >= 1 else 0,
        "style": 2 if hits(STYLE) >= 1 else 1,
        "originality": max(0, 1 - hits(NEG)),
    }
    return {"score": sum(bd.values()), "breakdown": bd}


def passes(s, mt=7, ma=4):
    if s["score"] < mt:
        return False
    return sum(1 for v in s["breakdown"].values() if v > 0) >= ma


def extract_image(post):
    if post.get("over_18") or post.get("is_video"):
        return None
    url = post.get("url") or ""
    # Direct image
    if re.search(r"\.(jpg|jpeg|png|webp)(?:\?|$)", url, re.I):
        return url
    if "i.redd.it" in url:
        return url
    # Gallery: first item from media_metadata
    if post.get("is_gallery") and post.get("media_metadata"):
        mm = post["media_metadata"]
        first_id = next(iter(mm.keys()))
        item = mm[first_id]
        # Decoded URL is in 's' field
        s = item.get("s") or {}
        u = s.get("u") or ""
        # Reddit encodes &amp;
        u = u.replace("&amp;", "&")
        return u or None
    # Preview fallback
    prev = (post.get("preview") or {}).get("images") or []
    if prev:
        u = (prev[0].get("source") or {}).get("url") or ""
        return u.replace("&amp;", "&") or None
    return None


def main():
    out_dir = os.environ.get("MB_OUTPUT_DIR")
    log_file = os.environ.get("MB_LOG_FILE")
    target = int(os.environ.get("MB_TARGET", "30"))
    min_threshold = int(os.environ.get("MB_MIN_THRESHOLD", "7"))
    brief_path = os.environ.get("MB_BRIEF_PATH", "")
    brief = Path(brief_path).read_text() if brief_path and Path(brief_path).exists() else ""

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    log = log_factory(log_file)
    log(f"start; subs={len(SUBS)} target={target}")

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept": "application/json"})

    candidates = []
    for sub, period in SUBS:
        try:
            r = session.get(f"https://www.reddit.com/r/{sub}/top.json", params={"t": period, "limit": 50}, timeout=20)
            if r.status_code != 200:
                log(f"  r/{sub} HTTP {r.status_code}")
                continue
            data = r.json()
            posts = [c.get("data", {}) for c in data.get("data", {}).get("children", [])]
            log(f"  r/{sub}: {len(posts)} posts")
            for p in posts:
                img = extract_image(p)
                if not img:
                    continue
                candidates.append({
                    "subreddit": sub,
                    "title": p.get("title") or "",
                    "url": img,
                    "permalink": "https://www.reddit.com" + (p.get("permalink") or ""),
                    "id": p.get("id"),
                })
        except Exception as e:
            log(f"  r/{sub} ERR {e}")
        time.sleep(1.2)

    log(f"raw candidates: {len(candidates)}")

    # Score
    scored = []
    for c in candidates:
        s = score_candidate([c["title"], c["subreddit"]], brief)
        if passes(s, min_threshold, 4):
            scored.append({**c, **s})
    scored.sort(key=lambda x: -x["score"])
    log(f"survivors: {len(scored)}")

    # Cap per-subreddit for diversity
    per_sub = {}
    kept = []
    for c in scored:
        n = per_sub.get(c["subreddit"], 0)
        if n >= 5:
            continue
        per_sub[c["subreddit"]] = n + 1
        kept.append(c)
        if len(kept) >= target:
            break

    entries = []
    for i, c in enumerate(kept, start=1):
        fn = f"reddit_{i:02d}_{slugify(c['title'])}.jpg"
        dest = Path(out_dir) / fn
        try:
            r = session.get(c["url"], timeout=25, headers={"User-Agent": UA})
            if r.status_code != 200 or len(r.content) < 10_000:
                log(f"  {i}. SKIP HTTP {r.status_code} / tiny")
                continue
            dest.write_bytes(r.content)
            entries.append({
                "filename": fn,
                "source_url": c["url"],
                "page_url": c["permalink"],
                "query": f"r/{c['subreddit']}",
                "description": c["title"],
                "score": c["score"],
                "score_breakdown": c["breakdown"],
                "dimensions": "",
                "channel": c["subreddit"],
            })
            log(f"  {i}. [{c['score']}/12] {fn} ({len(r.content)} B)")
        except Exception as e:
            log(f"  {i}. SKIP {e}")
        time.sleep(0.8)

    (Path(out_dir) / "manifest.json").write_text(json.dumps(entries, indent=2))
    log(f"done; {len(entries)} images")


if __name__ == "__main__":
    main()

#!/usr/bin/env node
// Pinterest scraper. Anonymous browsing; relaxes threshold to 6/12 when alt-text is sparse.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, writeManifest } = require('../_common');

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'pinterest');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start; queries=${env.queries.length} target=${env.target}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const seen = new Set();
  const candidates = [];

  for (const q of env.queries) {
    if (candidates.length >= env.target * 4) break;
    const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;
    log(`SEARCH "${q}" -> ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      try { await page.keyboard.press('Escape'); } catch {}
      for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(1200); }

      const items = await page.$$eval('div[data-test-id="pin"], div[role="listitem"]', els =>
        els.map(el => {
          const img = el.querySelector('img');
          const a = el.querySelector('a[href*="/pin/"]');
          return img ? { src: img.src, alt: img.alt || '', pin: a ? a.href : '' } : null;
        }).filter(Boolean)
      );
      log(`  got ${items.length} tiles`);
      for (const it of items) {
        if (!it.src || seen.has(it.src)) continue;
        seen.add(it.src);
        candidates.push({ ...it, query: q });
      }
    } catch (e) { log(`  ERR ${e.message}`); }
  }

  log(`total candidates: ${candidates.length}`);

  // Score
  const scored = candidates.map(c => {
    const s = scoreCandidate([c.alt, c.query], brief);
    return { ...c, ...s };
  });

  // Strict pass first
  let kept = scored.filter(s => s.score >= 8 && Object.values(s.breakdown).filter(v => v > 0).length >= 4);
  // Relaxed fallback if thin
  if (kept.length < env.target) {
    const extra = scored
      .filter(s => !kept.includes(s) && s.score >= 6 && Object.values(s.breakdown).filter(v => v > 0).length >= 3)
      .map(s => ({ ...s, relaxed: true }));
    kept = [...kept, ...extra].slice(0, env.target * 2);
    log(`relaxed threshold added ${extra.length} extras`);
  }
  kept.sort((a, b) => b.score - a.score);
  kept = kept.slice(0, env.target);

  log(`survivors: ${kept.length}; downloading...`);
  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    // Try to resolve to /originals/
    const candidates = [c.src.replace(/\/\d+x(?:\d*)?\//, '/originals/'), c.src.replace(/\/\d+x(?:\d*)?\//, '/736x/'), c.src];
    let chosenUrl = null, bytes = 0;
    const slug = slugify(c.alt || c.query);
    const filename = `pinterest_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    for (const u of candidates) {
      try { bytes = await downloadImage(u, dest, { Referer: 'https://www.pinterest.com/' }); chosenUrl = u; break; } catch {}
    }
    if (!chosenUrl) { log(`  ${idx}. SKIP (no URL worked)`); continue; }

    entries.push({
      filename,
      source_url: chosenUrl,
      page_url: c.pin,
      query: c.query,
      description: c.alt || c.query,
      score: c.score,
      score_breakdown: c.breakdown,
      dimensions: '',
      relaxed: !!c.relaxed,
    });
    log(`  ${idx}. [${c.score}/12${c.relaxed ? ' R' : ''}] ${filename} (${bytes} B)`);
    await rateLimit(1200);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images written`);
})().catch(e => { console.error(e); process.exit(1); });

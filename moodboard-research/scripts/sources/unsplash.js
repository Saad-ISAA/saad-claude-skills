#!/usr/bin/env node
// Unsplash scraper. Plain HTTP returns 401, so Playwright.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest } = require('../_common');

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'unsplash');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const seen = new Map();
  for (const q of env.queries) {
    if (seen.size >= env.target * 3) break;
    const url = `https://unsplash.com/s/photos/${encodeURIComponent(q.replace(/\s+/g, '-'))}`;
    log(`SEARCH "${q}"`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2200);
      for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(1200); }
      const tiles = await page.$$eval('figure[itemprop="image"], figure a[itemprop="contentUrl"]', els =>
        els.map(el => {
          const img = el.querySelector ? el.querySelector('img') : null;
          const link = el.tagName === 'A' ? el : (el.querySelector ? el.querySelector('a[href*="/photos/"]') : null);
          return img ? { src: img.src, alt: img.alt || '', page: link ? link.href : '' } : null;
        }).filter(Boolean)
      );
      // Broader fallback if zero
      let items = tiles;
      if (!items.length) {
        items = await page.$$eval('img[src*="images.unsplash.com/photo-"]', els =>
          els.map(el => ({ src: el.src, alt: el.alt || '', page: '' }))
        );
      }
      log(`  got ${items.length}`);
      for (const it of items) {
        const id = (it.src.match(/photo-([\w-]+)/) || [])[1];
        if (!id || seen.has(id)) continue;
        seen.set(id, { ...it, query: q });
      }
    } catch (e) { log(`  ERR ${e.message}`); }
  }

  const scored = [...seen.values()].map(c => ({ ...c, ...scoreCandidate([c.alt, c.query], brief) }));
  let kept = scored.filter(s => passes(s, env.minThreshold, 4));
  kept.sort((a, b) => b.score - a.score);
  kept = kept.slice(0, env.target);
  log(`survivors: ${kept.length}; downloading...`);

  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    const id = (c.src.match(/photo-([\w-]+)/) || [])[1] || 'x';
    const big = `https://images.unsplash.com/photo-${id}?w=2400&q=85&fm=jpg&auto=format`;
    const slug = slugify(c.alt || c.query);
    const filename = `unsplash_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    try {
      const bytes = await downloadImage(big, dest, { Referer: 'https://unsplash.com/' });
      entries.push({
        filename, source_url: big, page_url: c.page || `https://unsplash.com/photos/${id}`, query: c.query,
        description: c.alt || c.query, score: c.score, score_breakdown: c.breakdown, dimensions: '',
      });
      log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    } catch (e) { log(`  ${idx}. SKIP ${e.message}`); }
    await rateLimit(1100);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

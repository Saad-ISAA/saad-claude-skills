#!/usr/bin/env node
// Dwell scraper. Editorial residential photography. Playwright.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest } = require('../_common');

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'dwell');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const seen = new Map();
  // Dwell has a few apartment listing endpoints + general search
  const endpoints = ['https://www.dwell.com/apartments', 'https://www.dwell.com/small-spaces'];
  // Also try query-driven search
  for (const q of env.queries) endpoints.push(`https://www.dwell.com/search?q=${encodeURIComponent(q)}`);

  for (const url of endpoints) {
    if (seen.size >= env.target * 3) break;
    log(`GET ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(1100); }
      const items = await page.$$eval('img', els =>
        els.map(el => ({ src: el.src || el.dataset.src || '', alt: el.alt || '', page: el.closest('a')?.href || '' }))
          .filter(x => x.src && /images\.dwell\.com/.test(x.src) && !/(icon|logo|favicon|touch)/i.test(x.src))
      );
      log(`  got ${items.length}`);
      for (const it of items) {
        const key = it.src.split('?')[0];
        if (seen.has(key)) continue;
        // Try to get larger variant: replace /medium/ /thumb/ with /large/
        const big = it.src.replace(/\/(thumbnail|medium|small)\//, '/large/').replace(/\/thumb\.jpg/, '/large.jpg');
        seen.set(key, { src: big, alt: it.alt, page: it.page });
      }
    } catch (e) { log(`  ERR ${e.message}`); }
  }

  const scored = [...seen.values()].map(c => ({ ...c, ...scoreCandidate([c.alt], brief) }));
  let kept = scored.filter(s => passes(s, env.minThreshold, 4));
  kept.sort((a, b) => b.score - a.score);
  kept = kept.slice(0, env.target);
  log(`survivors: ${kept.length}; downloading...`);

  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    const slug = slugify(c.alt);
    const filename = `dwell_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    try {
      const bytes = await downloadImage(c.src, dest, { Referer: 'https://www.dwell.com/' });
      if (bytes < 15_000) { fs.unlinkSync(dest); log(`  ${idx}. SKIP tiny`); continue; }
      entries.push({
        filename, source_url: c.src, page_url: c.page, query: '',
        description: c.alt, score: c.score, score_breakdown: c.breakdown, dimensions: '',
      });
      log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    } catch (e) { log(`  ${idx}. SKIP ${e.message}`); }
    await rateLimit(1000);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// Houzz scraper. Photographic, heavy lazy-loading. Playwright.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest } = require('../_common');

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'houzz');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const seen = new Map();
  for (const q of env.queries) {
    if (seen.size >= env.target * 3) break;
    const url = `https://www.houzz.com/photos/query/${encodeURIComponent(q.replace(/\s+/g, '-'))}`;
    log(`SEARCH "${q}"`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(1100); }
      const items = await page.$$eval('img', els =>
        els.map(el => ({ src: el.src || el.dataset.src || '', alt: el.alt || '', page: el.closest('a')?.href || '' }))
          .filter(x => x.src && /st\.hzcdn\.com/.test(x.src) && !/(apple-touch|sprite|logo|favicon|avatar)/i.test(x.src))
      );
      log(`  got ${items.length}`);
      for (const it of items) {
        // Resolve to higher resolution: replace size token like "/simgs/<hash>_4-<width>/" with larger
        const key = it.src.split('?')[0].replace(/_\d+-\d+/g, '');
        if (seen.has(key)) continue;
        // Replace small width with 4-1536 style for bigger
        const big = it.src.replace(/_\d+-(\d+)/, (_, w) => `_${Math.max(parseInt(w, 10), 1000)}`);
        seen.set(key, { src: big, alt: it.alt, page: it.page, query: q });
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
    const slug = slugify(c.alt || c.query);
    const filename = `houzz_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    try {
      const bytes = await downloadImage(c.src, dest, { Referer: 'https://www.houzz.com/' });
      // Reject tiny files (likely icons that snuck through)
      if (bytes < 10_000) { fs.unlinkSync(dest); log(`  ${idx}. SKIP tiny (${bytes} B)`); continue; }
      entries.push({
        filename, source_url: c.src, page_url: c.page, query: c.query,
        description: c.alt || c.query, score: c.score, score_breakdown: c.breakdown, dimensions: '',
      });
      log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    } catch (e) { log(`  ${idx}. SKIP ${e.message}`); }
    await rateLimit(900);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

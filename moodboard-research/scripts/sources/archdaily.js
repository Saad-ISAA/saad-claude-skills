#!/usr/bin/env node
// ArchDaily scraper. Editorial apartments. Playwright for search + project pages.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest } = require('../_common');

const AVOID_TITLE = /\b(villa|penthouse|mansion|tower|skyscraper|luxury|estate|chateau)\b/i;

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'archdaily');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const articleLinks = new Set();
  for (const q of env.queries) {
    if (articleLinks.size >= 60) break;
    const url = `https://www.archdaily.com/search/projects?q=${encodeURIComponent(q + ' apartment')}&categories=apartments`;
    log(`SEARCH "${q}"`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500);
      const links = await page.$$eval('a[href*="/9"], a[href*="/10"], a[href*="/11"]', els =>
        [...new Set(els.map(a => a.href).filter(h => /archdaily\.com\/\d+/.test(h)))]
      );
      for (const l of links) if (!AVOID_TITLE.test(l)) articleLinks.add(l);
      log(`  +${links.length} (total ${articleLinks.size})`);
    } catch (e) { log(`  ERR ${e.message}`); }
  }

  const articles = [...articleLinks].slice(0, 25);
  log(`opening ${articles.length} projects`);

  const candidates = [];
  for (const articleUrl of articles) {
    try {
      await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const title = await page.title();
      if (AVOID_TITLE.test(title)) { log(`  SKIP avoid: ${title.slice(0, 60)}`); continue; }
      const imgs = await page.$$eval('img', els =>
        els.map(el => ({ src: el.src || el.dataset.src || '', alt: el.alt || '' }))
          .filter(x => x.src && /images\.adsttc\.com\/media\/images\//.test(x.src))
      );
      log(`  ${title.slice(0,50)} imgs=${imgs.length}`);
      for (const im of imgs.slice(0, 5)) {
        const big = im.src.replace(/\/(thumb_jpg|medium_jpg|large_jpg|newsletter|small)\//, '/big/');
        candidates.push({ src: big, alt: im.alt, title, page_url: articleUrl });
      }
    } catch (e) { log(`  proj ERR ${e.message}`); }
  }

  // Dedupe + score + cap per-project
  const uniq = new Map();
  for (const c of candidates) if (!uniq.has(c.src)) uniq.set(c.src, c);
  const scored = [...uniq.values()].map(c => ({ ...c, ...scoreCandidate([c.alt, c.title], brief) }));
  let kept = scored.filter(s => passes(s, env.minThreshold, 4));
  kept.sort((a, b) => b.score - a.score);
  const perArticle = new Map();
  kept = kept.filter(k => { const n = perArticle.get(k.page_url) || 0; if (n >= 2) return false; perArticle.set(k.page_url, n + 1); return true; }).slice(0, env.target);
  log(`survivors: ${kept.length}; downloading...`);

  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    const slug = slugify(c.alt || c.title);
    const filename = `archdaily_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    try {
      const bytes = await downloadImage(c.src, dest, { Referer: 'https://www.archdaily.com/' });
      entries.push({
        filename, source_url: c.src, page_url: c.page_url, query: '',
        description: c.alt || c.title, score: c.score, score_breakdown: c.breakdown, dimensions: '',
      });
      log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    } catch (e) { log(`  ${idx}. SKIP ${e.message}`); }
    await rateLimit(900);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

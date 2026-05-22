#!/usr/bin/env node
// Dezeen scraper. Editorial design site. Playwright (HTTP returns 403).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest } = require('../_common');

const AVOID_TITLE = /\b(luxury villa|penthouse|mansion|tower|skyscraper|hotel suite)\b/i;

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'dezeen');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start; queries=${env.queries.length}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const articleLinks = new Set();
  for (const q of env.queries) {
    if (articleLinks.size >= 80) break;
    const url = `https://www.dezeen.com/?s=${encodeURIComponent(q + ' apartment')}`;
    log(`SEARCH "${q}" -> ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500);
      const links = await page.$$eval('a[href*="dezeen.com/20"]', els => [...new Set(els.map(a => a.href))]);
      for (const l of links) {
        if (/\/20\d\d\/\d\d\/\d\d\//.test(l) && !AVOID_TITLE.test(l)) articleLinks.add(l);
      }
      log(`  +${links.length} links (total ${articleLinks.size})`);
    } catch (e) { log(`  ERR ${e.message}`); }
  }

  const articles = [...articleLinks].slice(0, 30);
  log(`opening ${articles.length} articles`);

  const candidates = [];
  for (const articleUrl of articles) {
    try {
      await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const title = await page.title();
      if (AVOID_TITLE.test(title)) { log(`  SKIP avoid-list: ${title.slice(0, 60)}`); continue; }
      const imgs = await page.$$eval('article img, .post-content img, .article-body img', els =>
        els.map(el => ({ src: el.src || el.dataset.src || '', alt: el.alt || '' })).filter(x => x.src && /static\.dezeen\.com/.test(x.src))
      );
      log(`  ${articleUrl.split('/').slice(-2).join('/')} title="${title.slice(0,50)}" imgs=${imgs.length}`);
      for (const im of imgs) {
        // Strip size suffix (e.g. -sq2, -852x852) to get original
        const clean = im.src.replace(/-(?:sq2|sq|\d+x\d+)(\.\w+)$/, '$1');
        candidates.push({ src: clean, alt: im.alt, title, page_url: articleUrl, query: '' });
      }
    } catch (e) { log(`  article ERR ${e.message}`); }
  }
  log(`candidates: ${candidates.length}`);

  // Dedup by src
  const uniq = new Map();
  for (const c of candidates) if (!uniq.has(c.src)) uniq.set(c.src, c);
  const scored = [...uniq.values()].map(c => ({ ...c, ...scoreCandidate([c.alt, c.title], brief) }));
  let kept = scored.filter(s => passes(s, env.minThreshold, 4));
  kept.sort((a, b) => b.score - a.score);

  // Cap to 2 per article so we get variety
  const perArticle = new Map();
  kept = kept.filter(k => {
    const n = perArticle.get(k.page_url) || 0;
    if (n >= 2) return false;
    perArticle.set(k.page_url, n + 1);
    return true;
  }).slice(0, env.target);
  log(`survivors: ${kept.length}; downloading...`);

  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    const slug = slugify(c.alt || c.title);
    const filename = `dezeen_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    try {
      const bytes = await downloadImage(c.src, dest, { Referer: 'https://www.dezeen.com/' });
      entries.push({
        filename, source_url: c.src, page_url: c.page_url, query: '',
        description: c.alt || c.title, score: c.score, score_breakdown: c.breakdown, dimensions: '',
      });
      log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    } catch (e) { log(`  ${idx}. SKIP ${e.message}`); }
    await rateLimit(1000);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

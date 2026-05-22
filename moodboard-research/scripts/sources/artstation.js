#!/usr/bin/env node
// ArtStation scraper. 3D archviz interior renders. AGGRESSIVE avoid filtering.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest } = require('../_common');

const AVOID = /\b(luxury|penthouse|mansion|villa|sci-?fi|fantasy|futuristic|cyberpunk|gold|marble|chandelier)\b/i;

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'artstation');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start (3D renders, not photos)`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: env.UA, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const projectLinks = new Set();
  for (const q of env.queries) {
    if (projectLinks.size >= 50) break;
    const url = `https://www.artstation.com/search?query=${encodeURIComponent(q + ' interior archviz')}&sort_by=relevance`;
    log(`SEARCH "${q}"`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(4000);
      for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 2000); await page.waitForTimeout(1200); }
      const links = await page.$$eval('a[href*="/artwork/"]', els => [...new Set(els.map(a => a.href))]);
      for (const l of links) if (!AVOID.test(l)) projectLinks.add(l);
      log(`  +${links.length}`);
    } catch (e) { log(`  ERR ${e.message}`); }
  }

  const projects = [...projectLinks].slice(0, 20);
  log(`opening ${projects.length} projects`);

  const candidates = [];
  for (const projUrl of projects) {
    try {
      await page.goto(projUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500);
      const title = await page.title();
      if (AVOID.test(title)) { log(`  SKIP avoid: ${title.slice(0,60)}`); continue; }
      const imgs = await page.$$eval('img', els => els.map(el => ({ src: el.src || '', alt: el.alt || '' }))
        .filter(x => x.src && /cdna\.artstation\.com/.test(x.src) && /\/large\/|\/4k\/|\/medium\//.test(x.src))
      );
      log(`  "${title.slice(0,50)}" imgs=${imgs.length}`);
      for (const im of imgs.slice(0, 3)) {
        const big = im.src.replace(/\/(medium|large)\//, '/4k/');
        candidates.push({ src: big, fallback: im.src.replace(/\/(medium|4k)\//, '/large/'), alt: im.alt, title, page_url: projUrl });
      }
    } catch (e) { log(`  proj ERR ${e.message}`); }
  }

  const uniq = new Map();
  for (const c of candidates) if (!uniq.has(c.src)) uniq.set(c.src, c);
  const scored = [...uniq.values()].map(c => ({ ...c, ...scoreCandidate([c.alt, c.title], brief) }));
  let kept = scored.filter(s => passes(s, env.minThreshold, 4));
  kept.sort((a, b) => b.score - a.score);
  const perProj = new Map();
  kept = kept.filter(k => { const n = perProj.get(k.page_url) || 0; if (n >= 3) return false; perProj.set(k.page_url, n + 1); return true; }).slice(0, env.target);
  log(`survivors: ${kept.length}; downloading...`);

  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    const slug = slugify(c.alt || c.title);
    const filename = `artstation_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    let ok = false, used = null, bytes = 0;
    for (const u of [c.src, c.fallback].filter(Boolean)) {
      try { bytes = await downloadImage(u, dest, { Referer: 'https://www.artstation.com/' }); ok = true; used = u; break; } catch {}
    }
    if (!ok) { log(`  ${idx}. SKIP`); continue; }
    entries.push({
      filename, source_url: used, page_url: c.page_url, query: '',
      description: c.alt || c.title, score: c.score, score_breakdown: c.breakdown, dimensions: '',
    });
    log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    await rateLimit(1100);
  }

  writeManifest(env.outDir, entries);
  await browser.close();
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

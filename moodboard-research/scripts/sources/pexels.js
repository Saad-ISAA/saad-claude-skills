#!/usr/bin/env node
// Pexels scraper. Plain HTTP works.
const fs = require('fs');
const path = require('path');
const { getEnv, makeLogger, slugify, downloadImage, rateLimit, scoreCandidate, passes, writeManifest, UA } = require('../_common');

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

(async () => {
  const env = getEnv();
  const log = makeLogger(env.logFile, 'pexels');
  const brief = env.briefPath && fs.existsSync(env.briefPath) ? fs.readFileSync(env.briefPath, 'utf8') : '';
  log(`start`);

  const seen = new Map();
  for (const q of env.queries) {
    if (seen.size >= env.target * 3) break;
    const url = `https://www.pexels.com/search/${encodeURIComponent(q)}/`;
    log(`SEARCH "${q}"`);
    try {
      const html = await fetchHtml(url);
      // Image URLs look like https://images.pexels.com/photos/<id>/pexels-photo-<id>.<ext>?...
      // Also <article ... data-meta='...'> contains alt
      const imgRe = /https:\/\/images\.pexels\.com\/photos\/(\d+)\/[^"'\s)]+\.(?:jpe?g|webp)/gi;
      const matches = [...new Set(html.match(imgRe) || [])];
      // Alt text: scan <img alt="..." src="...pexels-photo-<id>"> patterns
      const altMap = {};
      const altRe = /<img[^>]*alt="([^"]+)"[^>]*src="[^"]*pexels-photo-(\d+)/gi;
      let m;
      while ((m = altRe.exec(html))) altMap[m[2]] = m[1];
      log(`  matches=${matches.length}`);
      for (const u of matches) {
        const id = (u.match(/photos\/(\d+)\//) || [])[1];
        if (!id || seen.has(id)) continue;
        const clean = u.split('?')[0]; // strip query params
        seen.set(id, { src: clean, id, alt: altMap[id] || '', query: q });
      }
    } catch (e) { log(`  ERR ${e.message}`); }
    await rateLimit(1100);
  }

  const scored = [...seen.values()].map(c => ({ ...c, ...scoreCandidate([c.alt, c.query], brief) }));
  let kept = scored.filter(s => passes(s, env.minThreshold, 4));
  kept.sort((a, b) => b.score - a.score);
  kept = kept.slice(0, env.target);
  log(`survivors: ${kept.length}`);

  const entries = [];
  let idx = 0;
  for (const c of kept) {
    idx++;
    const slug = slugify(c.alt || c.query);
    const filename = `pexels_${String(idx).padStart(2, '0')}_${slug}.jpg`;
    const dest = path.join(env.outDir, filename);
    try {
      const bytes = await downloadImage(c.src, dest, { Referer: 'https://www.pexels.com/' });
      entries.push({
        filename, source_url: c.src, page_url: `https://www.pexels.com/photo/${c.id}/`, query: c.query,
        description: c.alt || c.query, score: c.score, score_breakdown: c.breakdown, dimensions: '',
      });
      log(`  ${idx}. [${c.score}/12] ${filename} (${bytes} B)`);
    } catch (e) { log(`  ${idx}. SKIP ${e.message}`); }
    await rateLimit(1100);
  }

  writeManifest(env.outDir, entries);
  log(`done; ${entries.length} images`);
})().catch(e => { console.error(e); process.exit(1); });

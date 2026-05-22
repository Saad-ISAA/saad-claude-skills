#!/usr/bin/env node
// aggregate.js — merges per-source manifests, dedupes across sources via perceptual hash,
// writes _master_manifest.json and _contact_sheet.html.
//
// Usage:  node scripts/aggregate.js <output-root>

const fs = require('fs');
const path = require('path');
const { dhash, hamming } = require('./_phash');

const SOURCES_CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8'));

const SOURCE_LABEL = {
  pinterest: 'Pinterest',
  archdaily: 'ArchDaily',
  artstation: 'ArtStation (3D renders)',
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  arena: 'Are.na',
  dezeen: 'Dezeen',
  houzz: 'Houzz',
  dwell: 'Dwell',
  reddit: 'Reddit',
};

function loadManifests(base) {
  const all = [];
  for (const src of SOURCES_CFG.sources) {
    const manifestPath = path.join(base, src.id, 'manifest.json');
    if (!fs.existsSync(manifestPath)) { console.error(`[skip] no manifest for ${src.id}`); continue; }
    let raw;
    try { raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch (e) { console.error(`[err] parse fail for ${src.id}: ${e.message}`); continue; }
    let entries;
    if (Array.isArray(raw)) entries = raw;
    else if (raw && Array.isArray(raw.items)) entries = raw.items;
    else if (raw && Array.isArray(raw.images)) entries = raw.images;
    else if (raw && Array.isArray(raw.entries)) entries = raw.entries;
    else entries = [];
    if (!entries.length) { console.error(`[skip] empty manifest for ${src.id}`); continue; }
    for (const e of entries) {
      const filename = e.filename || e.file || e.fileName;
      if (!filename) continue;
      const filePath = path.join(base, src.id, filename);
      if (!fs.existsSync(filePath)) continue;
      const stat = fs.statSync(filePath);
      all.push({
        source: src.id,
        filename,
        rel_path: `${src.id}/${filename}`,
        abs_path: filePath,
        bytes: stat.size,
        source_url: e.source_url || e.image_url || '',
        page_url: e.page_url || e.project_url || e.url || '',
        query: e.query || '',
        description: e.description || e.title || e.alt || '',
        score: typeof e.score === 'number' ? e.score : 0,
        score_breakdown: e.score_breakdown || e.axes || {},
        dimensions: e.dimensions || '',
        channel: e.channel || '',
        relaxed: !!e.relaxed,
      });
    }
  }
  return all;
}

function htmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildContactSheet(kept, top10, perSourceCounts, base) {
  const tile = (it) => `
    <figure class="tile${it.relaxed ? ' relaxed' : ''}">
      <a href="${htmlEscape(it.page_url || it.source_url)}" target="_blank" rel="noopener">
        <img src="${htmlEscape(it.rel_path)}" loading="lazy" alt="${htmlEscape(it.description)}">
      </a>
      <figcaption>
        <div class="score">${it.score}/12${it.relaxed ? ' · relaxed' : ''}</div>
        <div class="fn">${htmlEscape(it.filename)}</div>
        <div class="desc">${htmlEscape(it.description)}</div>
      </figcaption>
    </figure>`;

  const sectionHtml = (srcId) => {
    const list = kept.filter(k => k.source === srcId).sort((a, b) => b.score - a.score);
    if (!list.length) return '';
    return `<section><h2>${htmlEscape(SOURCE_LABEL[srcId] || srcId)} <span class="count">(${list.length})</span></h2><div class="grid">${list.map(tile).join('')}</div></section>`;
  };

  const subParts = Object.entries(perSourceCounts).filter(([, n]) => n > 0).map(([s, n]) => `${SOURCE_LABEL[s] || s}: ${n}`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moodboard — Contact Sheet</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px; background: #1a1815; color: #e8e2d8; font: 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; letter-spacing: -0.01em; }
  .sub { color: #8b8276; margin-bottom: 24px; font-size: 13px; }
  h2 { font-size: 16px; font-weight: 600; margin: 36px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #2e2a25; }
  h2 .count { color: #8b8276; font-weight: 400; font-size: 13px; margin-left: 6px; }
  .grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 1280px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 800px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .tile { margin: 0; background: #25221d; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
  .tile img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; transition: transform .25s ease; }
  .tile a:hover img { transform: scale(1.04); }
  .tile figcaption { padding: 8px 10px; font-size: 11px; }
  .tile.relaxed { border: 1px dashed #5a4630; }
  .score { color: #d4b896; font-weight: 600; font-size: 11px; }
  .fn { color: #6e6757; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; margin-top: 2px; word-break: break-all; }
  .desc { color: #b8ad99; margin-top: 4px; line-height: 1.35; }
  .top-picks .tile { background: linear-gradient(180deg, #322b1f 0%, #25221d 100%); border: 1px solid #5a4a2e; }
  .top-picks h2 { color: #e8c787; border-bottom-color: #5a4a2e; }
</style>
</head>
<body>
  <h1>Moodboard — Contact Sheet</h1>
  <div class="sub">${kept.length} images · ${subParts.join(' · ')} · generated ${new Date().toLocaleString()}</div>
  <section class="top-picks">
    <h2>⭐ Top 10 Picks</h2>
    <div class="grid">${top10.map(tile).join('')}</div>
  </section>
  ${SOURCES_CFG.sources.map(s => sectionHtml(s.id)).join('\n')}
</body>
</html>`;
}

async function main() {
  const base = path.resolve(process.argv[2] || '.');
  if (!fs.existsSync(base)) { console.error(`No such directory: ${base}`); process.exit(2); }
  console.log(`Aggregating from ${base}`);

  const items = loadManifests(base);
  console.log(`Loaded ${items.length} entries across ${new Set(items.map(i => i.source)).size} sources`);

  console.log('Computing perceptual hashes...');
  for (const it of items) it.phash = await dhash(it.abs_path);
  const withHash = items.filter(i => i.phash);

  console.log('Deduplicating across sources (hamming ≤ 6)...');
  const kept = [];
  let dropped = 0;
  for (const it of withHash) {
    let isDup = false;
    for (let i = 0; i < kept.length; i++) {
      if (hamming(kept[i].phash, it.phash) <= 6) {
        if (it.score > kept[i].score) { dropped++; kept[i] = it; }
        else { dropped++; }
        isDup = true; break;
      }
    }
    if (!isDup) kept.push(it);
  }
  console.log(`Kept ${kept.length}, dropped ${dropped} duplicates`);

  kept.sort((a, b) => b.score - a.score);
  const top10 = kept.slice(0, 10);
  const perSource = {};
  for (const s of SOURCES_CFG.sources) perSource[s.id] = kept.filter(k => k.source === s.id).length;

  fs.writeFileSync(path.join(base, '_master_manifest.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    total_kept: kept.length,
    total_dropped_dup: dropped,
    per_source_counts: perSource,
    top_10: top10.map(t => ({ rel_path: t.rel_path, score: t.score, description: t.description, source: t.source })),
    items: kept,
  }, null, 2));
  fs.writeFileSync(path.join(base, '_contact_sheet.html'), buildContactSheet(kept, top10, perSource, base));

  console.log('\n=== SUMMARY ===');
  for (const s of SOURCES_CFG.sources) {
    const n = perSource[s.id];
    const avg = n ? (kept.filter(k => k.source === s.id).reduce((a, k) => a + k.score, 0) / n).toFixed(2) : '-';
    console.log(`  ${s.id.padEnd(18)} ${String(n).padStart(3)} images   avg ${avg}`);
  }
  console.log(`  TOTAL              ${String(kept.length).padStart(3)} images  (-${dropped} dupes)`);
  console.log('\n=== TOP 10 ===');
  top10.forEach((t, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${t.score}/12] ${t.rel_path}`);
    if (t.description) console.log(`      ${t.description.slice(0, 110)}`);
  });
  console.log(`\nContact sheet: ${path.join(base, '_contact_sheet.html')}`);
}

main().catch(e => { console.error(e); process.exit(1); });

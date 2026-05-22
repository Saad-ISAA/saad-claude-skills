// _common.js — shared helpers for source scrapers.
// Each scraper reads MB_OUTPUT_DIR, MB_LOG_FILE, MB_QUERIES, MB_TARGET, MB_MIN_THRESHOLD from env.

const fs = require('fs');
const path = require('path');
const { dhash, hamming } = require('./_phash');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function getEnv() {
  const outDir = process.env.MB_OUTPUT_DIR;
  const logFile = process.env.MB_LOG_FILE;
  if (!outDir || !logFile) throw new Error('MB_OUTPUT_DIR and MB_LOG_FILE must be set (run via orchestrate.js)');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  return {
    outDir,
    logFile,
    queries: JSON.parse(process.env.MB_QUERIES || '[]'),
    target: parseInt(process.env.MB_TARGET || '20', 10),
    minThreshold: parseInt(process.env.MB_MIN_THRESHOLD || '8', 10),
    briefPath: process.env.MB_BRIEF_PATH || '',
    UA,
  };
}

function makeLogger(logFile, prefix) {
  return (msg) => {
    const line = `[${new Date().toISOString()}] [${prefix}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    // Also stdout for orchestrator tail
    process.stdout.write(line);
  };
}

function slugify(s, words = 3) {
  return (s || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, words)
    .join('-') || 'untitled';
}

async function downloadImage(url, destPath, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, ...headers },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function dedupeByHash(filePaths, threshold = 6) {
  const hashes = [];
  const keep = [];
  for (const fp of filePaths) {
    const h = await dhash(fp);
    if (!h) { keep.push(fp); continue; }
    if (hashes.some(prev => hamming(prev, h) <= threshold)) continue;
    hashes.push(h);
    keep.push(fp);
  }
  return keep;
}

function rateLimit(ms = 1200) {
  return new Promise(r => setTimeout(r, ms));
}

// Generic keyword-based heuristic scorer for sources without rich metadata.
// Caller passes the candidate's textual signals (alt, title, query, channel name, etc.)
// and the brief contents. Returns {score, breakdown}.
function scoreCandidate(signals, brief) {
  const text = (signals || []).filter(Boolean).join(' ').toLowerCase();
  if (!text) return { score: 0, breakdown: { subject: 0, mood: 0, composition: 0, color: 0, style: 0, originality: 0 } };

  const b = (brief || '').toLowerCase();

  const SUBJECT_KEYS = ['apartment', 'interior', 'living', 'bedroom', 'kitchen', 'bathroom', 'home', 'flat', 'studio', 'room', 'dining', 'lounge'];
  const MOOD_KEYS = ['warm', 'cozy', 'cosy', 'inviting', 'soft', 'lived-in', 'lived in', 'snug', 'intimate', 'serene', 'calm'];
  const STYLE_KEYS = ['modern', 'contemporary', 'minimalist', 'minimal', 'scandi', 'scandinavian', 'japandi', 'mid-century', 'midcentury', 'clean lines'];
  const COLOR_KEYS = ['earthy', 'terracotta', 'ochre', 'taupe', 'beige', 'sage', 'cream', 'walnut', 'oak', 'muted', 'natural', 'warm tone'];
  const COMP_KEYS = ['layered', 'composed', 'framed', 'editorial', 'styled', 'curated'];

  const NEG_KEYS = ['luxury', 'penthouse', 'mansion', 'marble', 'gold fixture', 'chandelier', 'opulent', 'palatial', 'showroom'];

  const hits = (keys) => keys.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0);
  const briefBoost = (keys) => keys.reduce((acc, k) => acc + (b.includes(k) ? 1 : 0), 0);

  const subj = Math.min(2, hits(SUBJECT_KEYS) >= 1 ? 2 : 0);
  const mood = Math.min(2, hits(MOOD_KEYS) >= 1 ? 2 : (hits(MOOD_KEYS) > 0 ? 1 : 0));
  const style = Math.min(2, hits(STYLE_KEYS) >= 1 ? 2 : 0);
  const color = Math.min(2, hits(COLOR_KEYS) >= 1 ? 2 : 0);
  const comp = Math.min(2, hits(COMP_KEYS) >= 1 ? 1 : 0); // weak signal — default 0
  // originality: penalize negative keywords; baseline 1
  const negHits = hits(NEG_KEYS);
  const orig = Math.max(0, 1 - negHits);

  const breakdown = { subject: subj, mood, composition: comp, color, style, originality: orig };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score, breakdown };
}

function passes(scoreObj, minTotal = 8, minAxes = 4) {
  if (!scoreObj || typeof scoreObj.score !== 'number') return false;
  if (scoreObj.score < minTotal) return false;
  const nonZero = Object.values(scoreObj.breakdown || {}).filter(v => v > 0).length;
  return nonZero >= minAxes;
}

function writeManifest(outDir, entries) {
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(entries, null, 2));
}

module.exports = { getEnv, makeLogger, slugify, downloadImage, dedupeByHash, rateLimit, scoreCandidate, passes, writeManifest, UA };

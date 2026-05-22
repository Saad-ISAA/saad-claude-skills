#!/usr/bin/env node
// orchestrate.js — entry point. Parses brief, spawns source scrapers in parallel.
//
// Usage:  node scripts/orchestrate.js <output-root> [--skip=src1,src2]
//
// The output root MUST already contain _brief.md. The orchestrator extracts queries from a
// "## Queries" section (one query per line, leading "- " or numeric prefix tolerated).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const SOURCES_CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8'));

function usage(msg) {
  if (msg) console.error('Error:', msg);
  console.error('Usage: node scripts/orchestrate.js <output-root> [--skip=src1,src2] [--only=src1,src2]');
  process.exit(2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length || args[0].startsWith('--')) usage('output-root required');
  const outRoot = path.resolve(args[0]);
  let skip = [], only = [];
  for (const a of args.slice(1)) {
    if (a.startsWith('--skip=')) skip = a.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else if (a.startsWith('--only=')) only = a.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    else usage(`unknown arg ${a}`);
  }
  return { outRoot, skip, only };
}

function extractQueries(briefMd) {
  // Find a "## Queries" or "## Suggested Queries" section, take all non-empty bullet/numbered lines.
  const lines = briefMd.split(/\r?\n/);
  let inSection = false;
  const queries = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+(Suggested\s+)?Queries?\b/i.test(line)) { inSection = true; continue; }
    if (inSection) {
      if (/^##\s/.test(line)) break;
      const m = line.match(/^\s*(?:[-*]\s+|\d+[.)]\s+)?["']?(.+?)["']?\s*$/);
      if (!m || !m[1] || m[1].startsWith('#') || m[1].length < 3) continue;
      const q = m[1].replace(/^["']|["']$/g, '').trim();
      // Skip instructional placeholders / examples
      if (/[<>]/.test(q) || /^(e\.g\.|the orchestrator|one per line|<.*>)/i.test(q)) continue;
      queries.push(q);
    }
  }
  return [...new Set(queries)].slice(0, 16);
}

function runOne(source, ctx) {
  return new Promise((resolve) => {
    const outDir = path.join(ctx.outRoot, source.id);
    const logFile = path.join(ctx.outRoot, '_logs', `${source.id}.log`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const scriptPath = path.join(__dirname, source.script);
    if (!fs.existsSync(scriptPath)) {
      console.log(`[skip] ${source.id} — script not found at ${scriptPath}`);
      return resolve({ id: source.id, ok: false, reason: 'script_missing' });
    }

    const env = {
      ...process.env,
      MB_OUTPUT_DIR: outDir,
      MB_LOG_FILE: logFile,
      MB_QUERIES: JSON.stringify(ctx.queries),
      MB_TARGET: String(source.target),
      MB_MIN_THRESHOLD: String(source.min_threshold),
      MB_BRIEF_PATH: ctx.briefPath,
    };

    let cmd, args;
    if (source.runner === 'node') {
      cmd = 'node'; args = [scriptPath];
    } else if (source.runner === 'python') {
      // Use venv python if available
      const venvPy = path.join(SKILL_DIR, '.venv', 'bin', 'python');
      cmd = fs.existsSync(venvPy) ? venvPy : 'python3';
      args = [scriptPath];
    } else {
      return resolve({ id: source.id, ok: false, reason: `unknown runner ${source.runner}` });
    }

    const t0 = Date.now();
    console.log(`[start] ${source.id}`);
    const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdoutTail = '', stderrTail = '';
    child.stdout.on('data', d => { stdoutTail = (stdoutTail + d.toString()).slice(-1500); });
    child.stderr.on('data', d => { stderrTail = (stderrTail + d.toString()).slice(-1500); });

    child.on('close', (code) => {
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      // Count images in manifest
      let count = 0;
      const manifestPath = path.join(outDir, 'manifest.json');
      try {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const entries = Array.isArray(raw) ? raw : (raw.items || raw.images || raw.entries || []);
        count = entries.length;
      } catch {}
      const status = code === 0 ? '[done]' : '[fail]';
      console.log(`${status} ${source.id}  ${count} images  ${dt}s` + (code !== 0 ? ` (exit ${code})` : ''));
      if (code !== 0 && stderrTail) console.log(`        last stderr: ${stderrTail.split('\n').slice(-3).join(' | ')}`);
      resolve({ id: source.id, ok: code === 0, count, seconds: dt, code });
    });
  });
}

(async () => {
  const { outRoot, skip, only } = parseArgs();
  const briefPath = path.join(outRoot, '_brief.md');
  if (!fs.existsSync(briefPath)) {
    console.error(`No brief at ${briefPath}. Write one first (use templates/brief-template.md).`);
    process.exit(2);
  }
  fs.mkdirSync(path.join(outRoot, '_logs'), { recursive: true });
  const brief = fs.readFileSync(briefPath, 'utf8');
  const queries = extractQueries(brief);
  if (queries.length < 3) {
    console.error(`Brief at ${briefPath} has fewer than 3 queries in its "## Queries" section.`);
    process.exit(2);
  }

  let sources = SOURCES_CFG.sources;
  if (only.length) sources = sources.filter(s => only.includes(s.id));
  if (skip.length) sources = sources.filter(s => !skip.includes(s.id));

  console.log(`Output root: ${outRoot}`);
  console.log(`Queries (${queries.length}):`);
  queries.forEach(q => console.log(`  - ${q}`));
  console.log(`Sources (${sources.length}): ${sources.map(s => s.id).join(', ')}`);
  console.log('');

  const ctx = { outRoot, queries, briefPath };
  const t0 = Date.now();
  const results = await Promise.all(sources.map(s => runOne(s, ctx)));
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  console.log('=== Per-source totals ===');
  let total = 0;
  for (const r of results) {
    console.log(`  ${r.id.padEnd(18)} ${r.ok ? 'OK  ' : 'FAIL'}  ${String(r.count || 0).padStart(4)} images  ${r.seconds || '-'}s`);
    total += r.count || 0;
  }
  console.log(`  ${'TOTAL'.padEnd(18)}        ${String(total).padStart(4)} images   wall ${dt}s`);
  console.log('');
  console.log('Now run:  node scripts/aggregate.js ' + outRoot);
})();

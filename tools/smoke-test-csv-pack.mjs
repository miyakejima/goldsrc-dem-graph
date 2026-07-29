/**
 * smoke-test-csv-pack.mjs
 *
 * Module-level smoke test for buildCsvPack.
 * Usage:  node tools/smoke-test-csv-pack.mjs
 *
 * Asserts:
 *  1. Every CSV has a header row and at least expected rows.
 *  2. Every schema.csv (file, column) pair matches a real column header
 *     in the corresponding generated CSV.
 *  3. Two consecutive generations from identical payload produce
 *     byte-identical CSV text for every file.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── load sample payloads ──────────────────────────────────────────────────────

const PAYLOAD_LJ   = JSON.parse(readFileSync(resolve(__dirname, '../re_data/local_259_lj_propane.json'), 'utf8'));
const PAYLOAD_BARE = JSON.parse(readFileSync(resolve(__dirname, '../re_data/local_l_dem.json'), 'utf8'));

// ── import the module under test ──────────────────────────────────────────────

// We need to import the ES-module source directly. Since the source uses
// relative imports from upstream, resolve the path correctly.
const { buildCsvPack } = await import('../src/export/csv-pack.js');

// ── helpers ───────────────────────────────────────────────────────────────────

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  pass: ${message}`);
  }
}

function headerOf(csv) {
  return csv.split('\n')[0].split(',');
}

function rowsOf(csv) {
  const lines = csv.split('\n').filter(Boolean);
  return lines.slice(1); // skip header
}

function runChecks(label, payload) {
  console.log(`\n=== ${label} ===`);

  const graph      = payload.graph;
  const totalFrames = Number(payload.frames);
  const mapName    = String(payload.map_name || graph?.map_name || payload.file_name || 'unknown_map');

  const pack1 = buildCsvPack({ graph, totalFrames, mapName });
  const pack2 = buildCsvPack({ graph, totalFrames, mapName });

  const fileNames = [...pack1.files.keys()];
  assert(fileNames.length === 11, `file count is 11 (got ${fileNames.length})`);

  // 1. Each file has a header + at least 1 row (except commands.csv which may be empty for bare demos)
  for (const [name, csv] of pack1.files) {
    const header = headerOf(csv);
    const rows   = rowsOf(csv);
    assert(header.length >= 1, `${name}: has header columns`);
    if (name !== 'commands.csv' && name !== 'jumps.csv' && name !== 'jump_frames.csv' && name !== 'strafes.csv') {
      assert(rows.length >= 1, `${name}: has at least 1 data row (got ${rows.length})`);
    }
  }

  // 2. schema.csv coverage: every (file, column) maps to a real column
  const schemaCsv   = pack1.files.get('schema.csv');
  const schemaRows  = rowsOf(schemaCsv);
  const schemaHeader = headerOf(schemaCsv);
  const fileIdx   = schemaHeader.indexOf('file');
  const columnIdx = schemaHeader.indexOf('column');

  const NOT_AVAILABLE_KIND = 'not_available';
  const sourceKindIdx = schemaHeader.indexOf('source_kind');

  for (const row of schemaRows) {
    const cols       = row.split(',');
    const fileName   = cols[fileIdx]?.replace(/^"|"$/g, '');
    const colName    = cols[columnIdx]?.replace(/^"|"$/g, '');
    const sourceKind = cols[sourceKindIdx]?.replace(/^"|"$/g, '');

    if (!fileName || !colName) continue;
    // documentation-only rows (e.g., raw_mouse_counts) have source_kind = not_available
    // and should not appear as actual CSV column headers
    if (sourceKind === NOT_AVAILABLE_KIND) continue;

    const csv = pack1.files.get(fileName);
    if (!csv) {
      assert(false, `schema.csv references unknown file '${fileName}'`);
      continue;
    }
    const header = headerOf(csv);
    assert(
      header.includes(colName),
      `schema.csv '${fileName}'.column '${colName}' exists in CSV header`,
    );
  }


  // 3. Determinism: two generations from identical payload produce identical output
  for (const name of fileNames) {
    const text1 = pack1.files.get(name);
    const text2 = pack2.files.get(name);
    assert(text1 === text2, `${name}: deterministic (byte-identical on two runs)`);
  }

  // 4. Jump-count sanity
  const { jumpsCount, resolvedJumpSource } = pack1.summary;
  console.log(`  info: ${jumpsCount} jumps detected via '${resolvedJumpSource}'`);
  assert(typeof jumpsCount === 'number', 'jumpsCount is a number');
}

// ── run ───────────────────────────────────────────────────────────────────────

runChecks('259_lj_propane (longjumps available)', PAYLOAD_LJ);
runChecks('l.dem (longjumps empty → fallback)', PAYLOAD_BARE);

console.log('\nDone.');
if (process.exitCode === 1) {
  console.error('Some assertions FAILED.');
} else {
  console.log('All assertions passed.');
}

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const pairsDir = process.argv[2] || 're_data/pairs';
const parserBin = process.argv[3] || 'parser-rs/target/release/unique_graph_dem_parser.exe';

const absPairs = path.resolve(pairsDir);
const absParserBin = path.resolve(parserBin);

if (!fs.existsSync(absParserBin)) {
  console.error(`Parser binary not found: ${absParserBin}`);
  process.exit(1);
}

const ids = fs.readdirSync(absPairs).filter((id) => fs.statSync(path.join(absPairs, id)).isDirectory());

for (const id of ids) {
  const dir = path.join(absPairs, id);
  const localFileTxt = path.join(dir, 'local_file.txt');
  if (!fs.existsSync(localFileTxt)) continue;

  const demoPath = fs.readFileSync(localFileTxt, 'utf8').trim();
  if (!demoPath || !fs.existsSync(demoPath)) {
    console.warn(`Skipping ${id}: missing local demo path`);
    continue;
  }

  const outPath = path.join(dir, 'local-parse.json');
  const proc = spawnSync(absParserBin, ['--input', demoPath, '--output', outPath], {
    stdio: 'pipe',
    windowsHide: true,
  });

  if (proc.status !== 0) {
    console.error(`Failed ${id}: ${proc.stderr?.toString() || proc.stdout?.toString()}`);
    continue;
  }

  console.log(`Parsed ${id}`);
}

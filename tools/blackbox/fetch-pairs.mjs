import fs from 'node:fs';
import path from 'node:path';

const apiBase = process.env.UNIQUE_API_BASE || 'https://demo.unique-kz.net/api';
const authToken = process.env.UNIQUE_AUTH_TOKEN;
const mapFile = process.argv[2] || 're_data/batch_upload_map.jsonl';
const outDir = process.argv[3] || 're_data/pairs';

if (!authToken) {
  console.error('Missing UNIQUE_AUTH_TOKEN env var.');
  process.exit(1);
}

const absMapFile = path.resolve(mapFile);
const absOutDir = path.resolve(outDir);
if (!fs.existsSync(absMapFile)) {
  console.error(`Map file not found: ${absMapFile}`);
  process.exit(1);
}

fs.mkdirSync(absOutDir, { recursive: true });

const rows = fs.readFileSync(absMapFile, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((row) => row.ok && row.id);

const endpoints = ['demo', 'graph-info', 'graph', 'overview', 'entities', 'cvars', 'bugs'];

for (const row of rows) {
  const id = row.id;
  const dir = path.join(absOutDir, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'local_file.txt'), `${row.localFile}\n`);

  for (const ep of endpoints) {
    const rel = ep === 'demo' ? '' : `/${ep}`;
    const url = `${apiBase}/demo/${id}${rel}`;
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': authToken },
    });
    const text = await res.text();
    fs.writeFileSync(path.join(dir, `${ep}.json`), text);
    console.log(`${id} ${ep} ${res.status}`);
  }
}

console.log(`Done. Output dir: ${absOutDir}`);

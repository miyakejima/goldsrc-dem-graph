import fs from 'node:fs';
import path from 'node:path';

const apiBase = process.env.UNIQUE_API_BASE || 'https://demo.unique-kz.net/api';
const authToken = process.env.UNIQUE_AUTH_TOKEN;
const csrfToken = process.env.UNIQUE_CSRF_TOKEN || '';
const inputDir = process.argv[2];
const outFile = process.argv[3] || 're_data/batch_upload_map.jsonl';

if (!authToken) {
  console.error('Missing UNIQUE_AUTH_TOKEN env var.');
  process.exit(1);
}
if (!inputDir) {
  console.error('Usage: node tools/blackbox/upload-batch.mjs <demo-dir> [out-jsonl]');
  process.exit(1);
}

const absInputDir = path.resolve(inputDir);
const absOutFile = path.resolve(outFile);

if (!fs.existsSync(absInputDir)) {
  console.error(`Input dir not found: ${absInputDir}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(absOutFile), { recursive: true });
if (!fs.existsSync(absOutFile)) {
  fs.writeFileSync(absOutFile, '');
}

const done = new Set();
for (const line of fs.readFileSync(absOutFile, 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue;
  try {
    const row = JSON.parse(line);
    if (row.localFile) done.add(row.localFile);
  } catch {
    // ignore malformed lines
  }
}

const files = fs.readdirSync(absInputDir)
  .filter((name) => name.toLowerCase().endsWith('.dem'))
  .map((name) => path.join(absInputDir, name));

for (const filePath of files) {
  const abs = path.resolve(filePath);
  if (done.has(abs)) {
    continue;
  }

  const buf = fs.readFileSync(abs);
  const form = new FormData();
  form.append('file', new Blob([buf]), path.basename(abs));

  const res = await fetch(`${apiBase}/demos/upload`, {
    method: 'POST',
    headers: {
      'X-Auth-Token': authToken,
      'X-CSRF-Token': csrfToken,
    },
    body: form,
  });

  const text = await res.text();
  let row;

  try {
    const parsed = JSON.parse(text);
    const demo = parsed?.demos?.[0];

    row = {
      localFile: abs,
      ok: !!demo,
      id: demo?.id || '',
      filename: demo?.filename || '',
      message: demo?.message || parsed?.error || '',
      statusCode: res.status,
    };
  } catch {
    row = {
      localFile: abs,
      ok: false,
      id: '',
      filename: '',
      message: text.slice(0, 300),
      statusCode: res.status,
    };
  }

  fs.appendFileSync(absOutFile, `${JSON.stringify(row)}\n`);
  console.log(`${row.ok ? 'OK ' : 'ERR'} ${path.basename(abs)} -> ${row.id || row.statusCode}`);
}

console.log(`Done. Output: ${absOutFile}`);

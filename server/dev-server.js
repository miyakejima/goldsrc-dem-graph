import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARSER_DIR = path.join(ROOT, 'parser-rs');
const PARSER_BIN = path.join(
  PARSER_DIR,
  'target',
  'release',
  process.platform === 'win32' ? 'unique_graph_dem_parser.exe' : 'unique_graph_dem_parser',
);

let parserReadyPromise = null;

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed (${command} ${args.join(' ')}): ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function ensureParserReady() {
  if (fssync.existsSync(PARSER_BIN)) {
    return;
  }

  if (!parserReadyPromise) {
    const cargoCommand = process.platform === 'win32'
      ? (fssync.existsSync(path.join(process.env.USERPROFILE || '', '.cargo', 'bin', 'cargo.exe'))
        ? path.join(process.env.USERPROFILE || '', '.cargo', 'bin', 'cargo.exe')
        : 'cargo')
      : 'cargo';

    parserReadyPromise = runCommand(cargoCommand, ['build', '--release'], PARSER_DIR)
      .finally(() => {
        parserReadyPromise = null;
      });
  }

  await parserReadyPromise;

  if (!fssync.existsSync(PARSER_BIN)) {
    throw new Error('Parser binary build completed, but binary was not found.');
  }
}

async function start() {
  const app = express();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 1024 * 1024 * 200,
    },
  });

  app.post('/api/parse-dem', upload.single('demo'), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Missing demo file. Field name must be demo.' });
      return;
    }

    if (!file.originalname.toLowerCase().endsWith('.dem')) {
      res.status(400).json({ error: 'Only .dem files are supported.' });
      return;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unique-graph-'));
    const demoPath = path.join(tempDir, file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_'));
    const outPath = path.join(tempDir, 'graph.json');

    try {
      await ensureParserReady();
      await fs.writeFile(demoPath, file.buffer);

      await runCommand(PARSER_BIN, ['--input', demoPath, '--output', outPath], PARSER_DIR);

      const text = await fs.readFile(outPath, 'utf8');
      const payload = JSON.parse(text);

      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: error?.message || String(error) });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  const vite = await createViteServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = Number(process.env.PORT || 5173);
  app.listen(port, () => {
    console.log(`unique-graph-local-tester running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

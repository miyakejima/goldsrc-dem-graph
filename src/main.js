import './style.css';
import Graph from './upstream/pages/demo/graph/graph.js';
import screenfull from 'screenfull';
import FontFaceObserver from 'fontfaceobserver';

import { buildCsvPack } from './export/csv-pack.js';
import JSZip from 'jszip';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="panel">
    <label>
      Upload .dem file
      <input id="demoFile" type="file" accept=".dem,application/octet-stream" />
    </label>
    <button id="loadBtn">Parse + Load Graph</button>
    <button id="exportCsvPackBtn" disabled>Export Everything CSV Pack</button>
    <button id="destroyBtn">Destroy</button>
  </div>
  <div class="status" id="status">Waiting for demo file.</div>
  <div class="canvas-wrap">
    <canvas id="graphCanvas"></canvas>
  </div>
  <div class="hint">
    Fully local/offline parsing path. No unique-kz API calls are used.
  </div>
`;

const demoFileInput = document.querySelector('#demoFile');
const loadBtn = document.querySelector('#loadBtn');
const exportCsvPackBtn = document.querySelector('#exportCsvPackBtn');
const destroyBtn = document.querySelector('#destroyBtn');
const statusEl = document.querySelector('#status');
const canvas = document.querySelector('#graphCanvas');
const canvasWrap = document.querySelector('.canvas-wrap');

let graphInstance = null;
let loadedPayload = null;
let fontsReady = false;
let detachResize = () => {};

function setStatus(message) {
  statusEl.textContent = message;
}

function calcDims(canvasEl) {
  const minHeight = 650;
  const maxHeight = 750;
  const minWidth = Math.floor((minHeight * 16) / 9);
  const maxWidth = Math.floor((maxHeight * 16) / 9);
  let width = canvasEl.parentNode.clientWidth;
  width = Math.max(minWidth, Math.min(maxWidth, width));
  let height = (width / 16) * 9;
  height = Math.min(maxHeight, height);
  height = Math.max(minHeight, height);
  return [Math.floor(width), Math.floor(height)];
}

function applyCanvasPlacement(width, height, isFullscreen) {
  if (!canvasWrap) return;

  if (isFullscreen) {
    canvasWrap.style.width = '';
    canvasWrap.style.height = '';
    return;
  }

  // Mirror upstream page feel: fixed graph block width, no stretch.
  canvasWrap.style.width = `${width}px`;
  canvasWrap.style.height = `${height}px`;
}

async function ensureFontsLoaded() {
  if (fontsReady) return;

  await Promise.all([
    new FontFaceObserver('Roboto', { weight: 400 }).load(),
    new FontFaceObserver('Roboto', { weight: 700 }).load(),
  ]);

  fontsReady = true;
}

function destroyGraph() {
  detachResize();
  detachResize = () => {};

  if (graphInstance) {
    try {
      graphInstance.destroy();
    } catch {
      // ignore
    }
    graphInstance = null;
  }

  loadedPayload = null;
  exportCsvPackBtn.disabled = true;
}

function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function triggerZipDownload(filename, files) {
  const zip = new JSZip();
  for (const [name, content] of files) {
    zip.file(name, content);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}



async function exportCsvPack() {
  try {
    if (!loadedPayload?.graph || !Number.isFinite(loadedPayload?.frames)) {
      throw new Error('Load a demo first.');
    }

    setStatus('Building CSV pack…');
    exportCsvPackBtn.disabled = true;

    const mapName = String(
      loadedPayload.map_name ||
      loadedPayload.graph?.map_name ||
      loadedPayload.file_name ||
      'unknown_map',
    );

    const pack = buildCsvPack({
      graph: loadedPayload.graph,
      totalFrames: loadedPayload.frames,
      mapName,
    });

    const safeMap = mapName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
    const zipName = `csv_pack_${safeMap}.zip`;

    setStatus(`Compressing ${pack.files.size} files into ${zipName}…`);
    await triggerZipDownload(zipName, pack.files);

    const { jumpsCount, jumpFramesCount, strafesCount, resolvedJumpSource } = pack.summary;
    setStatus(
      `Exported CSV Pack: ${pack.files.size} files, ` +
      `${loadedPayload.frames.toLocaleString()} frames, ` +
      `${jumpsCount} jumps (${resolvedJumpSource}), ` +
      `${jumpFramesCount} jump-frames, ` +
      `${strafesCount} strafe segments.`,
    );
  } catch (error) {
    setStatus(`Failed: ${error?.message || String(error)}`);
    console.error(error);
  } finally {
    exportCsvPackBtn.disabled = false;
  }
}

async function parseDemoFile(file) {
  const formData = new FormData();
  formData.append('demo', file, file.name);

  const res = await fetch('/api/parse-dem', {
    method: 'POST',
    body: formData,
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `Parse failed (${res.status})`);
  }

  return body;
}

async function loadGraphFromDemo() {
  try {
    const file = demoFileInput.files?.[0];
    if (!file) {
      throw new Error('Select a .dem file first.');
    }

    setStatus('Parsing demo file locally...');
    const payload = await parseDemoFile(file);

    const frames = Number(payload?.frames);
    const graphPayload = payload?.graph;
    const mapName = String(payload?.map_name || graphPayload?.map_name || 'unknown_map');

    if (!Number.isFinite(frames) || frames <= 0) {
      throw new Error('Parser returned invalid frame count.');
    }
    if (!graphPayload || typeof graphPayload !== 'object') {
      throw new Error('Parser returned invalid graph payload.');
    }

    destroyGraph();
    await ensureFontsLoaded();

    setStatus(`Initializing graph (${frames.toLocaleString()} frames)...`);

    graphInstance = new Graph();
    graphInstance.init(canvas, frames, graphPayload);
    loadedPayload = {
      frames,
      map_name: mapName,
      graph: graphPayload,
      file_name: file.name,
    };
    exportCsvPackBtn.disabled = false;

    const doResize = () => {
      if (!graphInstance) return;

      let w;
      let h;
      if (screenfull.isFullscreen) {
        w = Math.floor(window.innerWidth);
        h = Math.floor(window.innerHeight);
      } else {
        [w, h] = calcDims(canvas);
      }

      applyCanvasPlacement(w, h, screenfull.isFullscreen);
      graphInstance.resize(w, h);
    };
    doResize();

    const onResize = () => doResize();
    window.addEventListener('resize', onResize);

    let onFullscreen = null;
    if (screenfull.isEnabled) {
      onFullscreen = () => doResize();
      screenfull.on('change', onFullscreen);
    }

    detachResize = () => {
      window.removeEventListener('resize', onResize);
      if (onFullscreen && screenfull.isEnabled) {
        screenfull.off('change', onFullscreen);
      }
    };

    setStatus(`Loaded successfully. Map: ${mapName}. Frames: ${frames.toLocaleString()}`);
  } catch (error) {
    setStatus(`Failed: ${error?.message || String(error)}`);
    console.error(error);
  }
}

loadBtn.addEventListener('click', loadGraphFromDemo);

exportCsvPackBtn.addEventListener('click', exportCsvPack);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
destroyBtn.addEventListener('click', () => {
  destroyGraph();
  setStatus('Destroyed graph instance.');
});

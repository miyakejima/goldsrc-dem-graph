import fs from 'node:fs';
import path from 'node:path';

const pairsDir = process.argv[2] || 're_data/pairs';
const outCsv = process.argv[3] || 're_data/canonical_parity_report.csv';

const absPairs = path.resolve(pairsDir);
const absCsv = path.resolve(outCsv);

const FLAGS = {
  ONGROUND: 1 << 9,
  DUCKING: 1 << 14,
};

const BUTTONS = {
  JUMP: 1 << 1,
  DUCK: 1 << 2,
  FORWARD: 1 << 3,
  BACK: 1 << 4,
  USE: 1 << 5,
  MOVELEFT: 1 << 9,
  MOVERIGHT: 1 << 10,
};

function expandDelta(obj, frames) {
  const out = new Array(frames + 1);
  let last = 0;
  for (let i = 0; i <= frames; i++) {
    if (Object.prototype.hasOwnProperty.call(obj, String(i))) {
      last = Number(obj[String(i)]);
    }
    out[i] = last;
  }
  return out;
}

function scoreBool(a, b, frames) {
  let n = 0;
  let eq = 0;
  for (let i = 1; i <= frames; i++) {
    n++;
    if (!!a[i] === !!b[i]) eq++;
  }
  return n ? eq / n : 0;
}

function parseCanonicalEventMask(canonical, row, frames) {
  const out = new Array(frames + 1).fill(false);
  const events = canonical?.events || [];
  for (const event of events) {
    if (event?.kind !== 'segment' || event?.row !== row) continue;
    const start = Math.max(1, Math.min(frames, Number(event.startFrame || 0)));
    const end = Math.max(1, Math.min(frames, Number(event.endFrame || 0)));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    for (let i = start; i <= end; i++) out[i] = true;
  }
  return out;
}

function parseCanonicalJumpLineFrames(canonical, frames) {
  const out = new Set();
  const events = canonical?.events || [];
  for (const event of events) {
    if (event?.kind !== 'jump_command_line') continue;
    const frame = Number(event.frame || 0);
    if (Number.isFinite(frame) && frame >= 1 && frame <= frames) {
      out.add(frame);
    }
  }
  return out;
}

function getGtJumpLineFrames(gt, frames) {
  const out = new Set();
  const commands = gt?.commands || {};

  for (let frame = 1; frame <= frames; frame++) {
    const currentCommands = String(commands[frame] || "")
      .toLowerCase()
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean);
    if (currentCommands.includes('+jump') || currentCommands.includes('-jump')) {
      out.add(frame);
    }
  }
  return out;
}

function setScore(a, b) {
  const all = new Set([...a, ...b]);
  if (!all.size) return 1;
  let eq = 0;
  for (const v of all) {
    if (a.has(v) === b.has(v)) eq++;
  }
  return eq / all.size;
}

function countSimilarity(a, b) {
  const av = a.size;
  const bv = b.size;
  const max = Math.max(av, bv, 1);
  return 1 - Math.abs(av - bv) / max;
}

function getGtMasks(gt, frames) {
  const buttons = gt?.cmd?.buttons || [];
  const flags = expandDelta(gt?.cd?.flags || {}, frames);
  const bInDuck = expandDelta(gt?.cd?.bInDuck || {}, frames);
  const movetype = expandDelta(gt?.esp?.movetype || {}, frames);

  const m = {
    jump: new Array(frames + 1).fill(false),
    ground: new Array(frames + 1).fill(false),
    duck: new Array(frames + 1).fill(false),
    duckstate2: new Array(frames + 1).fill(false),
    use: new Array(frames + 1).fill(false),
    forward: new Array(frames + 1).fill(false),
    back: new Array(frames + 1).fill(false),
    moveleft: new Array(frames + 1).fill(false),
    moveright: new Array(frames + 1).fill(false),
    movetype_toss: new Array(frames + 1).fill(false),
  };

  for (let i = 1; i <= frames; i++) {
    const btn = Number(buttons[i] || 0);
    const fl = Number(flags[i] || 0);
    m.jump[i] = (btn & BUTTONS.JUMP) !== 0;
    m.ground[i] = (fl & FLAGS.ONGROUND) !== 0;
    m.duck[i] = (btn & BUTTONS.DUCK) !== 0;
    m.duckstate2[i] = Number(bInDuck[i] || 0) === 0 && (fl & FLAGS.DUCKING) !== 0;
    m.use[i] = (btn & BUTTONS.USE) !== 0;
    m.forward[i] = (btn & BUTTONS.FORWARD) !== 0;
    m.back[i] = (btn & BUTTONS.BACK) !== 0;
    m.moveleft[i] = (btn & BUTTONS.MOVELEFT) !== 0;
    m.moveright[i] = (btn & BUTTONS.MOVERIGHT) !== 0;
    m.movetype_toss[i] = Number(movetype[i] || 0) === 6;
  }
  return m;
}

const ids = fs.readdirSync(absPairs).filter((id) => fs.statSync(path.join(absPairs, id)).isDirectory());
const rows = [];

for (const id of ids) {
  const dir = path.join(absPairs, id);
  const graphPath = path.join(dir, 'graph.json');
  const localParsePath = path.join(dir, 'local-parse.json');
  if (!fs.existsSync(graphPath) || !fs.existsSync(localParsePath)) continue;

  const gtRaw = fs.readFileSync(graphPath, 'utf8');
  if (gtRaw.trimStart().startsWith('<')) continue;
  const gt = JSON.parse(gtRaw);
  const lpWrap = JSON.parse(fs.readFileSync(localParsePath, 'utf8'));
  const frames = Math.min(Number(gt.frames || 0), Number(lpWrap.frames || 0));
  if (!frames) continue;

  const canonical = lpWrap.graphCanonicalV1 || lpWrap.graph?.graphCanonicalV1;
  if (!canonical) continue;

  const gtMasks = getGtMasks(gt, frames);
  const row = { id, frames };
  for (const key of Object.keys(gtMasks)) {
    const localMask = parseCanonicalEventMask(canonical, key, frames);
    row[`c_${key}`] = scoreBool(gtMasks[key], localMask, frames);
  }

  const gtJumpLines = getGtJumpLineFrames(gt, frames);
  const localJumpLines = parseCanonicalJumpLineFrames(canonical, frames);
  row.c_jump_lines = countSimilarity(gtJumpLines, localJumpLines);
  row.c_techniques_count = (() => {
    const gtCount = (gt.longjumps?.length || 0) + (gt.kz_bugs?.edge_bugs?.length || 0);
    const localCount = (canonical.techniques || []).length;
    const max = Math.max(gtCount, localCount, 1);
    return 1 - Math.abs(gtCount - localCount) / max;
  })();
  rows.push(row);
}

if (!rows.length) {
  console.error('No comparable canonical pairs found.');
  process.exit(1);
}

const header = Object.keys(rows[0]);
const csv = [header.join(',')].concat(rows.map((row) => header.map((key) => row[key]).join(','))).join('\n');
fs.mkdirSync(path.dirname(absCsv), { recursive: true });
fs.writeFileSync(absCsv, csv);

console.log(`Pairs: ${rows.length}`);
console.log(`Wrote: ${absCsv}`);
for (const key of header.filter((k) => k.startsWith('c_'))) {
  const avg = rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
  console.log(`${key} avg=${avg.toFixed(4)}`);
}

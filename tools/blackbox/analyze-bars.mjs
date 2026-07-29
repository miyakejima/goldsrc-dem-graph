import fs from 'node:fs';
import path from 'node:path';

const pairsDir = process.argv[2] || 're_data/pairs';
const outCsv = process.argv[3] || 're_data/bar_match_report.csv';

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

const MOVE = {
  NONE: 0,
  FLY: 5,
  TOSS: 6,
  NOCLIP: 8,
};

function expandDelta(obj, frames) {
  const out = new Array(frames + 1);
  let last;
  for (let i = 0; i <= frames; i++) {
    if (Object.prototype.hasOwnProperty.call(obj, String(i))) {
      last = Number(obj[String(i)]);
    }
    out[i] = last;
  }
  return out;
}

function scoreMask(a, b, frames) {
  let n = 0;
  let eq = 0;
  for (let i = 1; i <= frames; i++) {
    n++;
    if (!!a[i] === !!b[i]) eq++;
  }
  return n ? eq / n : 0;
}

function makeTechniqueMask(graph, frames) {
  const out = new Array(frames + 1).fill(false);
  const all = []
    .concat(graph.longjumps || [])
    .concat(graph.kz_bugs?.jump_bugs || [])
    .concat(graph.kz_bugs?.edge_bugs || [])
    .concat(graph.kz_bugs?.slide_bugs || [])
    .concat(graph.kz_bugs?.duck_bugs || []);

  for (const t of all) {
    const s = Number(t.jumpoffFrame ?? t.inAirSinceFrame ?? t.frame ?? 0);
    const e = Number(t.landingFrame ?? t.frame ?? s);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    const start = Math.max(1, Math.min(frames, Math.min(s, e)));
    const end = Math.max(1, Math.min(frames, Math.max(s, e)));
    for (let i = start; i <= end; i++) out[i] = true;
  }
  return out;
}

function collectMasks(graph, frames) {
  const buttons = graph.cmd.buttons || [];
  const iuser3 = expandDelta(graph.cd.iuser3 || {}, frames);
  const flags = expandDelta(graph.cd.flags || {}, frames);
  const bInDuck = expandDelta(graph.cd.bInDuck || {}, frames);
  const movetype = expandDelta(graph.esp.movetype || {}, frames);

  const m = {
    freezetime: new Array(frames + 1).fill(false),
    use: new Array(frames + 1).fill(false),
    jump: new Array(frames + 1).fill(false),
    ground: new Array(frames + 1).fill(false),
    duck: new Array(frames + 1).fill(false),
    duckstate1: new Array(frames + 1).fill(false),
    duckstate2: new Array(frames + 1).fill(false),
    forward: new Array(frames + 1).fill(false),
    back: new Array(frames + 1).fill(false),
    moveleft: new Array(frames + 1).fill(false),
    moveright: new Array(frames + 1).fill(false),
    movetype_none: new Array(frames + 1).fill(false),
    movetype_fly: new Array(frames + 1).fill(false),
    movetype_toss: new Array(frames + 1).fill(false),
    movetype_noclip: new Array(frames + 1).fill(false),
    techniques: makeTechniqueMask(graph, frames),
  };

  for (let i = 1; i <= frames; i++) {
    const btn = Number(buttons[i] || 0);
    const fl = Number(flags[i] || 0);
    const iu3 = Number(iuser3[i] || 0);
    const bduck = Number(bInDuck[i] || 0) !== 0;
    const flDuck = (fl & FLAGS.DUCKING) !== 0;
    const mv = Number(movetype[i]);

    m.freezetime[i] = (iu3 & (1 << 1)) !== 0;
    m.use[i] = (btn & BUTTONS.USE) !== 0;
    m.jump[i] = (btn & BUTTONS.JUMP) !== 0;
    m.duck[i] = (btn & BUTTONS.DUCK) !== 0;
    m.forward[i] = (btn & BUTTONS.FORWARD) !== 0;
    m.back[i] = (btn & BUTTONS.BACK) !== 0;
    m.moveleft[i] = (btn & BUTTONS.MOVELEFT) !== 0;
    m.moveright[i] = (btn & BUTTONS.MOVERIGHT) !== 0;
    m.ground[i] = (fl & FLAGS.ONGROUND) !== 0;
    m.duckstate1[i] = bduck && !flDuck;
    m.duckstate2[i] = !bduck && flDuck;
    m.movetype_none[i] = mv === MOVE.NONE;
    m.movetype_fly[i] = mv === MOVE.FLY;
    m.movetype_toss[i] = mv === MOVE.TOSS;
    m.movetype_noclip[i] = mv === MOVE.NOCLIP;
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
  const lp = lpWrap.graph;
  const frames = Math.min(Number(gt.frames || 0), Number(lpWrap.frames || 0));
  if (!frames) continue;

  const gtMask = collectMasks(gt, frames);
  const lpMask = collectMasks(lp, frames);

  const row = { id, frames };
  for (const key of Object.keys(gtMask)) {
    row[`b_${key}`] = scoreMask(gtMask[key], lpMask[key], frames);
  }
  rows.push(row);
}

if (!rows.length) {
  console.error('No comparable pairs found.');
  process.exit(1);
}

const header = Object.keys(rows[0]);
const csv = [header.join(',')].concat(rows.map((row) => header.map((key) => row[key]).join(','))).join('\n');
fs.mkdirSync(path.dirname(absCsv), { recursive: true });
fs.writeFileSync(absCsv, csv);

console.log(`Pairs: ${rows.length}`);
console.log(`Wrote: ${absCsv}`);

for (const key of header.filter((k) => k.startsWith('b_'))) {
  const avg = rows.reduce((s, r) => s + Number(r[key] || 0), 0) / rows.length;
  console.log(`${key} avg=${avg.toFixed(4)}`);
}

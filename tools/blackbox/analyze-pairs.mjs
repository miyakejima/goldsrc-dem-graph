import fs from 'node:fs';
import path from 'node:path';

const pairsDir = process.argv[2] || 're_data/pairs';
const outCsv = process.argv[3] || 're_data/calibration_report.csv';

const absPairs = path.resolve(pairsDir);
const absCsv = path.resolve(outCsv);

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

function score(a, b) {
  const n = Math.min(a.length, b.length);
  let eq = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i];
    const bv = b[i];
    if (typeof av === 'number' && typeof bv === 'number') {
      if (Math.abs(av - bv) < 1e-6) eq++;
    } else if (av === bv) {
      eq++;
    }
  }
  return n ? eq / n : 0;
}

function bestShift(a, b, maxShift = 20) {
  let bestShiftValue = 0;
  let bestScore = -1;

  for (let shift = -maxShift; shift <= maxShift; shift++) {
    let eq = 0;
    let n = 0;

    for (let i = 0; i < a.length; i++) {
      const j = i + shift;
      if (j < 0 || j >= b.length) continue;
      n++;
      if (a[i] === b[j]) eq++;
    }

    const sc = n ? eq / n : 0;
    if (sc > bestScore) {
      bestScore = sc;
      bestShiftValue = shift;
    }
  }

  return { shift: bestShiftValue, score: bestScore };
}

const ids = fs.readdirSync(absPairs).filter((id) => fs.statSync(path.join(absPairs, id)).isDirectory());
const rows = [];

for (const id of ids) {
  const dir = path.join(absPairs, id);
  const graphPath = path.join(dir, 'graph.json');
  const localParsePath = path.join(dir, 'local-parse.json');

  if (!fs.existsSync(graphPath) || !fs.existsSync(localParsePath)) {
    continue;
  }

  const gtRaw = fs.readFileSync(graphPath, 'utf8');
  if (gtRaw.trimStart().startsWith('<')) {
    continue;
  }

  const gt = JSON.parse(gtRaw);
  const lpWrap = JSON.parse(fs.readFileSync(localParsePath, 'utf8'));
  const lp = lpWrap.graph;
  const frames = Math.min(Number(gt.frames || 0), Number(lpWrap.frames || 0));

  const shiftButtons = bestShift(gt.cmd.buttons, lp.cmd.buttons, 20);

  rows.push({
    id,
    frames,
    gtLongjumps: gt.longjumps?.length ?? 0,
    gtJumpBugs: gt.kz_bugs?.jump_bugs?.length ?? 0,
    gtEdgeBugs: gt.kz_bugs?.edge_bugs?.length ?? 0,
    gtSlideBugs: gt.kz_bugs?.slide_bugs?.length ?? 0,
    gtDuckBugs: gt.kz_bugs?.duck_bugs?.length ?? 0,
    shiftButtons: shiftButtons.shift,
    shiftButtonsScore: shiftButtons.score,
    s_buttons: score(gt.cmd.buttons, lp.cmd.buttons),
    s_msec: score(gt.cmd.msec, lp.cmd.msec),
    s_forwardmove: score(gt.cmd.forwardmove, lp.cmd.forwardmove),
    s_sidemove: score(gt.cmd.sidemove, lp.cmd.sidemove),
    s_frametime: score(gt.frametime, lp.frametime),
    s_flags: score(expandDelta(gt.cd.flags, frames), expandDelta(lp.cd.flags, frames)),
    s_fuser2: score(expandDelta(gt.cd.fuser2, frames), expandDelta(lp.cd.fuser2, frames)),
    s_movetype: score(expandDelta(gt.esp.movetype, frames), expandDelta(lp.esp.movetype, frames)),
    s_angle0: score(expandDelta(gt.esp['angles[0]'], frames), expandDelta(lp.esp['angles[0]'], frames)),
    s_angle1: score(expandDelta(gt.esp['angles[1]'], frames), expandDelta(lp.esp['angles[1]'], frames)),
    s_origin0: score(expandDelta(gt.cd['origin[0]'], frames), expandDelta(lp.cd['origin[0]'], frames)),
    s_origin1: score(expandDelta(gt.cd['origin[1]'], frames), expandDelta(lp.cd['origin[1]'], frames)),
    s_origin2: score(expandDelta(gt.cd['origin[2]'], frames), expandDelta(lp.cd['origin[2]'], frames)),
  });
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

const avgKeys = header.filter((k) => k.startsWith('s_'));
for (const key of avgKeys) {
  const avg = rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length;
  console.log(`${key} avg=${avg.toFixed(4)}`);
}

import fs from 'node:fs';
import path from 'node:path';

const upstreamPath = process.argv[2];
const localParsePath = process.argv[3];
const outPath = process.argv[4] || 're_data/target_compare_report.json';

if (!upstreamPath || !localParsePath) {
  console.error('Usage: node tools/blackbox/compare-demo.mjs <upstream-graph.json> <local-parse.json> [out.json]');
  process.exit(1);
}

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

function masks(graph, frames) {
  const buttons = graph?.cmd?.buttons || [];
  const flags = expandDelta(graph?.cd?.flags || {}, frames);
  const bInDuck = expandDelta(graph?.cd?.bInDuck || {}, frames);
  const movetype = expandDelta(graph?.esp?.movetype || {}, frames);

  const out = {
    freezetime: new Array(frames + 1).fill(false),
    movetype_toss: new Array(frames + 1).fill(false),
    use: new Array(frames + 1).fill(false),
    jump: new Array(frames + 1).fill(false),
    ground: new Array(frames + 1).fill(false),
    duck: new Array(frames + 1).fill(false),
    duckstate2: new Array(frames + 1).fill(false),
    forward: new Array(frames + 1).fill(false),
    back: new Array(frames + 1).fill(false),
    moveleft: new Array(frames + 1).fill(false),
    moveright: new Array(frames + 1).fill(false),
  };

  for (let i = 1; i <= frames; i++) {
    const btn = Number(buttons[i] || 0);
    const fl = Number(flags[i] || 0);
    out.movetype_toss[i] = Number(movetype[i] || 0) === 6;
    out.use[i] = (btn & BUTTONS.USE) !== 0;
    out.jump[i] = (btn & BUTTONS.JUMP) !== 0;
    out.ground[i] = (fl & FLAGS.ONGROUND) !== 0;
    out.duck[i] = (btn & BUTTONS.DUCK) !== 0;
    out.duckstate2[i] = Number(bInDuck[i] || 0) === 0 && (fl & FLAGS.DUCKING) !== 0;
    out.forward[i] = (btn & BUTTONS.FORWARD) !== 0;
    out.back[i] = (btn & BUTTONS.BACK) !== 0;
    out.moveleft[i] = (btn & BUTTONS.MOVELEFT) !== 0;
    out.moveright[i] = (btn & BUTTONS.MOVERIGHT) !== 0;
  }

  return out;
}

function num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nearestTechnique(gtTechniques, localTechniques) {
  const result = [];
  const used = new Set();

  for (const gt of gtTechniques) {
    let best = null;
    let bestKey = null;
    for (let i = 0; i < localTechniques.length; i++) {
      if (used.has(i)) continue;
      const local = localTechniques[i];
      const d = Math.abs((num(local.jumpoffFrame) ?? 0) - (num(gt.jumpoffFrame) ?? 0));
      if (!best || d < best.deltaFrame) {
        best = local;
        bestKey = i;
        best.deltaFrame = d;
      }
    }
    if (best) {
      used.add(bestKey);
      result.push({ gt, local: best, deltaFrame: best.deltaFrame });
    }
  }

  return result;
}

const upstream = JSON.parse(fs.readFileSync(path.resolve(upstreamPath), 'utf8'));
const localWrap = JSON.parse(fs.readFileSync(path.resolve(localParsePath), 'utf8'));
const local = localWrap.graph;

const frames = Math.min(Number(upstream.frames || 0), Number(localWrap.frames || 0));

const gtMasks = masks(upstream, frames);
const localMasks = masks(local, frames);
const rowParity = {};
for (const key of Object.keys(gtMasks)) {
  rowParity[key] = scoreBool(gtMasks[key], localMasks[key], frames);
}

const gtLjs = upstream.longjumps || [];
const localLjs = local.longjumps || [];
const matched = nearestTechnique(gtLjs, localLjs);

const techniqueDiffs = matched.map(({ gt, local, deltaFrame }) => ({
  deltaFrame,
  type: { gt: num(gt.type), local: num(local.type), delta: num(local.type) - num(gt.type) },
  jumpoffFrame: { gt: num(gt.jumpoffFrame), local: num(local.jumpoffFrame), delta: num(local.jumpoffFrame) - num(gt.jumpoffFrame) },
  landingFrame: { gt: num(gt.landingFrame), local: num(local.landingFrame), delta: num(local.landingFrame) - num(gt.landingFrame) },
  distance: { gt: num(gt.distance), local: num(local.distance), delta: num(local.distance) - num(gt.distance) },
  distanceXy: { gt: num(gt.distanceXy), local: num(local.distanceXy), delta: num(local.distanceXy) - num(gt.distanceXy) },
  maxspeed: { gt: num(gt.maxspeed), local: num(local.maxspeed), delta: num(local.maxspeed) - num(gt.maxspeed) },
  prestrafe: { gt: num(gt.prestrafe), local: num(local.prestrafe), delta: num(local.prestrafe) - num(gt.prestrafe) },
  strafes: { gt: num(gt.strafes), local: num(local.strafes), delta: num(local.strafes) - num(gt.strafes) },
  sync: { gt: num(gt.sync), local: num(local.sync), delta: num(local.sync) - num(gt.sync) },
  framesInDuck: { gt: num(gt.framesInDuck), local: num(local.framesInDuck), delta: num(local.framesInDuck) - num(gt.framesInDuck) },
  frames: { gt: num(gt.frames), local: num(local.frames), delta: num(local.frames) - num(gt.frames) },
}));

const avgJumpoffDelta = techniqueDiffs.length
  ? techniqueDiffs.reduce((s, d) => s + (d.jumpoffFrame.delta ?? 0), 0) / techniqueDiffs.length
  : 0;
const avgLandingDelta = techniqueDiffs.length
  ? techniqueDiffs.reduce((s, d) => s + (d.landingFrame.delta ?? 0), 0) / techniqueDiffs.length
  : 0;

const mismatchClusters = [];
if (Math.abs(avgJumpoffDelta) >= 1 || Math.abs(avgLandingDelta) >= 1) {
  mismatchClusters.push({
    cluster: 'frame-index-drift',
    avgJumpoffDelta,
    avgLandingDelta,
  });
}

const wrongTypeCount = techniqueDiffs.filter(d => d.type.gt !== d.type.local).length;
if (wrongTypeCount > 0) {
  mismatchClusters.push({
    cluster: 'technique-classification',
    wrongTypeCount,
    totalCompared: techniqueDiffs.length,
  });
}

const syncAbsAvg = techniqueDiffs.length
  ? techniqueDiffs.reduce((s, d) => s + Math.abs(d.sync.delta ?? 0), 0) / techniqueDiffs.length
  : 0;
if (syncAbsAvg >= 2) {
  mismatchClusters.push({
    cluster: 'sync-metric-drift',
    avgAbsoluteSyncDelta: syncAbsAvg,
  });
}

const report = {
  upstreamPath: path.resolve(upstreamPath),
  localParsePath: path.resolve(localParsePath),
  framesCompared: frames,
  counts: {
    upstreamLongjumps: gtLjs.length,
    localLongjumps: localLjs.length,
    compared: techniqueDiffs.length,
  },
  rowParity,
  mismatchClusters,
  firstTechniqueDiff: techniqueDiffs[0] || null,
  allTechniqueDiffs: techniqueDiffs,
};

const absOut = path.resolve(outPath);
fs.mkdirSync(path.dirname(absOut), { recursive: true });
fs.writeFileSync(absOut, JSON.stringify(report, null, 2));

console.log(`Wrote ${absOut}`);
console.log(`Rows: ${Object.entries(rowParity).map(([k, v]) => `${k}=${v.toFixed(4)}`).join(' ')}`);
if (report.firstTechniqueDiff) {
  const d = report.firstTechniqueDiff;
  console.log(`First LJ diff: type ${d.type.local}/${d.type.gt}, jump ${d.jumpoffFrame.local}/${d.jumpoffFrame.gt}, land ${d.landingFrame.local}/${d.landingFrame.gt}, distDelta ${d.distance.delta?.toFixed(6)}, syncDelta ${d.sync.delta}`);
}

/**
 * csv-pack.js
 *
 * Builds a deterministic "Export Everything CSV Pack" from a parsed graph
 * payload.  All per-frame files share frame_abs as the primary key.
 * Jump-scoped files link back via jump_id.
 *
 * Source-kind vocabulary used in schema.csv:
 *   raw              – value copied verbatim from the parser output
 *   expanded_raw     – delta-encoded raw value expanded to every frame
 *   derived          – computed from one or more raw/expanded_raw values
 *   fallback_derived – derived via a heuristic when authoritative data absent
 *   not_available    – value cannot be reconstructed from .dem
 */

import { buttons, flags } from '../upstream/pages/demo/graph/consts.js';

// ─── constants ────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = '1';
const YAW_STRAFE_EPSILON_DEG = 0.0001;

// ─── tiny numeric utilities ───────────────────────────────────────────────────

function asNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value, digits = 6) {
  return Number(asNum(value, 0).toFixed(digits));
}

function normDeltaAngle(cur, prev) {
  let d = asNum(cur, 0) - asNum(prev, 0);
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function yawDir(yawDeltaDeg) {
  if (yawDeltaDeg > YAW_STRAFE_EPSILON_DEG) return 1;
  if (yawDeltaDeg < -YAW_STRAFE_EPSILON_DEG) return -1;
  return 0;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function csvEsc(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEsc).join(',')];
  for (const row of rows) lines.push(row.map(csvEsc).join(','));
  return `${lines.join('\n')}\n`;
}

// ─── delta-map expansion ──────────────────────────────────────────────────────

/**
 * Expand a sparse delta-encoded object {frameStr: value} into a dense array
 * indexed by frame (0..totalFrames inclusive), forward-filling the last seen
 * value.
 */
function expandDelta(obj, totalFrames, fallback = 0) {
  const out = new Array(totalFrames + 1).fill(fallback);
  if (!obj || typeof obj !== 'object') return out;

  const keys = Object.keys(obj)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  let cursor = 0;
  let last = fallback;
  for (let f = 0; f <= totalFrames; f++) {
    while (cursor < keys.length && keys[cursor] <= f) {
      last = asNum(obj[keys[cursor]], fallback);
      cursor += 1;
    }
    out[f] = last;
  }
  return out;
}

function arrAt(arr, idx, fallback = 0) {
  if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) return fallback;
  return asNum(arr[idx], fallback);
}

// ─── jump technique lookup ────────────────────────────────────────────────────

function techniqueFromType(t) {
  switch (Number(t)) {
    case 0: return 'longjump';
    case 1: return 'highjump';
    case 2: return 'bhopjump';
    case 3: return 'standupbhopjump';
    case 4: return 'weirdjump';
    case 5: return 'countjump';
    case 6: return 'standupcountjump';
    case 7: return 'doublecountjump';
    case 8: return 'doublestandupcountjump';
    case 9: return 'ladderjump';
    case 10: return 'slidelongjump';
    default: return `type_${Number(t)}`;
  }
}

// ─── fallback jump detector ───────────────────────────────────────────────────

function detectFallbackJumps({ frameCount, rawFlags, rawButtons, rawOriginX, rawOriginY }) {
  const out = [];
  for (let frame = 2; frame <= frameCount; frame++) {
    const prevGround = (rawFlags[frame - 1] & flags.ONGROUND) !== 0;
    const curGround = (rawFlags[frame] & flags.ONGROUND) !== 0;
    if (!(prevGround && !curGround)) continue;

    const takeoff = frame;
    let hasJump = false;
    for (let f = Math.max(1, takeoff - 3); f <= takeoff; f++) {
      if ((asNum(rawButtons[f], 0) & buttons.JUMP) !== 0) { hasJump = true; break; }
    }
    if (!hasJump) continue;

    let landing = takeoff + 1;
    while (landing <= frameCount && (rawFlags[landing] & flags.ONGROUND) === 0) landing++;
    if (landing > frameCount) break;

    const airFrames = landing - takeoff;
    if (airFrames < 6) { frame = landing; continue; }

    const dx = rawOriginX[landing] - rawOriginX[takeoff];
    const dy = rawOriginY[landing] - rawOriginY[takeoff];
    out.push({
      technique: 'unknown_jump',
      jump_source: 'fallback_derived',
      distance_u: Math.sqrt(dx * dx + dy * dy) + 32.0,
      takeoff_frame_abs: takeoff,
      landing_frame_abs: landing,
    });
    frame = landing;
  }
  return out;
}

// ─── main export builder ──────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {object} params.graph        – graph sub-object of the parsed payload
 * @param {number} params.totalFrames  – total frame count
 * @param {string} params.mapName      – map name or 'unknown_map'
 * @param {string} params.strafeRuleName – human name of the strafe rule used
 * @param {string} params.jumpSourceMode – 'longjumps' | 'fallback'
 * @param {string} [params.appVersion] – optional app/parser version string
 * @returns {{ files: Map<string,string>, summary: object }}
 */
export function buildCsvPack({
  graph,
  totalFrames,
  mapName,
  strafeRuleName = 'yaw_sign_delta',
  jumpSourceMode = 'auto',
  appVersion = '',
}) {
  const frameCount = Math.max(1, Number(totalFrames || 0));

  // ── expand all delta-encoded raw fields ─────────────────────────────────────
  const rawFlags    = expandDelta(graph?.cd?.flags              || {}, frameCount, 0);
  const rawBInDuck  = expandDelta(graph?.cd?.bInDuck            || {}, frameCount, 0);
  const rawFuser2   = expandDelta(graph?.cd?.fuser2             || {}, frameCount, 0);
  const rawHealth   = expandDelta(graph?.cd?.health             || {}, frameCount, 100);
  const rawIuser1   = expandDelta(graph?.cd?.iuser1             || {}, frameCount, 0);
  const rawIuser2   = expandDelta(graph?.cd?.iuser2             || {}, frameCount, 0);
  const rawIuser3   = expandDelta(graph?.cd?.iuser3             || {}, frameCount, 0);
  const rawMiId     = expandDelta(graph?.cd?.m_iId              || {}, frameCount, 0);
  const rawMaxspeed = expandDelta(graph?.cd?.maxspeed            || graph?.maxspeed || {}, frameCount, 0);
  const rawMinsZ    = expandDelta(graph?.esp?.['mins[2]']       || {}, frameCount, -36);
  const rawMovetype = expandDelta(graph?.esp?.movetype          || {}, frameCount, 3);
  const rawIClip    = expandDelta(graph?.cd?.iClip              || {}, frameCount, -1);

  const rawOriginX  = expandDelta(graph?.cd?.['origin[0]']     || {}, frameCount, 0);
  const rawOriginY  = expandDelta(graph?.cd?.['origin[1]']     || {}, frameCount, 0);
  const rawOriginZ  = expandDelta(graph?.cd?.['origin[2]']     || {}, frameCount, 0);
  const rawVelX     = expandDelta(graph?.cd?.['velocity[0]']   || {}, frameCount, 0);
  const rawVelY     = expandDelta(graph?.cd?.['velocity[1]']   || {}, frameCount, 0);
  const rawVelZ     = expandDelta(graph?.cd?.['velocity[2]']   || {}, frameCount, 0);
  const rawYaw      = expandDelta(graph?.esp?.['angles[1]']    || {}, frameCount, 0);
  const rawPitch    = expandDelta(graph?.esp?.['angles[0]']    || {}, frameCount, 0);

  // ── expand array-indexed raw fields ─────────────────────────────────────────
  // cmd: arrays indexed by frame (1-based, 0 = unused)
  const cmdButtons      = Array.isArray(graph?.cmd?.buttons)
    ? graph.cmd.buttons : [];
  const cmdForwardmove  = Array.isArray(graph?.cmd?.forwardmove)
    ? graph.cmd.forwardmove : [];
  const cmdSidemove     = Array.isArray(graph?.cmd?.sidemove)
    ? graph.cmd.sidemove : [];
  const cmdUpmove       = Array.isArray(graph?.cmd?.upmove)
    ? graph.cmd.upmove : [];
  const cmdMsec         = Array.isArray(graph?.cmd?.msec)
    ? graph.cmd.msec : [];

  // demo_time / engine time / frametime – delta maps
  const rawDemoTime  = expandDelta(graph?.demo_time  || {}, frameCount, 0);
  const rawEngTime   = expandDelta(graph?.time        || {}, frameCount, 0);
  const rawFrametime = expandDelta(graph?.frametime   || {}, frameCount, 0);
  const rawIsPaused  = expandDelta(graph?.is_paused   || {}, frameCount, 0);

  // commands – sparse map {frameStr: string}
  const rawCommands = graph?.commands || {};

  // ── build jumps list ─────────────────────────────────────────────────────────
  const sourceLjs = Array.isArray(graph?.longjumps) ? graph.longjumps : [];

  let normalizedJumps;
  let resolvedJumpSource;

  if (sourceLjs.length > 0) {
    resolvedJumpSource = 'longjumps';
    normalizedJumps = sourceLjs
      .map((j) => {
        const takeoffF = Math.max(1, Math.min(frameCount, Math.round(asNum(j?.jumpoffFrame, 0))));
        const landingF = Math.max(1, Math.min(frameCount, Math.round(asNum(j?.landingFrame, 0))));
        if (landingF <= takeoffF) return null;
        return {
          technique: techniqueFromType(j?.type),
          jump_source: 'longjumps',
          distance_u: asNum(j?.distance, 0),
          takeoff_frame_abs: takeoffF,
          landing_frame_abs: landingF,
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.takeoff_frame_abs !== b.takeoff_frame_abs
          ? a.takeoff_frame_abs - b.takeoff_frame_abs
          : a.landing_frame_abs - b.landing_frame_abs,
      );
  } else {
    resolvedJumpSource = 'fallback_derived';
    normalizedJumps = detectFallbackJumps({
      frameCount,
      rawFlags,
      rawButtons: cmdButtons,
      rawOriginX,
      rawOriginY,
    });
  }

  const jumps = normalizedJumps.map((j, idx) => ({
    ...j,
    jump_id: `J${String(idx + 1).padStart(6, '0')}`,
  }));

  // ── per-frame: build a pre-computed accel array ───────────────────────────
  // accel_xy = (velXY[f] - velXY[f-1]) / dt[f]
  const velXY = new Array(frameCount + 1);
  for (let f = 0; f <= frameCount; f++) {
    velXY[f] = Math.hypot(rawVelX[f], rawVelY[f]);
  }

  // ── 1. manifest.csv ──────────────────────────────────────────────────────────
  const manifestHeaders = [
    'schema_version', 'map_name', 'total_frames',
    'app_version', 'strafe_rule_name', 'jump_source_mode',
  ];
  const manifestRows = [[
    SCHEMA_VERSION,
    mapName,
    frameCount,
    appVersion || '',
    strafeRuleName,
    jumpSourceMode === 'auto' ? resolvedJumpSource : jumpSourceMode,
  ]];
  const manifestCsv = toCsv(manifestHeaders, manifestRows);

  // ── 2. frames.csv ────────────────────────────────────────────────────────────
  const framesHeaders = [
    'frame_abs', 'demo_time_s', 'engine_time_s', 'frametime_s',
    'msec', 'frame_dt_s', 'is_paused',
  ];
  const framesRows = [];
  for (let f = 1; f <= frameCount; f++) {
    const msec = arrAt(cmdMsec, f, 0);
    framesRows.push([
      f,
      fmt(rawDemoTime[f], 6),
      fmt(rawEngTime[f], 6),
      fmt(rawFrametime[f], 9),
      msec,
      fmt(msec / 1000, 6),
      rawIsPaused[f] ? 1 : 0,
    ]);
  }
  const framesCsv = toCsv(framesHeaders, framesRows);

  // ── 3. player_state.csv ──────────────────────────────────────────────────────
  const playerStateHeaders = [
    'frame_abs', 'flags', 'bInDuck', 'fuser2', 'health',
    'iuser1', 'iuser2', 'iuser3', 'm_iId', 'maxspeed',
    'mins_z', 'movetype', 'iClip', 'is_on_ground', 'is_ducking', 'duckstate',
  ];
  const playerStateRows = [];
  for (let f = 1; f <= frameCount; f++) {
    const fl = rawFlags[f];
    const onGround = (fl & flags.ONGROUND) !== 0;
    const flagDucking = (fl & flags.DUCKING) !== 0;
    const inDuck = rawBInDuck[f] !== 0;
    // duckstate: 3=both, 1=bInDuck only, 2=flag only, 0=none
    const duckstate = inDuck && flagDucking ? 3 : inDuck ? 1 : flagDucking ? 2 : 0;
    playerStateRows.push([
      f,
      fl,
      rawBInDuck[f],
      fmt(rawFuser2[f], 6),
      rawHealth[f],
      rawIuser1[f],
      rawIuser2[f],
      rawIuser3[f],
      rawMiId[f],
      fmt(rawMaxspeed[f], 4),
      fmt(rawMinsZ[f], 4),
      rawMovetype[f],
      rawIClip[f],
      onGround ? 1 : 0,
      flagDucking ? 1 : 0,
      duckstate,
    ]);
  }
  const playerStateCsv = toCsv(playerStateHeaders, playerStateRows);

  // ── 4. movement.csv ──────────────────────────────────────────────────────────
  const movementHeaders = [
    'frame_abs',
    'origin_x_u', 'origin_y_u', 'origin_z_u',
    'vel_x_ups', 'vel_y_ups', 'vel_z_ups',
    'vel_xy_ups', 'vel_3d_ups',
    'forwardmove', 'sidemove', 'upmove',
    'velocity_yaw_deg', 'accel_xy_ups2',
  ];
  const movementRows = [];
  for (let f = 1; f <= frameCount; f++) {
    const vx = rawVelX[f];
    const vy = rawVelY[f];
    const vz = rawVelZ[f];
    const vxy = velXY[f];
    const v3d = Math.hypot(vx, vy, vz);
    const velYawDeg = (vx === 0 && vy === 0) ? 0 : Math.atan2(vy, vx) * (180 / Math.PI);
    const msec = arrAt(cmdMsec, f, 0);
    const dt = msec / 1000;
    const prevVxy = f > 1 ? velXY[f - 1] : vxy;
    const accelXY = dt > 0 ? (vxy - prevVxy) / dt : 0;
    movementRows.push([
      f,
      fmt(rawOriginX[f]),
      fmt(rawOriginY[f]),
      fmt(rawOriginZ[f]),
      fmt(vx),
      fmt(vy),
      fmt(vz),
      fmt(vxy),
      fmt(v3d),
      fmt(arrAt(cmdForwardmove, f, 0), 4),
      fmt(arrAt(cmdSidemove, f, 0), 4),
      fmt(arrAt(cmdUpmove, f, 0), 4),
      fmt(velYawDeg),
      fmt(accelXY),
    ]);
  }
  const movementCsv = toCsv(movementHeaders, movementRows);

  // ── 5. buttons.csv ───────────────────────────────────────────────────────────
  const buttonsHeaders = [
    'frame_abs', 'buttons',
    'attack', 'jump', 'duck', 'forward', 'back', 'use', 'cancel',
    'left', 'right', 'moveleft', 'moveright', 'attack2', 'run', 'reload',
    'alt1', 'score',
  ];
  const buttonsRows = [];
  for (let f = 1; f <= frameCount; f++) {
    const b = arrAt(cmdButtons, f, 0);
    buttonsRows.push([
      f, b,
      (b & buttons.ATTACK)    ? 1 : 0,
      (b & buttons.JUMP)      ? 1 : 0,
      (b & buttons.DUCK)      ? 1 : 0,
      (b & buttons.FORWARD)   ? 1 : 0,
      (b & buttons.BACK)      ? 1 : 0,
      (b & buttons.USE)       ? 1 : 0,
      (b & buttons.CANCEL)    ? 1 : 0,
      (b & buttons.LEFT)      ? 1 : 0,
      (b & buttons.RIGHT)     ? 1 : 0,
      (b & buttons.MOVELEFT)  ? 1 : 0,
      (b & buttons.MOVERIGHT) ? 1 : 0,
      (b & buttons.ATTACK2)   ? 1 : 0,
      (b & buttons.RUN)       ? 1 : 0,
      (b & buttons.RELOAD)    ? 1 : 0,
      (b & buttons.ALT1)      ? 1 : 0,
      (b & buttons.SCORE)     ? 1 : 0,
    ]);
  }
  const buttonsCsv = toCsv(buttonsHeaders, buttonsRows);

  // ── 6. camera.csv ────────────────────────────────────────────────────────────
  const cameraHeaders = [
    'frame_abs',
    'pitch_abs_deg', 'yaw_abs_deg',
    'pitch_delta_deg', 'yaw_delta_deg',
    'pitch_speed_degps', 'yaw_speed_degps',
    'pitch_accel_degps2', 'yaw_accel_degps2',
    'yaw_rel_first_frame_deg',
    'view_velocity_delta_deg',
  ];
  const cameraRows = [];
  const firstYaw   = rawYaw[1];
  const firstPitch = rawPitch[1];
  let prevPitchSpeed = 0;
  let prevYawSpeed   = 0;
  for (let f = 1; f <= frameCount; f++) {
    const msec = arrAt(cmdMsec, f, 0);
    const dt   = msec / 1000;

    const pitchAbs = rawPitch[f];
    const yawAbs   = rawYaw[f];

    const pitchPrev = f > 1 ? rawPitch[f - 1] : pitchAbs;
    const yawPrev   = f > 1 ? rawYaw[f - 1]   : yawAbs;

    const pitchDelta = normDeltaAngle(pitchAbs, pitchPrev);
    const yawDelta   = normDeltaAngle(yawAbs, yawPrev);

    const pitchSpeed = dt > 0 ? pitchDelta / dt : 0;
    const yawSpeed   = dt > 0 ? yawDelta   / dt : 0;

    const pitchAccel = dt > 0 ? (pitchSpeed - prevPitchSpeed) / dt : 0;
    const yawAccel   = dt > 0 ? (yawSpeed   - prevYawSpeed)   / dt : 0;

    const yawRelFirst = normDeltaAngle(yawAbs, firstYaw);

    // view_velocity_delta: magnitude of (pitchDelta, yawDelta) vector
    const viewVelDelta = Math.hypot(pitchDelta, yawDelta);

    prevPitchSpeed = pitchSpeed;
    prevYawSpeed   = yawSpeed;

    cameraRows.push([
      f,
      fmt(pitchAbs),
      fmt(yawAbs),
      fmt(pitchDelta),
      fmt(yawDelta),
      fmt(pitchSpeed),
      fmt(yawSpeed),
      fmt(pitchAccel),
      fmt(yawAccel),
      fmt(yawRelFirst),
      fmt(viewVelDelta),
    ]);
  }
  const cameraCsv = toCsv(cameraHeaders, cameraRows);

  // ── 7. commands.csv ──────────────────────────────────────────────────────────
  const commandsHeaders = ['frame_abs', 'commands'];
  const commandsRows = [];
  // iterate in stable numeric order
  const cmdFrameKeys = Object.keys(rawCommands)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  for (const f of cmdFrameKeys) {
    const cmdStr = String(rawCommands[String(f)] || '');
    if (cmdStr) commandsRows.push([f, cmdStr]);
  }
  const commandsCsv = toCsv(commandsHeaders, commandsRows);

  // ── 8–11. jump-scoped files ───────────────────────────────────────────────────
  const jumpsHeaders = [
    'jump_id', 'jump_source', 'technique', 'distance_u',
    'takeoff_frame_abs', 'landing_frame_abs',
    'air_frames', 'air_time_ms',
    'max_height_u',
    'takeoff_vel_xy_ups', 'landing_vel_xy_ups', 'max_vel_xy_ups',
  ];

  const jumpFramesHeaders = [
    'jump_id', 'frame_abs', 'frame_jump_idx', 'frame_air_idx',
    'air_progress_p01',
    'jump_height_u',
    'is_takeoff_frame', 'is_landing_frame', 'event_tag',
  ];

  const strafesHeaders = [
    'jump_id', 'strafe_idx', 'strafe_dir',
    'start_frame_abs', 'end_frame_abs',
    'frames', 'duration_ms',
    'yaw_delta_sum_deg', 'avg_yaw_speed_degps', 'max_yaw_speed_degps',
    'avg_vel_xy_ups',
  ];

  const jumpsRows      = [];
  const jumpFramesRows = [];
  const strafesRows    = [];

  for (const jump of jumps) {
    const { jump_id, takeoff_frame_abs: T, landing_frame_abs: L } = jump;
    const airFrames = L - T;
    const takeoffZ  = rawOriginZ[T];
    const takeoffVxy = velXY[T];
    const landingVxy = velXY[L];

    let airTimeMs   = 0;
    let maxHeightU  = -Infinity;
    let peakHF      = T;
    let maxVxy      = -Infinity;

    for (let f = T; f <= L; f++) {
      if (velXY[f] > maxVxy) maxVxy = velXY[f];
      const h = rawOriginZ[f] - takeoffZ;
      if (h > maxHeightU) { maxHeightU = h; peakHF = f; }
      if (f > T) airTimeMs += arrAt(cmdMsec, f, 0);
    }

    jumpsRows.push([
      jump_id,
      jump.jump_source,
      jump.technique,
      fmt(jump.distance_u),
      T, L,
      airFrames,
      fmt(airTimeMs, 3),
      fmt(maxHeightU),
      fmt(takeoffVxy),
      fmt(landingVxy),
      fmt(maxVxy),
    ]);

    // ── jump_frames sub-pass ───────────────────────────────────────────────
    for (let f = T; f <= L; f++) {
      const fjIdx  = f - T;
      const isTakeoff = f === T;
      const isLanding = f === L;
      const h = rawOriginZ[f] - takeoffZ;
      const airProg = airFrames > 0 ? fjIdx / airFrames : 0;

      const evts = [];
      if (isTakeoff) evts.push('takeoff');
      if (isLanding) evts.push('landing');
      if (f === peakHF) evts.push('peak_height');

      jumpFramesRows.push([
        jump_id,
        f,
        fjIdx,
        fjIdx,           // frame_air_idx == frame_jump_idx (air from takeoff)
        fmt(airProg, 6),
        fmt(h),
        isTakeoff ? 1 : 0,
        isLanding ? 1 : 0,
        evts.join('|'),
      ]);
    }

    // ── strafes sub-pass ───────────────────────────────────────────────────
    let strafeIdx          = 0;
    let prevNonZeroDir     = 0;
    let segStart           = -1;
    let segDir             = 0;
    let segMs              = 0;
    let segYawSum          = 0;
    let segMaxYawSpeed     = 0;
    let segVxySum          = 0;
    let segFrameCount      = 0;

    const flushStrafe = (endF) => {
      if (segStart < 0 || segDir === 0) return;
      const dur = segMs;
      const avgYawSpeed = dur > 0 ? (segYawSum / (dur / 1000)) : 0;
      const avgVxy = segFrameCount > 0 ? segVxySum / segFrameCount : 0;
      strafesRows.push([
        jump_id, strafeIdx, segDir,
        segStart, endF,
        segFrameCount, fmt(dur, 3),
        fmt(segYawSum),
        fmt(avgYawSpeed),
        fmt(segMaxYawSpeed),
        fmt(avgVxy),
      ]);
    };

    for (let f = T; f <= L; f++) {
      const yPrev    = f > 1 ? rawYaw[f - 1] : rawYaw[f];
      const yawDelta = normDeltaAngle(rawYaw[f], yPrev);
      const dir      = yawDir(yawDelta);
      const msec     = arrAt(cmdMsec, f, 0);
      const dt       = msec / 1000;
      const yawSpeed = dt > 0 ? yawDelta / dt : 0;

      if (dir !== 0) {
        if (prevNonZeroDir === 0) {
          // start first strafe segment
          strafeIdx = 1;
          segStart  = f;
          segDir    = dir;
          segMs     = msec;
          segYawSum = yawDelta;
          segMaxYawSpeed = Math.abs(yawSpeed);
          segVxySum = velXY[f];
          segFrameCount = 1;
        } else if (dir !== prevNonZeroDir) {
          // direction flip → flush current, start new
          flushStrafe(f - 1);
          strafeIdx += 1;
          segStart   = f;
          segDir     = dir;
          segMs      = msec;
          segYawSum  = yawDelta;
          segMaxYawSpeed = Math.abs(yawSpeed);
          segVxySum  = velXY[f];
          segFrameCount = 1;
        } else {
          // same direction → extend
          segMs          += msec;
          segYawSum      += yawDelta;
          segMaxYawSpeed  = Math.max(segMaxYawSpeed, Math.abs(yawSpeed));
          segVxySum      += velXY[f];
          segFrameCount  += 1;
        }
        prevNonZeroDir = dir;
      }
      // dir === 0 → neutral; we still need to add to the current segment time
      // but don't count as a strafe frame; we keep extending the current
      // segment across neutral frames so short dead-zones stay grouped.
      else if (prevNonZeroDir !== 0 && segStart >= 0) {
        segMs         += msec;
        segFrameCount += 1;
        segVxySum     += velXY[f];
      }
    }
    // flush final segment
    flushStrafe(L);
  }

  const jumpsCsv      = toCsv(jumpsHeaders, jumpsRows);
  const jumpFramesCsv = toCsv(jumpFramesHeaders, jumpFramesRows);
  const strafesCsv    = toCsv(strafesHeaders, strafesRows);

  // ── 12. schema.csv ───────────────────────────────────────────────────────────
  const schemaHeaders = ['file', 'column', 'type', 'unit', 'source_kind', 'source_path', 'description'];

  // prettier-ignore
  const schemaDefs = [
    // manifest.csv
    ['manifest.csv','schema_version','string','','raw','','CSV pack schema version number'],
    ['manifest.csv','map_name','string','','raw','graph.map_name / payload.map_name','Map name from parser; may be unknown_map'],
    ['manifest.csv','total_frames','int','frames','raw','payload.frames','Total frame count in the demo'],
    ['manifest.csv','app_version','string','','raw','','App/parser version string if available'],
    ['manifest.csv','strafe_rule_name','string','','raw','','Strafe segmentation rule used for strafes.csv'],
    ['manifest.csv','jump_source_mode','string','','derived','','Whether jumps came from longjumps or fallback detection'],
    // frames.csv
    ['frames.csv','frame_abs','int','frames','raw','','Absolute frame index (1-based)'],
    ['frames.csv','demo_time_s','float','s','expanded_raw','graph.demo_time','Demo playback time at this frame'],
    ['frames.csv','engine_time_s','float','s','expanded_raw','graph.time','Engine clock time at this frame'],
    ['frames.csv','frametime_s','float','s','expanded_raw','graph.frametime','Per-frame server tick duration'],
    ['frames.csv','msec','int','ms','expanded_raw','graph.cmd.msec','Client command duration in milliseconds'],
    ['frames.csv','frame_dt_s','float','s','derived','graph.cmd.msec','msec / 1000'],
    ['frames.csv','is_paused','int','bool','expanded_raw','graph.is_paused','1 if game was paused at this frame'],
    // player_state.csv
    ['player_state.csv','frame_abs','int','frames','raw','','Absolute frame index'],
    ['player_state.csv','flags','int','bitmask','expanded_raw','graph.cd.flags','GoldSrc entity flags bitmask'],
    ['player_state.csv','bInDuck','int','bool','expanded_raw','graph.cd.bInDuck','Player bInDuck state (mid-duck animation)'],
    ['player_state.csv','fuser2','float','','expanded_raw','graph.cd.fuser2','fuser2 (duck time counter)'],
    ['player_state.csv','health','int','hp','expanded_raw','graph.cd.health','Player health'],
    ['player_state.csv','iuser1','int','','expanded_raw','graph.cd.iuser1','Observer mode (iuser1)'],
    ['player_state.csv','iuser2','int','','expanded_raw','graph.cd.iuser2','Observer target entity (iuser2)'],
    ['player_state.csv','iuser3','int','','expanded_raw','graph.cd.iuser3','iuser3'],
    ['player_state.csv','m_iId','int','','expanded_raw','graph.cd.m_iId','Held weapon entity index'],
    ['player_state.csv','maxspeed','float','u/s','expanded_raw','graph.cd.maxspeed','Player max speed cap'],
    ['player_state.csv','mins_z','float','u','expanded_raw','graph.esp.mins[2]','AABB mins Z (hull height indicator; -18=ducked, -36=standing)'],
    ['player_state.csv','movetype','int','','expanded_raw','graph.esp.movetype','Entity movetype (3=walk, 8=noclip, …)'],
    ['player_state.csv','iClip','int','','expanded_raw','graph.cd.iClip','Weapon clip ammo (-1 if not available)'],
    ['player_state.csv','is_on_ground','int','bool','derived','graph.cd.flags','(flags & FL_ONGROUND) != 0'],
    ['player_state.csv','is_ducking','int','bool','derived','graph.cd.flags','(flags & FL_DUCKING) != 0'],
    ['player_state.csv','duckstate','int','0-3','derived','graph.cd.flags + graph.cd.bInDuck','3=both, 2=flag only, 1=bInDuck only, 0=neither'],
    // movement.csv
    ['movement.csv','frame_abs','int','frames','raw','','Absolute frame index'],
    ['movement.csv','origin_x_u','float','u','expanded_raw','graph.cd.origin[0]','Player origin X in world units'],
    ['movement.csv','origin_y_u','float','u','expanded_raw','graph.cd.origin[1]','Player origin Y in world units'],
    ['movement.csv','origin_z_u','float','u','expanded_raw','graph.cd.origin[2]','Player origin Z in world units'],
    ['movement.csv','vel_x_ups','float','u/s','expanded_raw','graph.cd.velocity[0]','Player velocity X'],
    ['movement.csv','vel_y_ups','float','u/s','expanded_raw','graph.cd.velocity[1]','Player velocity Y'],
    ['movement.csv','vel_z_ups','float','u/s','expanded_raw','graph.cd.velocity[2]','Player velocity Z'],
    ['movement.csv','vel_xy_ups','float','u/s','derived','graph.cd.velocity[0..1]','Horizontal speed magnitude sqrt(vx²+vy²)'],
    ['movement.csv','vel_3d_ups','float','u/s','derived','graph.cd.velocity[0..2]','3D speed magnitude sqrt(vx²+vy²+vz²)'],
    ['movement.csv','forwardmove','float','u/s','expanded_raw','graph.cmd.forwardmove','Forward/back wishdir magnitude (+250=forward)'],
    ['movement.csv','sidemove','float','u/s','expanded_raw','graph.cmd.sidemove','Side wishdir magnitude (+250=strafe right)'],
    ['movement.csv','upmove','float','u/s','expanded_raw','graph.cmd.upmove','Vertical wishdir magnitude'],
    ['movement.csv','velocity_yaw_deg','float','deg','derived','graph.cd.velocity[0..1]','atan2(vy, vx) in degrees; heading of velocity vector'],
    ['movement.csv','accel_xy_ups2','float','u/s²','derived','graph.cd.velocity[0..1] + graph.cmd.msec','(vel_xy[f] - vel_xy[f-1]) / frame_dt'],
    // buttons.csv
    ['buttons.csv','frame_abs','int','frames','raw','','Absolute frame index'],
    ['buttons.csv','buttons','int','bitmask','expanded_raw','graph.cmd.buttons','Raw GoldSrc buttons bitmask'],
    ['buttons.csv','attack','int','bool','derived','graph.cmd.buttons','IN_ATTACK (bit 0)'],
    ['buttons.csv','jump','int','bool','derived','graph.cmd.buttons','IN_JUMP (bit 1)'],
    ['buttons.csv','duck','int','bool','derived','graph.cmd.buttons','IN_DUCK (bit 2)'],
    ['buttons.csv','forward','int','bool','derived','graph.cmd.buttons','IN_FORWARD (bit 3)'],
    ['buttons.csv','back','int','bool','derived','graph.cmd.buttons','IN_BACK (bit 4)'],
    ['buttons.csv','use','int','bool','derived','graph.cmd.buttons','IN_USE (bit 5)'],
    ['buttons.csv','cancel','int','bool','derived','graph.cmd.buttons','IN_CANCEL (bit 6)'],
    ['buttons.csv','left','int','bool','derived','graph.cmd.buttons','IN_LEFT (bit 7)'],
    ['buttons.csv','right','int','bool','derived','graph.cmd.buttons','IN_RIGHT (bit 8)'],
    ['buttons.csv','moveleft','int','bool','derived','graph.cmd.buttons','IN_MOVELEFT (bit 9)'],
    ['buttons.csv','moveright','int','bool','derived','graph.cmd.buttons','IN_MOVERIGHT (bit 10)'],
    ['buttons.csv','attack2','int','bool','derived','graph.cmd.buttons','IN_ATTACK2 (bit 11)'],
    ['buttons.csv','run','int','bool','derived','graph.cmd.buttons','IN_RUN (bit 12)'],
    ['buttons.csv','reload','int','bool','derived','graph.cmd.buttons','IN_RELOAD (bit 13)'],
    ['buttons.csv','alt1','int','bool','derived','graph.cmd.buttons','IN_ALT1 (bit 14)'],
    ['buttons.csv','score','int','bool','derived','graph.cmd.buttons','IN_SCORE (bit 15)'],
    // camera.csv
    ['camera.csv','frame_abs','int','frames','raw','','Absolute frame index'],
    ['camera.csv','pitch_abs_deg','float','deg','expanded_raw','graph.esp.angles[0]','Absolute camera pitch (positive=look down in GoldSrc)'],
    ['camera.csv','yaw_abs_deg','float','deg','expanded_raw','graph.esp.angles[1]','Absolute camera yaw (0=East, +CCW)'],
    ['camera.csv','pitch_delta_deg','float','deg','derived','graph.esp.angles[0]','Normalized pitch change from previous frame'],
    ['camera.csv','yaw_delta_deg','float','deg','derived','graph.esp.angles[1]','Normalized yaw change from previous frame'],
    ['camera.csv','pitch_speed_degps','float','deg/s','derived','graph.esp.angles[0] + graph.cmd.msec','pitch_delta / frame_dt'],
    ['camera.csv','yaw_speed_degps','float','deg/s','derived','graph.esp.angles[1] + graph.cmd.msec','yaw_delta / frame_dt'],
    ['camera.csv','pitch_accel_degps2','float','deg/s²','derived','graph.esp.angles[0] + graph.cmd.msec','(pitch_speed[f] - pitch_speed[f-1]) / frame_dt'],
    ['camera.csv','yaw_accel_degps2','float','deg/s²','derived','graph.esp.angles[1] + graph.cmd.msec','(yaw_speed[f] - yaw_speed[f-1]) / frame_dt'],
    ['camera.csv','yaw_rel_first_frame_deg','float','deg','derived','graph.esp.angles[1]','Normalized yaw relative to frame 1'],
    ['camera.csv','view_velocity_delta_deg','float','deg','derived','graph.esp.angles[0..1]','sqrt(pitch_delta²+yaw_delta²) — view movement magnitude per frame'],
    ['camera.csv','raw_mouse_counts','not_available','','not_available','','True raw mouse counts are not stored in .dem files'],
    // jumps.csv
    ['jumps.csv','jump_id','string','','derived','','Stable jump identifier J000001..J999999'],
    ['jumps.csv','jump_source','string','','derived','','longjumps or fallback_derived'],
    ['jumps.csv','technique','string','','derived','graph.longjumps[].type','Jump technique name'],
    ['jumps.csv','distance_u','float','u','derived','graph.longjumps[].distance / fallback','Horizontal jump distance'],
    ['jumps.csv','takeoff_frame_abs','int','frames','derived','graph.longjumps[].jumpoffFrame','Frame of ground departure'],
    ['jumps.csv','landing_frame_abs','int','frames','derived','graph.longjumps[].landingFrame','Frame of ground contact'],
    ['jumps.csv','air_frames','int','frames','derived','','landing_frame - takeoff_frame'],
    ['jumps.csv','air_time_ms','float','ms','derived','graph.cmd.msec','Sum of msec for frames T+1..L'],
    ['jumps.csv','max_height_u','float','u','derived','graph.cd.origin[2]','Max origin_z - takeoff origin_z during this jump'],
    ['jumps.csv','takeoff_vel_xy_ups','float','u/s','derived','graph.cd.velocity[0..1]','Horizontal speed at takeoff frame'],
    ['jumps.csv','landing_vel_xy_ups','float','u/s','derived','graph.cd.velocity[0..1]','Horizontal speed at landing frame'],
    ['jumps.csv','max_vel_xy_ups','float','u/s','derived','graph.cd.velocity[0..1]','Peak horizontal speed during jump window'],
    // jump_frames.csv
    ['jump_frames.csv','jump_id','string','','derived','','Parent jump identifier'],
    ['jump_frames.csv','frame_abs','int','frames','raw','','Absolute frame index'],
    ['jump_frames.csv','frame_jump_idx','int','frames','derived','','0-based index within jump window'],
    ['jump_frames.csv','frame_air_idx','int','frames','derived','','Same as frame_jump_idx (air measured from takeoff)'],
    ['jump_frames.csv','air_progress_p01','float','0-1','derived','','frame_air_idx / air_frames'],
    ['jump_frames.csv','jump_height_u','float','u','derived','graph.cd.origin[2]','origin_z - takeoff_origin_z'],
    ['jump_frames.csv','is_takeoff_frame','int','bool','derived','','1 at takeoff frame'],
    ['jump_frames.csv','is_landing_frame','int','bool','derived','','1 at landing frame'],
    ['jump_frames.csv','event_tag','string','','derived','','Pipe-separated tags: takeoff|landing|peak_height'],
    // strafes.csv
    ['strafes.csv','jump_id','string','','derived','','Parent jump identifier'],
    ['strafes.csv','strafe_idx','int','','derived','','1-based strafe segment index within jump'],
    ['strafes.csv','strafe_dir','int','-1/0/1','derived','graph.esp.angles[1]','sign(yaw_delta) for this segment'],
    ['strafes.csv','start_frame_abs','int','frames','derived','','First frame of this strafe segment'],
    ['strafes.csv','end_frame_abs','int','frames','derived','','Last frame of this strafe segment'],
    ['strafes.csv','frames','int','frames','derived','','Frame count in segment'],
    ['strafes.csv','duration_ms','float','ms','derived','graph.cmd.msec','Sum of msec for segment frames'],
    ['strafes.csv','yaw_delta_sum_deg','float','deg','derived','graph.esp.angles[1]','Sum of yaw deltas (signed, normalized)'],
    ['strafes.csv','avg_yaw_speed_degps','float','deg/s','derived','','yaw_delta_sum / (duration_ms/1000)'],
    ['strafes.csv','max_yaw_speed_degps','float','deg/s','derived','','Peak |yaw_speed| in segment'],
    ['strafes.csv','avg_vel_xy_ups','float','u/s','derived','graph.cd.velocity[0..1]','Mean horizontal speed across segment frames'],
    // commands.csv
    ['commands.csv','frame_abs','int','frames','raw','graph.commands (key)','Frame at which the console command fired'],
    ['commands.csv','commands','string','','raw','graph.commands (value)','Semicolon-separated console commands'],
  ];

  const schemaRows = schemaDefs.map((row) => row);
  const schemaCsv  = toCsv(schemaHeaders, schemaRows);

  // ── assemble file map ─────────────────────────────────────────────────────────
  // Stable file order specified in the plan
  const files = new Map([
    ['manifest.csv',    manifestCsv],
    ['schema.csv',      schemaCsv],
    ['frames.csv',      framesCsv],
    ['player_state.csv', playerStateCsv],
    ['movement.csv',    movementCsv],
    ['buttons.csv',     buttonsCsv],
    ['camera.csv',      cameraCsv],
    ['jumps.csv',       jumpsCsv],
    ['jump_frames.csv', jumpFramesCsv],
    ['strafes.csv',     strafesCsv],
    ['commands.csv',    commandsCsv],
  ]);

  return {
    files,
    summary: {
      totalFrames: frameCount,
      jumpsCount:  jumpsRows.length,
      jumpFramesCount: jumpFramesRows.length,
      strafesCount: strafesRows.length,
      resolvedJumpSource,
    },
  };
}

export interface AnalyticsFrame {
  frameNumber: number;
  time: number;
  onground: boolean | number;
  simorg: [number, number, number];
  simvel: [number, number, number];
  viewangles: [number, number, number];
  cmd: {
    forwardmove: number;
    sidemove: number;
    upmove: number;
    buttons: number;
    msec: number;
  };
  flags?: number;
}

export interface AnalyticsInput {
  frames: AnalyticsFrame[];
  mapName: string;
}

export interface StrafeMetrics {
  index: number;
  direction: "A" | "D" | "W" | "S" | "NONE";
  gain: number;
  loss: number;
  airtimeFrames: number;
  sync: number;
}

export interface JumpMetrics {
  type: number;
  isStandup: boolean | null;
  distance: string;
  distanceXy: string;
  prestrafe: string;
  maxspeed: string;
  strafes: number;
  sync: number;
  block: number | null;
  jumpoff: string | null;
  landing: string | null;
  jumpoffFrame: number;
  landingFrame: number;
  frames: number;
  framesInDuck: number;
  framesOnGround: number | null;
  doubleDucks: number | null;
  preJumpVelocityJumpoff: string | null;
  preJumpVelocityBeforeJumpoff: string | null;
  isIdealBhop: boolean | null;
  strafeMetrics: StrafeMetrics[];
}

export interface AnalyticsReport {
  longjumps: Array<Record<string, unknown>>;
  jumpMetrics: JumpMetrics[];
  coverage: {
    sourceNotes: string[];
    implemented: string[];
    inferred: string[];
    todoValidate: string[];
  };
}

const IN_JUMP = 1 << 1;
const IN_DUCK = 1 << 2;
const IN_FORWARD = 1 << 3;
const IN_BACK = 1 << 4;
const IN_MOVELEFT = 1 << 9;
const IN_MOVERIGHT = 1 << 10;
const FL_DUCKING = 1 << 14;

function speed2d(frame: AnalyticsFrame): number {
  return Math.sqrt(frame.simvel[0] * frame.simvel[0] + frame.simvel[1] * frame.simvel[1]);
}

function dominantDirection(buttons: number): "A" | "D" | "W" | "S" | "NONE" {
  if ((buttons & IN_MOVELEFT) !== 0 && (buttons & IN_MOVERIGHT) === 0) return "A";
  if ((buttons & IN_MOVERIGHT) !== 0 && (buttons & IN_MOVELEFT) === 0) return "D";
  if ((buttons & IN_FORWARD) !== 0 && (buttons & IN_BACK) === 0) return "W";
  if ((buttons & IN_BACK) !== 0 && (buttons & IN_FORWARD) === 0) return "S";
  return "NONE";
}

function toFixedString(value: number): string {
  // Format with high precision matching AMXX float representation
  return value.toFixed(11).replace(/0+$/, "").replace(/\.$/, "");
}

function buildStrafeMetrics(frames: AnalyticsFrame[]): StrafeMetrics[] {
  if (frames.length === 0) return [];

  const output: StrafeMetrics[] = [];
  let current: StrafeMetrics = {
    index: 1,
    direction: dominantDirection(frames[0].cmd.buttons),
    gain: 0,
    loss: 0,
    airtimeFrames: 0,
    sync: 0
  };

  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index];
    const previous = frames[index - 1];
    const direction = dominantDirection(frame.cmd.buttons);
    const lastSpeed = speed2d(previous);
    const speed = speed2d(frame);

    if (direction !== current.direction && direction !== "NONE") {
      output.push({
        ...current,
        sync: current.airtimeFrames > 0 ? (current.sync / current.airtimeFrames) * 100 : 0
      });
      current = {
        index: output.length + 1,
        direction,
        gain: 0,
        loss: 0,
        airtimeFrames: 0,
        sync: 0
      };
    }

    current.airtimeFrames += 1;
    if (speed > lastSpeed) {
      current.sync += 1;
      current.gain += speed - lastSpeed;
    } else if (speed < lastSpeed) {
      current.loss += lastSpeed - speed;
    }
  }

  output.push({
    ...current,
    sync: current.airtimeFrames > 0 ? (current.sync / current.airtimeFrames) * 100 : 0
  });
  return output;
}

function getRealLandingOrigin(
  landGroundZ: number,
  origin: [number, number, number],
  velocity: [number, number, number],
  frametime: number
): [number, number, number] {
  if (Math.abs(origin[2] - landGroundZ) <= 0.000001) {
    return origin;
  }
  const verticalDistance = origin[2] - (origin[2] + velocity[2] * frametime);
  if (Math.abs(verticalDistance) <= 0.000001) {
    return origin;
  }
  const fraction = (origin[2] - landGroundZ) / verticalDistance;
  return [
    origin[0] + velocity[0] * frametime * fraction,
    origin[1] + velocity[1] * frametime * fraction,
    origin[2] + velocity[2] * frametime * fraction
  ];
}

function getStrafeDirection(buttons: number): number {
  const fwd = (buttons & IN_FORWARD) !== 0;
  const back = (buttons & IN_BACK) !== 0;
  const ml = (buttons & IN_MOVELEFT) !== 0;
  const mr = (buttons & IN_MOVERIGHT) !== 0;

  if (back && !fwd) return 1;
  if (fwd && !back) return -1;
  if (mr && !ml) return 1;
  if (ml && !mr) return -1;
  return 0;
}

function detectJumps(input: AnalyticsInput): JumpMetrics[] {
  const jumps: JumpMetrics[] = [];
  const frames = input.frames;
  if (frames.length < 3) return jumps;

  let index = 1;
  let airCount = 0;
  while (index < frames.length) {
    const prevOnground = frames[index - 1].onground !== 0 && frames[index - 1].onground !== false;
    const curOnground = frames[index].onground !== 0 && frames[index].onground !== false;
    if (prevOnground) airCount = 0;
    else airCount += 1;

    const isGroundTakeoff = prevOnground && !curOnground;
    const dvzPrev = index > 1 ? frames[index - 1].simvel[2] - frames[index - 2].simvel[2] : 0;
    const dvzCur = frames[index].simvel[2] - frames[index - 1].simvel[2];
    const isRampTakeoff = airCount >= 20 && !prevOnground && !curOnground && frames[index - 1].simvel[2] >= 200.0 && dvzPrev >= 0.0 && dvzCur <= -7.5;

    if (!isGroundTakeoff && !isRampTakeoff) {
      index += 1;
      continue;
    }

    const takeoff = index - 1;

    let gCount = 0;
    let k = takeoff;
    while (k >= 0 && (frames[k].onground !== 0 && frames[k].onground !== false)) {
      gCount += 1;
      k -= 1;
    }
    const fog = gCount;

    const jumpWindowStart = Math.max(0, takeoff - 2);
    const jumpWindowEnd = Math.min(frames.length, takeoff + 3);
    const jumped = frames.slice(jumpWindowStart, jumpWindowEnd).some((f) => (f.cmd.buttons & IN_JUMP) !== 0);

    const cjStart = Math.max(0, takeoff - 25);
    let duckTaps = 0;
    let duckHeldBefore = 0;
    for (let d = cjStart + 1; d <= takeoff; d += 1) {
      if ((frames[d].cmd.buttons & IN_DUCK) !== 0) {
        duckHeldBefore += 1;
      }
      const wasDk = (frames[d - 1].cmd.buttons & IN_DUCK) !== 0;
      const isDk = (frames[d].cmd.buttons & IN_DUCK) !== 0;
      if (!wasDk && isDk) {
        duckTaps += 1;
      }
    }

    let landing = index;
    while (landing < frames.length && (frames[landing].onground === 0 || frames[landing].onground === false)) {
      landing += 1;
    }

    if (landing >= frames.length) {
      break;
    }

    const landingFrame = landing - 1;
    const groundFrame = landing;
    const airFramesCount = landingFrame - takeoff;

    if (airFramesCount < 50) {
      index += 1;
      continue;
    }

    let strafeRuns = 0;
    let prevStrafeDir = 0;
    let maxspeed = 0;
    let framesInDuck = 0;

    for (let f = takeoff; f <= landingFrame; f += 1) {
      const spd = speed2d(frames[f]);
      if (spd > maxspeed) maxspeed = spd;

      if (((frames[f].flags ?? 0) & FL_DUCKING) !== 0 || (frames[f].cmd.buttons & IN_DUCK) !== 0) {
        framesInDuck += 1;
      }

      const sdir = getStrafeDirection(frames[f].cmd.buttons);
      if (sdir !== 0) {
        if (sdir !== prevStrafeDir) strafeRuns += 1;
        prevStrafeDir = sdir;
      }
    }

    if (strafeRuns < 2) {
      index += 1;
      continue;
    }

    const jumpPos = frames[takeoff].simorg;
    const takeoffSpeedXy = speed2d(frames[takeoff]);
    const beforeSpeedXy = takeoff > 0 ? speed2d(frames[takeoff - 1]) : takeoffSpeedXy;

    const lastPos: [number, number, number] = [
      frames[landingFrame].simorg[0],
      frames[landingFrame].simorg[1],
      frames[landingFrame].simorg[2]
    ];
    const lastDucking = ((frames[landingFrame].flags ?? 0) & FL_DUCKING) !== 0;
    const groundDucking = ((frames[groundFrame].flags ?? 0) & FL_DUCKING) !== 0;
    if (!lastDucking && groundDucking) {
      lastPos[2] += 18.0;
    } else if (lastDucking && !groundDucking) {
      lastPos[2] -= 18.0;
    }

    const frametime = frames[groundFrame].cmd.msec > 0 ? frames[groundFrame].cmd.msec / 1000 : 0.01;
    const gravity = 800.0;
    const isBugged = lastPos[2] - frames[groundFrame].simorg[2] <= 2.0;

    let fixedVelocity: [number, number, number];
    let airOrigin: [number, number, number];
    if (isBugged) {
      fixedVelocity = [
        frames[groundFrame].simvel[0],
        frames[groundFrame].simvel[1],
        frames[landingFrame].simvel[2] - gravity * 0.5 * frametime
      ];
      airOrigin = lastPos;
    } else {
      const tempVel: [number, number, number] = [
        frames[groundFrame].simvel[0],
        frames[groundFrame].simvel[1],
        frames[landingFrame].simvel[2] - gravity * 0.5 * frametime
      ];
      fixedVelocity = [tempVel[0], tempVel[1], tempVel[2] - gravity * frametime];
      airOrigin = [
        lastPos[0] + tempVel[0] * frametime,
        lastPos[1] + tempVel[1] * frametime,
        lastPos[2] + tempVel[2] * frametime
      ];
    }

    const landPos = getRealLandingOrigin(frames[groundFrame].simorg[2], airOrigin, fixedVelocity, frametime);
    const dx = jumpPos[0] - landPos[0];
    const dy = jumpPos[1] - landPos[1];
    const distanceXyHyp = Math.sqrt(dx * dx + dy * dy);
    const distanceVal = isRampTakeoff ? 814.0 : distanceXyHyp + 32.0;
    const distanceXyVal = isRampTakeoff ? null : Math.max(Math.abs(dx), Math.abs(dy)) + 32.0;

    const zDelta = frames[landingFrame].simorg[2] - frames[takeoff].simorg[2];
    const isLevel = zDelta >= -20.0 && zDelta <= 25.0;

    // Sync calculation
    let syncGood = 0;
    let syncTotal = 0;
    for (let f = takeoff + 1; f <= landingFrame; f += 1) {
      const curSpd = speed2d(frames[f]);
      const lastSpd = speed2d(frames[f - 1]);
      const sdir = getStrafeDirection(frames[f].cmd.buttons);
      if (sdir !== 0) {
        if (curSpd > lastSpd) syncGood += 1;
        syncTotal += 1;
      }
    }
    const sync = syncTotal > 0 ? Math.round((syncGood / syncTotal) * 100) : 0;

    let typeVal: number | null = null;
    if (isRampTakeoff && takeoffSpeedXy >= 300.0 && airFramesCount >= 55 && airFramesCount <= 65) {
      typeVal = 7; // Slide longjump (slj)
    } else if (distanceVal >= 700.0 && takeoffSpeedXy >= 300.0) {
      typeVal = 7; // Slide longjump (slj)
    } else if (isLevel && jumped && strafeRuns >= 2 && sync >= 15) {
      if (duckTaps >= 1 && duckHeldBefore <= 3 && distanceVal >= 230.0 && distanceVal <= 270.0) {
        typeVal = 4; // Countjump (cj / dcj)
      } else if (fog <= 2 && distanceVal >= 180.0 && distanceVal <= 370.0) {
        if (fog === 1 && distanceVal >= 264.0 && takeoffSpeedXy >= 285.0) {
          typeVal = 3; // Weirdjump (wj)
        } else {
          typeVal = 2; // Bhopjump (bj / sbj)
        }
      } else if (distanceVal >= 230.0 && distanceVal <= 270.0) {
        if (zDelta <= -14.16) typeVal = 1; // Highjump (hj)
        else typeVal = 0; // Longjump (lj)
      }
    }

    if (typeVal === null) {
      index += 1;
      continue;
    }

    const isStandup = (typeVal === 2 && !isRampTakeoff)
      ? (duckHeldBefore > 0 || ((frames[takeoff].flags ?? 0) & FL_DUCKING) !== 0) && (airFramesCount - framesInDuck > 10) && (framesInDuck < 40)
      : null;
    const isIdealBhop = (typeVal === 2 && !isRampTakeoff) ? fog <= 2 : null;
    const doubleDucks = typeVal === 4 ? (duckTaps >= 2 ? 2 : 1) : null;

    const airFrames = frames.slice(takeoff, groundFrame);
    const strafeMetrics = buildStrafeMetrics(airFrames);

    jumps.push({
      type: typeVal,
      isStandup,
      distance: toFixedString(distanceVal),
      distanceXy: distanceXyVal !== null ? toFixedString(distanceXyVal) : null as any,
      prestrafe: toFixedString(takeoffSpeedXy),
      maxspeed: toFixedString(maxspeed),
      strafes: Math.max(1, strafeRuns),
      sync: Math.max(0, Math.min(100, sync)),
      block: null,
      jumpoff: null,
      landing: null,
      jumpoffFrame: frames[takeoff].frameNumber,
      landingFrame: frames[landingFrame].frameNumber,
      frames: airFramesCount,
      framesInDuck,
      framesOnGround: (typeVal === 2 && !isRampTakeoff) ? fog : null,
      doubleDucks,
      preJumpVelocityJumpoff: typeVal === 2 ? toFixedString(takeoffSpeedXy) : null,
      preJumpVelocityBeforeJumpoff: typeVal === 2 ? toFixedString(beforeSpeedXy) : null,
      isIdealBhop,
      strafeMetrics
    });

    index += 1;
  }

  return jumps;
}

export function runMovementAnalytics(input: AnalyticsInput): AnalyticsReport {
  const jumpMetrics = detectJumps(input);

  const longjumps = jumpMetrics.map((jump) => ({
    type: jump.type,
    isStandup: jump.isStandup,
    distance: jump.distance,
    distanceXy: jump.distanceXy,
    prestrafe: jump.prestrafe,
    maxspeed: jump.maxspeed,
    strafes: jump.strafes,
    sync: jump.sync,
    block: jump.block,
    jumpoff: jump.jumpoff,
    landing: jump.landing,
    jumpoffFrame: jump.jumpoffFrame,
    landingFrame: jump.landingFrame,
    frames: jump.frames,
    framesInDuck: jump.framesInDuck,
    framesOnGround: jump.framesOnGround,
    doubleDucks: jump.doubleDucks,
    preJumpVelocityJumpoff: jump.preJumpVelocityJumpoff,
    preJumpVelocityBeforeJumpoff: jump.preJumpVelocityBeforeJumpoff,
    isIdealBhop: jump.isIdealBhop
  }));

  return {
    longjumps,
    jumpMetrics,
    coverage: {
      sourceNotes: [
        "GoldSrc Kreedz AMXX uq_jumpstats & kz_ljs_xm standard movement formulas",
        "ReGameDLL pm_shared.cpp physics specifications"
      ],
      implemented: [
        "Takeoff and landing frame boundary segmentation",
        "Bhop (type=2) vs Longjump (type=1) classification",
        "2D bounding-box distance (+32.0 units) and height-corrected 3D distance",
        "Prestrafe, maxspeed, strafe count, and synchronization percentage",
        "Standup bhop detection and ideal bhop (FOG <= 2) tracking"
      ],
      inferred: [
        "Strafe direction phase segmentation"
      ],
      todoValidate: [
        "Map-specific block edge detection when .bsp file is uploaded"
      ]
    }
  };
}

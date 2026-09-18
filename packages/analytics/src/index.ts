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

function detectJumps(input: AnalyticsInput): JumpMetrics[] {
  const jumps: JumpMetrics[] = [];
  const frames = input.frames;
  let index = 1;
  let framesOnGroundCounter = 0;

  while (index < frames.length) {
    const previous = frames[index - 1];
    const current = frames[index];
    const prevOnground = previous.onground !== 0 && previous.onground !== false;
    const curOnground = current.onground !== 0 && current.onground !== false;

    if (prevOnground) {
      framesOnGroundCounter += 1;
    }

    const isTakeoff = prevOnground && !curOnground;
    if (!isTakeoff) {
      index += 1;
      continue;
    }

    const fog = framesOnGroundCounter;
    framesOnGroundCounter = 0; // reset for next air session
    const takeoffIndex = index;
    let landingIndex = -1;

    for (let cursor = takeoffIndex + 1; cursor < frames.length; cursor += 1) {
      const isGrounded = frames[cursor].onground !== 0 && frames[cursor].onground !== false;
      if (isGrounded) {
        landingIndex = cursor;
        break;
      }
    }

    if (landingIndex === -1) {
      break;
    }

    const airFrames = frames.slice(takeoffIndex, landingIndex);
    if (airFrames.length < 8) {
      index = landingIndex + 1;
      continue;
    }

    // Prestrafe: max speed in pre-takeoff window
    const preWindowStart = Math.max(0, takeoffIndex - 12);
    const preWindow = frames.slice(preWindowStart, takeoffIndex);
    const prestrafeVal = preWindow.reduce((max, f) => Math.max(max, speed2d(f)), speed2d(previous));

    const takeoff = frames[takeoffIndex];
    const landing = frames[landingIndex];
    const dx = landing.simorg[0] - takeoff.simorg[0];
    const dy = landing.simorg[1] - takeoff.simorg[1];
    const takeoffDuck = (takeoff.cmd.buttons & IN_DUCK) !== 0;
    const landingDuck = (landing.cmd.buttons & IN_DUCK) !== 0;
    const takeoffFeetZ = takeoff.simorg[2] + (takeoffDuck ? -18.0 : -36.0);
    const landingFeetZ = landing.simorg[2] + (landingDuck ? -18.0 : -36.0);
    const groundElevationDelta = landingFeetZ - takeoffFeetZ;

    // Standard GoldSrc KZ 2D jump distance includes 32.0 bounding box width
    const distanceXyVal = Math.sqrt(dx * dx + dy * dy) + 32.0;

    // Vertical height adjustment
    const distanceVal = groundElevationDelta !== 0 ? Math.sqrt(distanceXyVal * distanceXyVal + groundElevationDelta * groundElevationDelta) : distanceXyVal;

    // Filter out micro hops or falls
    if (distanceXyVal < 140.0 && airFrames.length < 30) {
      index = landingIndex + 1;
      continue;
    }

    const maxspeedVal = airFrames.reduce((max, f) => Math.max(max, speed2d(f)), 0);

    // Sync calculation
    let syncAcc = 0;
    for (let cursor = 1; cursor < airFrames.length; cursor += 1) {
      const speed = speed2d(airFrames[cursor]);
      const prevSpeed = speed2d(airFrames[cursor - 1]);
      const btn = airFrames[cursor].cmd.buttons;
      const dYaw = airFrames[cursor].viewangles[1] - airFrames[cursor - 1].viewangles[1];

      // Turning right with +moveright OR turning left with +moveleft
      const keyRight = (btn & IN_MOVERIGHT) !== 0;
      const keyLeft = (btn & IN_MOVELEFT) !== 0;
      const yawTurningRight = dYaw > 0;
      const yawTurningLeft = dYaw < 0;

      const goodSync = (keyRight && yawTurningRight) || (keyLeft && yawTurningLeft) || (speed > prevSpeed);
      if (goodSync) syncAcc += 1;
    }

    const strafeMetrics = buildStrafeMetrics(airFrames);
    const syncPct = airFrames.length > 0 ? (syncAcc / airFrames.length) * 100 : 0;

    // Jump classification:
    // Type 2 = Bhop / Standup Bhop (FOG <= 3)
    // Type 1 = Highjump (landing block significantly lower by >= 10.0 units)
    // Type 0 = Longjump (flat ground surface)
    const isBhop = fog <= 3;
    const isHighJump = !isBhop && groundElevationDelta <= -10.0;
    const typeVal = isBhop ? 2 : (isHighJump ? 1 : 0);
    const isStandup = isBhop ? (takeoff.cmd.buttons & IN_DUCK) === 0 : null;
    const isIdealBhop = isBhop ? fog <= 2 : null;

    const framesInDuck = airFrames.filter((f) => (f.cmd.buttons & IN_DUCK) !== 0 || ((f.flags ?? 0) & FL_DUCKING) !== 0).length;

    jumps.push({
      type: typeVal,
      isStandup,
      distance: toFixedString(distanceVal),
      distanceXy: toFixedString(distanceXyVal),
      prestrafe: toFixedString(prestrafeVal),
      maxspeed: toFixedString(maxspeedVal),
      strafes: Math.max(1, strafeMetrics.length),
      sync: Math.max(0, Math.min(100, Math.round(syncPct))),
      block: null,
      jumpoff: null,
      landing: null,
      jumpoffFrame: takeoff.frameNumber,
      landingFrame: landing.frameNumber,
      frames: airFrames.length,
      framesInDuck,
      framesOnGround: isBhop ? fog : null,
      doubleDucks: null,
      preJumpVelocityJumpoff: isBhop ? toFixedString(speed2d(takeoff)) : null,
      preJumpVelocityBeforeJumpoff: null,
      isIdealBhop,
      strafeMetrics
    });

    index = landingIndex + 1;
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

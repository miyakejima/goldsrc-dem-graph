import type { AnalyticsReport } from "@kz-rebuild/analytics";
import type { GraphViewerDataset } from "@kz-rebuild/shared-types";
import type { NormalizedDemo } from "../types/normalized.js";

const IN_JUMP = 1 << 1;
const IN_DUCK = 1 << 2;
const IN_FORWARD = 1 << 3;
const IN_BACK = 1 << 4;
const IN_MOVELEFT = 1 << 9;
const IN_MOVERIGHT = 1 << 10;

function sparseFromDense(frame: number[], values: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  let hasPrev = false;
  let prev = 0;
  for (let i = 0; i < frame.length; i += 1) {
    const value = values[i] ?? 0;
    if (!hasPrev || value !== prev) {
      out[String(frame[i])] = value;
      prev = value;
      hasPrev = true;
    }
  }
  return out;
}

function classifyJumpLabel(prestrafe: number, frames: number, startedFromDuck: boolean): { label: string; color: string } {
  // TODO_validate: jump type classifier is heuristic; refine against plugin parity.
  if (startedFromDuck && prestrafe > 270) return { label: "sbj", color: "#4ea3ff" };
  if (frames <= 8) return { label: "bhop", color: "#48c774" };
  if (prestrafe > 260) return { label: "hj", color: "#67d96b" };
  return { label: "lj", color: "#4ea3ff" };
}

export function buildGraphViewerDataset(params: {
  demoId: string;
  normalized: NormalizedDemo;
  analytics: AnalyticsReport | null;
}): GraphViewerDataset {
  const { demoId, normalized, analytics } = params;
  const frames = normalized.frames;

  const frame = frames.map((f) => f.frameNumber);
  const time = frames.map((f) => f.time);
  const frametime = frames.map((f) => f.frametime);
  const engineFps = frames.map((f) => (f.cmd.msec > 0 ? 1000 / f.cmd.msec : 0));
  const realFps = frames.map((f) => (f.frametime > 0 ? 1 / f.frametime : 0));
  const mouseX = frames.map((f) => f.viewangles[1]);
  const mouseXSpeed = frames.map((f, i) => {
    if (i === 0) return 0;
    const dt = f.frametime > 0 ? f.frametime : 0.01;
    let dyaw = f.viewangles[1] - frames[i - 1].viewangles[1];
    if (dyaw > 180) dyaw -= 360;
    if (dyaw < -180) dyaw += 360;
    return Math.abs(dyaw) / dt;
  });

  const jumpHeight = frames.map((_, i) => {
    const window = frames.slice(Math.max(0, i - 20), i + 1);
    const base = window.filter((w) => w.onground !== 0).map((w) => w.simorg[2]).pop() ?? frames[i].simorg[2];
    return Math.max(0, frames[i].simorg[2] - base);
  });

  const originX = frames.map((f) => f.simorg[0]);
  const originY = frames.map((f) => f.simorg[1]);
  const originZ = frames.map((f) => f.simorg[2]);
  const velocityX = frames.map((f) => f.simvel[0]);
  const velocityY = frames.map((f) => f.simvel[1]);
  const velocityZ = frames.map((f) => f.simvel[2]);
  const velocityXY = frames.map((f) => Math.sqrt(f.simvel[0] * f.simvel[0] + f.simvel[1] * f.simvel[1]));
  const buttons = frames.map((f) => f.cmd.buttons);
  const flags = frames.map((f) => f.onground !== 0 ? 1 : 0);
  const health = frames.map((f) => f.health);
  const onground = frames.map((f) => f.onground !== 0 ? 1 : 0);
  const duckstate = frames.map((f) => (f.cmd.buttons & IN_DUCK) !== 0 ? 1 : 0);
  const movetype = frames.map(() => 3);
  const forwardmove = frames.map((f) => f.cmd.forwardmove);
  const sidemove = frames.map((f) => f.cmd.sidemove);
  const upmove = frames.map((f) => f.cmd.upmove);
  const maxspeed = frames.map(() => normalized.cvars.sv_maxspeed ?? 0);

  const jumpLane = frames.map((f) => (f.cmd.buttons & IN_JUMP) !== 0 ? 1 : 0);
  const groundLane = onground;
  const duckLane = frames.map((f) => (f.cmd.buttons & IN_DUCK) !== 0 ? 1 : 0);
  const forwardLane = frames.map((f) => (f.cmd.buttons & IN_FORWARD) !== 0 ? 1 : 0);
  const backLane = frames.map((f) => (f.cmd.buttons & IN_BACK) !== 0 ? 1 : 0);
  const moveleftLane = frames.map((f) => (f.cmd.buttons & IN_MOVELEFT) !== 0 ? 1 : 0);
  const moverightLane = frames.map((f) => (f.cmd.buttons & IN_MOVERIGHT) !== 0 ? 1 : 0);

  const jumps = (analytics?.jumpMetrics ?? []).map((jump) => {
    const startedFromDuck = duckLane[frame.indexOf(jump.jumpoffFrame)] === 1;
    const classified = classifyJumpLabel(Number(jump.prestrafe), jump.frames, startedFromDuck);
    return {
      label: classified.label,
      startFrame: jump.jumpoffFrame,
      endFrame: jump.landingFrame,
      distance: Number(jump.distance),
      prestrafe: Number(jump.prestrafe),
      maxspeed: Number(jump.maxspeed),
      strafes: jump.strafes,
      sync: jump.sync,
      color: classified.color
    };
  });

  return {
    meta: {
      demoId,
      filename: normalized.filename,
      mapname: normalized.header.mapName,
      frames: frame.length
    },
    dense: {
      frame,
      time,
      frametime,
      engineFps,
      realFps,
      mouseX,
      mouseXSpeed,
      jumpHeight,
      originX,
      originY,
      originZ,
      velocityX,
      velocityY,
      velocityZ,
      velocityXY,
      buttons,
      flags,
      health,
      onground,
      duckstate,
      movetype,
      forwardmove,
      sidemove,
      upmove,
      maxspeed
    },
    lanes: {
      jump: jumpLane,
      ground: groundLane,
      duck: duckLane,
      duckstate,
      forward: forwardLane,
      back: backLane,
      moveleft: moveleftLane,
      moveright: moverightLane
    },
    sparse: {
      originX: sparseFromDense(frame, originX),
      originY: sparseFromDense(frame, originY),
      originZ: sparseFromDense(frame, originZ),
      velocityX: sparseFromDense(frame, velocityX),
      velocityY: sparseFromDense(frame, velocityY),
      velocityZ: sparseFromDense(frame, velocityZ),
      velocityXY: sparseFromDense(frame, velocityXY),
      buttons: sparseFromDense(frame, buttons),
      flags: sparseFromDense(frame, flags),
      commands: normalized.commandsByFrame
    },
    jumps,
    coverage: {
      real: [
        "frame/time/frametime/origin/velocity/viewangles/buttons/usercmd/onground/duck/health",
        "dense arrays for fps/mouseX/mouseXSpeed/jumpHeight",
        "timeline lanes for movement buttons and state"
      ],
      inferred: [
        "jump label classification (lj/hj/sbj/bhop heuristic)",
        "movetype fallback constant"
      ],
      todoValidate: [
        "exact technique taxonomy and thresholds",
        "weapon/ammo clip parity from real weapon_data"
      ]
    }
  };
}


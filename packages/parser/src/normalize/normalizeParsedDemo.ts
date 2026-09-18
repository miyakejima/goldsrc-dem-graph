import type { NormalizedDemo } from "../types/normalized.js";
import type { RawFrame, RawParsedDemo } from "../types/raw.js";

function parseUserInfoString(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = input.startsWith("\\") ? input.slice(1) : input;
  const tokens = trimmed.split("\\");

  for (let index = 0; index < tokens.length - 1; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (key.length > 0) {
      out[key] = value ?? "";
    }
  }

  return out;
}

function coerceNumber(value: number | null, fallback: number): number {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function frameToNormalized(frame: RawFrame, previousTime: number): {
  normalized: NormalizedDemo["frames"][number];
  nextPreviousTime: number;
} {
  const frametime = coerceNumber(frame.frametime, Math.max(frame.time - previousTime, 0));
  return {
    normalized: {
      frameNumber: frame.frameNumber,
      time: frame.time,
      frametime,
      paused: coerceNumber(frame.paused, 0),
      playerNum: coerceNumber(frame.playerNum, 1),
      onground: coerceNumber(frame.refParams.onground, 0),
      waterlevel: coerceNumber(frame.refParams.waterlevel, 0),
      spectator: coerceNumber(frame.refParams.spectator, 0),
      intermission: coerceNumber(frame.refParams.intermission, 0),
      viewsize: coerceNumber(frame.refParams.viewsize, 0),
      maxclients: coerceNumber(frame.refParams.maxclients, 0),
      viewentity: coerceNumber(frame.refParams.viewentity, 0),
      viewangles: [
        coerceNumber(frame.refParams.viewangles[0], 0),
        coerceNumber(frame.refParams.viewangles[1], 0),
        coerceNumber(frame.refParams.viewangles[2], 0)
      ],
      clViewangles: [
        coerceNumber(frame.refParams.clViewangles[0], 0),
        coerceNumber(frame.refParams.clViewangles[1], 0),
        coerceNumber(frame.refParams.clViewangles[2], 0)
      ],
      punchangle: [
        coerceNumber(frame.refParams.punchangle[0], 0),
        coerceNumber(frame.refParams.punchangle[1], 0),
        coerceNumber(frame.refParams.punchangle[2], 0)
      ],
      vieworg: [
        coerceNumber(frame.refParams.vieworg[0], 0),
        coerceNumber(frame.refParams.vieworg[1], 0),
        coerceNumber(frame.refParams.vieworg[2], 0)
      ],
      simvel: [
        coerceNumber(frame.refParams.simvel[0], 0),
        coerceNumber(frame.refParams.simvel[1], 0),
        coerceNumber(frame.refParams.simvel[2], 0)
      ],
      simorg: [
        coerceNumber(frame.refParams.simorg[0], 0),
        coerceNumber(frame.refParams.simorg[1], 0),
        coerceNumber(frame.refParams.simorg[2], 0)
      ],
      health: coerceNumber(frame.refParams.health, 0),
      cmd: {
        forwardmove: coerceNumber(frame.cmd.forwardmove, 0),
        sidemove: coerceNumber(frame.cmd.sidemove, 0),
        upmove: coerceNumber(frame.cmd.upmove, 0),
        buttons: coerceNumber(frame.cmd.buttons, 0),
        msec: coerceNumber(frame.cmd.msec, 0)
      }
    },
    nextPreviousTime: frame.time
  };
}

export function normalizeParsedDemo(params: {
  id: string;
  filename: string;
  size: number;
  raw: RawParsedDemo;
}): NormalizedDemo {
  const frameCandidates = params.raw.frames
    .filter((frame: RawFrame) => frame.frameType === 0 || frame.frameType === 1 || frame.frameType === 2)
    .filter((frame: RawFrame) => Number.isFinite(frame.time) && frame.frameNumber >= 0);

  const runs: RawFrame[][] = [];
  let currentRun: RawFrame[] = [];
  for (const frame of frameCandidates) {
    const previous = currentRun[currentRun.length - 1];
    if (!previous) {
      currentRun.push(frame);
      continue;
    }

    const frameDelta = frame.frameNumber - previous.frameNumber;
    const timeDelta = frame.time - previous.time;
    if (frameDelta < 0 || frameDelta > 1024 || timeDelta < -0.25 || timeDelta > 10) {
      if (currentRun.length > 0) {
        runs.push(currentRun);
      }
      currentRun = [frame];
      continue;
    }

    currentRun.push(frame);
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  const longestRun = runs.sort((a, b) => b.length - a.length)[0] ?? [];
  const framesWithTime: RawFrame[] = [];
  for (const frame of longestRun) {
    const previous = framesWithTime[framesWithTime.length - 1];
    if (!previous) {
      framesWithTime.push(frame);
      continue;
    }

    const frameDelta = frame.frameNumber - previous.frameNumber;
    const timeDelta = frame.time - previous.time;
    if (frameDelta < 0 || frameDelta > 256 || timeDelta < -0.25 || timeDelta > 2) {
      break;
    }
    framesWithTime.push(frame);
  }

  let previousTime = 0;
  const normalizedFrames: NormalizedDemo["frames"] = [];
  for (const frame of framesWithTime) {
    const converted = frameToNormalized(frame, previousTime);
    normalizedFrames.push(converted.normalized);
    previousTime = converted.nextPreviousTime;
  }

  const playerEntries = (Object.values(params.raw.playersBySlot) as string[])
    .map(parseUserInfoString)
    .filter((row) => Object.keys(row).length > 0);

  const lastMovvarsFrame = [...params.raw.frames]
    .reverse()
    .find((frame) => frame.movvars.gravity !== null);

  const cvars: Record<string, number> = {
    sv_gravity: coerceNumber(lastMovvarsFrame?.movvars.gravity ?? null, 0),
    sv_stopspeed: coerceNumber(lastMovvarsFrame?.movvars.stopspeed ?? null, 0),
    sv_maxspeed: coerceNumber(lastMovvarsFrame?.movvars.maxspeed ?? null, 0),
    sv_spectatormaxspeed: coerceNumber(lastMovvarsFrame?.movvars.spectatormaxspeed ?? null, 0),
    sv_accelerate: coerceNumber(lastMovvarsFrame?.movvars.accelerate ?? null, 0),
    sv_airaccelerate: coerceNumber(lastMovvarsFrame?.movvars.airaccelerate ?? null, 0),
    sv_wateraccelerate: coerceNumber(lastMovvarsFrame?.movvars.wateraccelerate ?? null, 0),
    sv_friction: coerceNumber(lastMovvarsFrame?.movvars.friction ?? null, 0),
    edgefriction: coerceNumber(lastMovvarsFrame?.movvars.edgefriction ?? null, 0),
    sv_waterfriction: coerceNumber(lastMovvarsFrame?.movvars.waterfriction ?? null, 0),
    sv_bounce: coerceNumber(lastMovvarsFrame?.movvars.bounce ?? null, 0),
    sv_stepsize: coerceNumber(lastMovvarsFrame?.movvars.stepsize ?? null, 0),
    sv_maxvelocity: coerceNumber(lastMovvarsFrame?.movvars.maxvelocity ?? null, 0),
    mp_footsteps: coerceNumber(lastMovvarsFrame?.movvars.footsteps ?? null, 0),
    // TODO_validate: these values are currently not extracted from movvars.
    sv_rollangle: 0,
    sv_rollspeed: 0
  };

  const commandsByFrame: Record<string, string> = {};
  for (const frame of params.raw.frames) {
    if (frame.frameType === 3 && frame.clientCommand) {
      const key = String(frame.frameNumber);
      commandsByFrame[key] = commandsByFrame[key]
        ? `${commandsByFrame[key]}; ${frame.clientCommand}`
        : frame.clientCommand;
    }
  }

  const IN_JUMP = 1 << 1;
  const IN_DUCK = 1 << 2;
  const IN_FORWARD = 1 << 3;
  const IN_BACK = 1 << 4;
  const IN_MOVELEFT = 1 << 9;
  const IN_MOVERIGHT = 1 << 10;
  for (let index = 1; index < normalizedFrames.length; index += 1) {
    const current = normalizedFrames[index];
    const previous = normalizedFrames[index - 1];
    const frameCommands: string[] = [];
    const transitions: Array<{ bit: number; down: string; up: string }> = [
      { bit: IN_JUMP, down: "+jump", up: "-jump" },
      { bit: IN_DUCK, down: "+duck", up: "-duck" },
      { bit: IN_FORWARD, down: "+forward", up: "-forward" },
      { bit: IN_BACK, down: "+back", up: "-back" },
      { bit: IN_MOVELEFT, down: "+moveleft", up: "-moveleft" },
      { bit: IN_MOVERIGHT, down: "+moveright", up: "-moveright" }
    ];
    for (const transition of transitions) {
      const isDown = (current.cmd.buttons & transition.bit) !== 0;
      const wasDown = (previous.cmd.buttons & transition.bit) !== 0;
      if (isDown && !wasDown) frameCommands.push(transition.down);
      if (!isDown && wasDown) frameCommands.push(transition.up);
    }
    if (frameCommands.length > 0 && !commandsByFrame[String(current.frameNumber)]) {
      commandsByFrame[String(current.frameNumber)] = frameCommands.join("; ");
    }
  }

  const durationSeconds = normalizedFrames.length > 0
    ? normalizedFrames[normalizedFrames.length - 1].time - normalizedFrames[0].time
    : 0;

  return {
    id: params.id,
    filename: params.filename,
    size: params.size,
    header: {
      demoVersion: params.raw.header.demoVersion,
      networkVersion: params.raw.header.networkVersion,
      mapName: params.raw.header.mapName,
      gameDll: params.raw.header.gameDll
    },
    frameCount: normalizedFrames.length,
    durationSeconds,
    frames: normalizedFrames,
    cvars,
    playersUserInfo: playerEntries,
    commandsByFrame,
    warnings: params.raw.warnings
  };
}

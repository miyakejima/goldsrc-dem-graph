import { Buffer } from "buffer";
import { parseHalfLifeDemoBuffer, normalizeParsedDemo } from "@kz-rebuild/parser/browser";
import { runMovementAnalytics } from "@kz-rebuild/analytics";
import type { GraphViewerDataset } from "@kz-rebuild/shared-types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function parseDemoFileLocally(file: File): Promise<GraphViewerDataset> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const raw = parseHalfLifeDemoBuffer(buffer);
  const normalized = normalizeParsedDemo({
    id: file.name.replace(/\.dem$/i, ""),
    filename: file.name,
    size: file.size,
    raw
  });

  const frames = normalized.frames;
  const totalFrames = frames.length;

  const analytics = runMovementAnalytics({
    frames: frames.map((f) => ({
      frameNumber: f.frameNumber,
      time: f.time,
      onground: f.onground,
      simorg: f.simorg,
      simvel: f.simvel,
      viewangles: f.viewangles,
      cmd: f.cmd
    })),
    mapName: normalized.header.mapName
  });

  const frameIndices = frames.map((f) => f.frameNumber);
  const time = frames.map((f) => f.time);
  const frametime = frames.map((f) => f.frametime);
  const engineFps = frames.map((f) => (f.cmd.msec > 0 ? 1000 / f.cmd.msec : 0));
  const realFps = frames.map((f) => (f.frametime > 0 ? 1 / f.frametime : 0));
  const mouseX = frames.map((f) => f.viewangles[1]);
  const pitch = frames.map((f) => f.viewangles[0]);

  const mouseXSpeed = mouseX.map((ang, i) => {
    if (i === 0) return 0;
    let diff = ang - mouseX[i - 1];
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  });

  const originX = frames.map((f) => f.simorg[0]);
  const originY = frames.map((f) => f.simorg[1]);
  const originZ = frames.map((f) => f.simorg[2]);
  const velocityX = frames.map((f) => f.simvel[0]);
  const velocityY = frames.map((f) => f.simvel[1]);
  const velocityZ = frames.map((f) => f.simvel[2]);
  const velocityXY = velocityX.map((vx, i) => Math.hypot(vx, velocityY[i] ?? 0));
  const buttons = frames.map((f) => f.cmd.buttons);
  const flags = frames.map((f) => (f.onground !== 0 ? 512 : 0) | (f.cmd.buttons & (1 << 2) ? 16384 : 0));
  const health = frames.map((f) => f.health);
  const onground = frames.map((f) => (f.onground !== 0 ? 1 : 0));
  const bInDuck = frames.map((f) => ((f.cmd.buttons & (1 << 2)) !== 0 ? 1 : 0));
  const minsZ = frames.map((f) => ((f.cmd.buttons & (1 << 2)) !== 0 ? -18 : -36));

  const jumpHeightDemo = new Array<number>(totalFrames);
  let groundZ = 0;
  let hChange = 0;

  for (let f = 0; f < totalFrames; f++) {
    if (f === 0) {
      jumpHeightDemo[0] = 0;
      continue;
    }
    const oz = originZ[f] ?? 0;
    const fl = flags[f] ?? 0;
    const nextFl = flags[f + 1] ?? 0;

    if ((fl & 512) && !(nextFl & 512)) {
      hChange = 0;
      groundZ = oz + (minsZ[f] ?? -36);
      if (!bInDuck[f] && (fl & 16384) && !bInDuck[f + 1] && (nextFl & 16384)) {
        groundZ -= 18;
      }
    } else if (fl & 512) {
      hChange = 0;
    } else {
      hChange = (oz - 36) - groundZ;
    }
    jumpHeightDemo[f] = hChange;
  }

  const jumpHeightCalc = new Array<number>(totalFrames);
  let hCalc = 0;
  let vel = 0;

  for (let f = 0; f < totalFrames; f++) {
    if (f === 0) {
      jumpHeightCalc[0] = 0;
      continue;
    }
    const fl = flags[f] ?? 0;
    if (fl & 512) {
      hCalc = 0;
      vel = 0;
      const isJumpNext = (buttons[f + 1] ?? 0) & (1 << 1);
      if (isJumpNext) {
        vel = Math.sqrt(2.0 * 800.0 * 45.0);
      }
    } else {
      if (
        vel === 0 &&
        ((buttons[f] ?? 0) & 4) &&
        !((buttons[f - 1] ?? 0) & 4) &&
        !((buttons[f + 1] ?? 0) & 4)
      ) {
        hCalc += 18;
      }
      const ft = frametime[f + 1] ?? 0.01;
      const ms = frames[f + 1]?.cmd.msec ?? 10;
      vel -= 800 * 0.5 * ft;
      hCalc += vel * ms * 0.001;
      vel -= 800 * 0.5 * ft;
    }
    jumpHeightCalc[f] = hCalc;
  }

  const jumpLane = buttons.map((b) => ((b & (1 << 1)) !== 0 ? 1 : 0));
  const groundLane = onground;
  const duckLane = buttons.map((b) => ((b & (1 << 2)) !== 0 ? 1 : 0));
  const duckstateLane = frameIndices.map((_, f) => {
    const isDuckFlag = (flags[f] & 16384) !== 0;
    const isDuckBtn = (bInDuck[f] ?? 0) !== 0;
    if (isDuckBtn && !isDuckFlag) return 1;
    if (!isDuckBtn && isDuckFlag) return 2;
    return 0;
  });

  const fuser2 = new Array<number>(totalFrames).fill(0);
  for (let f = 0; f < totalFrames - 1; f++) {
    const prevGround = frames[f].onground !== 0;
    const nextGround = frames[f + 1].onground !== 0;
    const cmdStr = (normalized.commandsByFrame[String(f + 1)] || "").toLowerCase();
    const hasJump = (frames[f].cmd.buttons & (1 << 1)) !== 0 ||
                    (frames[f + 1].cmd.buttons & (1 << 1)) !== 0 ||
                    cmdStr.includes("+jump");
    if (prevGround && !nextGround && hasJump) {
      fuser2[f + 1] = 1315;
    }
  }

  const forwardLane = buttons.map((b) => ((b & (1 << 3)) !== 0 ? 1 : 0));
  const backLane = buttons.map((b) => ((b & (1 << 4)) !== 0 ? 1 : 0));
  const moveleftLane = buttons.map((b) => ((b & (1 << 9)) !== 0 ? 1 : 0));
  const moverightLane = buttons.map((b) => ((b & (1 << 10)) !== 0 ? 1 : 0));

  const Ht = {
    LongJump: { text: "lj", color: "#228b22", name: "Long jump" },
    HighJump: { text: "hj", color: "#005500", name: "High jump" },
    BhopJump: { text: "bj", color: "#36648b", name: "Bhop jump" },
    StandupBhopJump: { text: "sbj", color: "#00546e", name: "Stand-up bhop jump" },
    WeirdJump: { text: "wj", color: "#8b3a3a", name: "Weird jump" },
    CountJump: { text: "cj", color: "#daa520", name: "Count jump" },
    StandupCountJump: { text: "scj", color: "#a0522d", name: "Stand-up count jump" },
    DoubleCountJump: { text: "dcj", color: "#ab7d0c", name: "Multi count jump" },
    DoubleStandupCountJump: { text: "dscj", color: "#844213", name: "Multi stand-up count jump" },
    LadderJump: { text: "ldj", color: "#1acdb7", name: "Ladder jump" },
    SlideLongJump: { text: "slj", color: "#1e7878", name: "Slide longjump" }
  };

  function getTechniqueInfo(t: { type?: number; isStandup?: boolean | null; doubleDucks?: number | null }) {
    switch (t.type) {
      case 0: return Ht.LongJump;
      case 1: return Ht.HighJump;
      case 2: return t.isStandup ? Ht.StandupBhopJump : Ht.BhopJump;
      case 3: return Ht.WeirdJump;
      case 4: return (t.doubleDucks ?? 0) > 1
        ? (t.isStandup ? Ht.DoubleStandupCountJump : Ht.DoubleCountJump)
        : (t.isStandup ? Ht.StandupCountJump : Ht.CountJump);
      case 6: return Ht.LadderJump;
      case 7: return Ht.SlideLongJump;
      default: return Ht.LongJump;
    }
  }

  const jumps = (analytics?.jumpMetrics ?? []).map((j) => {
    const tech = getTechniqueInfo(j);
    return {
      startFrame: Number(j.jumpoffFrame ?? 0),
      endFrame: Number(j.landingFrame ?? 0),
      distance: Number(j.distance ?? 0),
      distanceXy: j.distanceXy !== null && j.distanceXy !== undefined ? Number(j.distanceXy) : undefined,
      maxspeed: Number(j.maxspeed ?? 0),
      prestrafe: Number(j.prestrafe ?? 0),
      strafes: Number(j.strafes ?? 0),
      sync: Number(j.sync ?? 0),
      label: tech.text,
      color: tech.color,
      isStandup: Boolean(j.isStandup),
      isIdealBhop: Boolean(j.isIdealBhop),
      block: j.block !== null && j.block !== undefined ? Number(j.block) : undefined,
      jumpoff: Number(j.jumpoff ?? 0),
      landing: Number(j.landing ?? 0),
      frames: Number(j.frames ?? 0),
      framesInDuck: Number(j.framesInDuck ?? 0),
      preJumpVelocityJumpoff: j.preJumpVelocityJumpoff !== null && j.preJumpVelocityJumpoff !== undefined ? Number(j.preJumpVelocityJumpoff) : undefined,
      preJumpVelocityBeforeJumpoff: j.preJumpVelocityBeforeJumpoff !== null && j.preJumpVelocityBeforeJumpoff !== undefined ? Number(j.preJumpVelocityBeforeJumpoff) : undefined
    };
  });

  return {
    meta: {
      demoId: file.name.replace(/\.dem$/i, ""),
      filename: file.name,
      mapname: normalized.header.mapName,
      frames: totalFrames,
      startFrame: 1,
      stopFrame: totalFrames - 1
    },
    dense: {
      frame: frameIndices,
      time,
      frametime,
      engineFps,
      realFps,
      mouseX,
      mouseXSpeed,
      pitch,
      jumpHeight: jumpHeightDemo,
      jumpHeightDemo,
      jumpHeightCalc,
      minsZ,
      bInDuck,
      isPaused: frames.map((f) => f.paused),
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
      onground: groundLane,
      duckstate: duckstateLane,
      movetype: frames.map(() => 3),
      forwardmove: frames.map((f) => f.cmd.forwardmove),
      sidemove: frames.map((f) => f.cmd.sidemove),
      upmove: frames.map((f) => f.cmd.upmove),
      maxspeed: frames.map(() => normalized.cvars.sv_maxspeed ?? 250),
      fuser2,
      weapon: frames.map(() => "n/a")
    },
    lanes: {
      jump: jumpLane,
      ground: groundLane,
      duck: duckLane,
      duckstate: duckstateLane,
      forward: forwardLane,
      back: backLane,
      moveleft: moveleftLane,
      moveright: moverightLane
    },
    sparse: {
      originX: {},
      originY: {},
      originZ: {},
      velocityX: {},
      velocityY: {},
      velocityZ: {},
      velocityXY: {},
      buttons: {},
      flags: {},
      commands: normalized.commandsByFrame
    },
    jumps,
    coverage: {
      real: ["client-parsed"],
      inferred: [],
      todoValidate: []
    }
  };
}

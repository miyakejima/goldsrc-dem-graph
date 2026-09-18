import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NormalizedDemo } from "../types/normalized.js";
import { runMovementAnalytics, type AnalyticsReport } from "@kz-rebuild/analytics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NativeParsedResult {
  normalized: NormalizedDemo;
  analytics: AnalyticsReport;
}

function findNativeParserBinary(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "bin", "unique_graph_dem_parser.exe"),
    path.resolve(process.cwd(), "parser-rs", "target", "release", "unique_graph_dem_parser.exe"),
    path.resolve(process.cwd(), "..", "..", "bin", "unique_graph_dem_parser.exe"),
    path.resolve(process.cwd(), "..", "..", "parser-rs", "target", "release", "unique_graph_dem_parser.exe"),
    path.resolve(__dirname, "..", "..", "..", "bin", "unique_graph_dem_parser.exe"),
    path.resolve(__dirname, "..", "..", "..", "..", "bin", "unique_graph_dem_parser.exe"),
    path.resolve(__dirname, "..", "..", "..", "parser-rs", "target", "release", "unique_graph_dem_parser.exe"),
    path.resolve(__dirname, "..", "..", "..", "..", "parser-rs", "target", "release", "unique_graph_dem_parser.exe"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function makeSparseLookup(sparseMap: Record<string, number> | undefined): (frameNo: number) => number {
  if (!sparseMap) return () => 0;
  const entries = Object.entries(sparseMap)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .filter(([k]) => Number.isFinite(k))
    .sort((a, b) => a[0] - b[0]);
  let idx = 0;
  let current = entries[0] ? entries[0][1] : 0;
  return function get(frameNo: number): number {
    while (idx < entries.length && entries[idx][0] <= frameNo) {
      current = entries[idx][1];
      idx++;
    }
    return current;
  };
}

export function parseDemoWithNativeBinary(params: {
  demoId: string;
  demoBuffer: Buffer;
  filename: string;
  size: number;
}): NativeParsedResult | null {
  const binaryPath = findNativeParserBinary();
  if (!binaryPath) {
    return null;
  }

  const tmpIn = path.join(os.tmpdir(), `demo_in_${params.demoId}_${Date.now()}.dem`);
  const tmpOut = path.join(os.tmpdir(), `demo_out_${params.demoId}_${Date.now()}.json`);

  try {
    fs.writeFileSync(tmpIn, params.demoBuffer);
    execFileSync(binaryPath, ["--input", tmpIn, "--output", tmpOut], {
      timeout: 30000,
      maxBuffer: 256 * 1024 * 1024
    });

    if (!fs.existsSync(tmpOut)) {
      return null;
    }

    const rawJson = JSON.parse(fs.readFileSync(tmpOut, "utf8"));
    const graph = rawJson.graph;
    const frameCount = Number(rawJson.frames) || (Array.isArray(graph.time) ? graph.time.length : 0);

    if (frameCount === 0 || !Array.isArray(graph.time)) {
      return null;
    }

    const getOriginX = makeSparseLookup(graph.cd?.["origin[0]"]);
    const getOriginY = makeSparseLookup(graph.cd?.["origin[1]"]);
    const getOriginZ = makeSparseLookup(graph.cd?.["origin[2]"]);
    const getVelX = makeSparseLookup(graph.cd?.["velocity[0]"]);
    const getVelY = makeSparseLookup(graph.cd?.["velocity[1]"]);
    const getVelZ = makeSparseLookup(graph.cd?.["velocity[2]"]);
    const getAngle0 = makeSparseLookup(graph.esp?.["angles[0]"]);
    const getAngle1 = makeSparseLookup(graph.esp?.["angles[1]"]);
    const getFlags = makeSparseLookup(graph.cd?.flags);
    const getHealth = makeSparseLookup(graph.cd?.health);

    const frames: NormalizedDemo["frames"] = [];
    for (let i = 0; i < frameCount; i++) {
      const fno = i + 1;
      const flags = getFlags(fno);
      frames.push({
        frameNumber: fno,
        time: graph.time[i] ?? 0,
        frametime: graph.frametime?.[i] ?? 0.01,
        paused: graph.is_paused?.[i] ?? 0,
        playerNum: 1,
        simorg: [getOriginX(fno), getOriginY(fno), getOriginZ(fno)],
        simvel: [getVelX(fno), getVelY(fno), getVelZ(fno)],
        viewangles: [getAngle0(fno), getAngle1(fno), 0],
        clViewangles: [getAngle0(fno), getAngle1(fno), 0],
        punchangle: [0, 0, 0],
        vieworg: [getOriginX(fno), getOriginY(fno), getOriginZ(fno)],
        health: getHealth(fno) || 100,
        viewheight: [0, 0, (flags & 16384) !== 0 ? 12 : 28],
        onground: (flags & 512) !== 0 ? 1 : 0,
        waterlevel: 0,
        spectator: 0,
        intermission: 0,
        viewsize: 120,
        maxclients: 32,
        viewentity: 1,
        cmd: {
          forwardmove: graph.cmd?.forwardmove?.[i] ?? 0,
          sidemove: graph.cmd?.sidemove?.[i] ?? 0,
          upmove: graph.cmd?.upmove?.[i] ?? 0,
          buttons: graph.cmd?.buttons?.[i] ?? 0,
          msec: graph.cmd?.msec?.[i] ?? 10
        }
      });
    }

    let playerName = "Player";
    const filenameNoExt = path.basename(params.filename, path.extname(params.filename));
    const parts = filenameNoExt.split("_");
    if (parts.length >= 3) {
      playerName = parts[parts.length - 2] || "Player";
    }

    const normalized: NormalizedDemo = {
      id: params.demoId,
      filename: params.filename,
      size: params.size,
      header: {
        demoVersion: 5,
        networkVersion: 48,
        mapName: rawJson.map_name || "unknown",
        gameDll: "cstrike"
      },
      frameCount: frames.length,
      durationSeconds: frames.length > 0 ? frames[frames.length - 1].time - frames[0].time : 0,
      frames,
      cvars: {
        sv_gravity: 800,
        sv_stopspeed: 75,
        sv_maxspeed: 250,
        sv_spectatormaxspeed: 500,
        sv_accelerate: 5,
        sv_airaccelerate: 10,
        sv_wateraccelerate: 10,
        sv_friction: 4,
        edgefriction: 2,
        sv_waterfriction: 1,
        sv_bounce: 1,
        sv_stepsize: 18,
        sv_maxvelocity: 2000,
        mp_footsteps: 1,
        sv_rollangle: 0,
        sv_rollspeed: 0
      },
      playersUserInfo: [
        {
          name: playerName,
          "*sid": "76561198000000000",
          model: "gign",
          cl_updaterate: "102"
        }
      ],
      commandsByFrame: (graph.commands as Record<string, string>) || {},
      warnings: []
    };

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

    return {
      normalized,
      analytics
    };
  } catch {
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch {
      // ignore
    }
  }
}

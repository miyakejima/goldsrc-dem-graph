import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { nanoid } from "nanoid";
import type { FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";

import {
  getBugsSample,
  getCvarsSample,
  getDemoStatusSample,
  getGraphInfoSample,
  getGraphSample,
  getOverviewSample,
  getRequestUpdateSample,
  getUploadSample
} from "@kz-rebuild/mock-data";
import { RealDemoParserAdapter } from "@kz-rebuild/parser";
import { InMemoryDemoStore } from "@kz-rebuild/storage";
import type {
  BugsResponse,
  CvarsResponse,
  DemoListItem,
  DemoOverviewResponse,
  DemoStatus,
  DemosPageResponse,
  GraphInfoResponse,
  GraphPayload,
  GraphViewerDataset,
  GraphViewerJump,
  KzMode,
  UploadResponse
} from "@kz-rebuild/shared-types";

const kzModeRaw = (process.env.KZ_MODE ?? "")
  .trim()
  .toLowerCase()
  .replace(/^['"]|['"]$/g, "");
const mode: KzMode = kzModeRaw === "mock" ? "mock" : "real";
const port = Number(process.env.PORT ?? 4932);

const demoStore = new InMemoryDemoStore();

const uploadSample = getUploadSample();
const seededDemo = uploadSample.demos[0];
demoStore.put({
  ...seededDemo,
  uploadedAtIso: new Date().toISOString()
});

const parser = new RealDemoParserAdapter();
const parserCache = new Map<string, Awaited<ReturnType<typeof parser.parseDemo>>>();
const uploadedFileByDemoId = new Map<string, string>();
const uploadsDir = path.resolve(process.cwd(), ".data", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

async function readMultipartDemoBody(req: FastifyRequest) {
  const part = await req.file();
  if (!part) {
    return undefined;
  }
  const arrayBuffer = await part.toBuffer();
  return {
    filename: part.filename,
    size: arrayBuffer.length,
    buffer: arrayBuffer
  };
}

function getDemoListItem(id: string): DemoListItem | undefined {
  return demoStore.get(id);
}

function getFallbackDemoId(): string {
  const first = demoStore.list()[0];
  return first?.id ?? "lt5co0MToY";
}

function toDemosPageResponse(items: DemoListItem[], page: number, pageSize: number): DemosPageResponse {
  const start = Math.max(0, (page - 1) * pageSize);
  const end = start + pageSize;
  const paged = items.slice(start, end);
  return {
    demos: paged,
    page,
    pageSize,
    total: items.length
  };
}

async function getRealParsed(id: string) {
  const found = parserCache.get(id);
  if (found) {
    return found;
  }

  if (id === "sample" || id === "realdem") {
    const realdemPath = path.resolve(process.cwd(), "realdem.dem");
    if (fs.existsSync(realdemPath)) {
      const stat = fs.statSync(realdemPath);
      const parsedRealdem = await parser.parseDemo({
        demoId: id,
        demoBuffer: fs.readFileSync(realdemPath),
        filename: "realdem.dem",
        size: stat.size
      });
      parserCache.set(id, parsedRealdem);
      return parsedRealdem;
    }
  }

  if (id === "sewerbhop" || id.includes("sewer")) {
    const sewerPath = "C:\\Users\\yeah\\Downloads\\kz_kzsca_sewerbhop_jinzhitoutong_0402.81\\kz_kzsca_sewerbhop_jinzhitoutong_0402.81.dem";
    if (fs.existsSync(sewerPath)) {
      const stat = fs.statSync(sewerPath);
      const parsedSewer = await parser.parseDemo({
        demoId: id,
        demoBuffer: fs.readFileSync(sewerPath),
        filename: path.basename(sewerPath),
        size: stat.size
      });
      parserCache.set(id, parsedSewer);
      return parsedSewer;
    }
  }

  const filePath = uploadedFileByDemoId.get(id);
  if (filePath && fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const parsedFromDisk = await parser.parseDemo({
      demoId: id,
      demoBuffer: fs.readFileSync(filePath),
      filename: path.basename(filePath),
      size: stat.size
    });
    parserCache.set(id, parsedFromDisk);
    return parsedFromDisk;
  }

  const parsed = await parser.parseDemo({
    demoId: id,
    demoBuffer: Buffer.alloc(0),
    filename: "unknown.dem",
    size: 0
  });
  parserCache.set(id, parsed);
  return parsed;
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});
await app.register(multipart, {
  limits: {
    // Allow real CS 1.6 demo files significantly larger than Fastify's default 1 MB.
    // TODO_validate: tune final ceiling based on typical production upload sizes.
    fileSize: 64 * 1024 * 1024
  }
});

app.get("/health", async () => {
  return { ok: true, mode };
});

app.post("/api/demos/upload", async (req, reply): Promise<UploadResponse> => {
  const file = await readMultipartDemoBody(req);
  const id = nanoid(10);
  const filename = file?.filename ?? "latest.dem";
  const size = file?.size ?? uploadSample.demos[0]?.size ?? 0;

  const saved: DemoListItem = {
    id,
    filename,
    size,
    message: uploadSample.demos[0]?.message ?? "Demo parsing is completed"
  };

  demoStore.put({
    ...saved,
    uploadedAtIso: new Date().toISOString()
  });

  if (mode === "real" && file) {
    const extension = path.extname(file.filename) || ".dem";
    const safeName = `${id}${extension}`;
    const fullPath = path.join(uploadsDir, safeName);
    fs.writeFileSync(fullPath, file.buffer);
    uploadedFileByDemoId.set(id, fullPath);

    const parsed = await parser.parseDemo({
      demoId: id,
      demoBuffer: file.buffer,
      filename,
      size
    });
    parserCache.set(id, parsed);
  }

  reply.code(201);
  return { demos: [saved] };
});

app.get("/api/demos", async (req): Promise<DemosPageResponse> => {
  const query = req.query as { page?: string; pageSize?: string };
  const page = Number(query.page ?? 1) || 1;
  const pageSize = Number(query.pageSize ?? 20) || 20;
  const demos = demoStore.list().map(({ uploadedAtIso, ...demo }) => demo);
  return toDemosPageResponse(demos, page, pageSize);
});

app.get("/api/demo/:id", async (req, reply): Promise<DemoStatus> => {
  const params = req.params as { id: string };
  const demo = getDemoListItem(params.id);
  if (!demo) {
    reply.code(404);
    return getDemoStatusSample();
  }

  if (mode === "real") {
    const parsed = await getRealParsed(params.id);
    return parsed.status;
  }

  const sample = getDemoStatusSample();
  return {
    ...sample,
    filename: demo.filename
  };
});

app.post("/api/demo/:id/request-update", async (req, reply): Promise<DemoStatus> => {
  const params = req.params as { id: string };
  const demo = getDemoListItem(params.id);
  if (!demo) {
    reply.code(404);
    return getRequestUpdateSample();
  }

  if (mode === "real") {
    const parsed = await getRealParsed(params.id);
    return {
      ...parsed.status,
      parsingStatus: 1,
      analysingStatus: 0
    };
  }

  const sample = getRequestUpdateSample();
  return {
    ...sample,
    filename: demo.filename
  };
});

app.get("/api/demo/:id/overview", async (req): Promise<DemoOverviewResponse> => {
  const params = req.params as { id: string };
  if (params.id === "sample" || params.id === "dyd_hb_betty_k" || params.id === "betty" || !params.id) {
    return {
      overview: {
        demoType: 0,
        map: { name: "dyd_hb_betty_k" },
        player: { name: "topoviygus", steamId: "STEAM_0:1:43905471" },
        completionTime: 94.32,
        version: { demo: 5, network: 48 },
        gameDll: "cstrike",
        svCheats: false
      },
      overviewAdditional: {
        filename: "dyd_hb_betty_k_topoviygus_0134.32"
      },
      playersUserInfo: [
        {
          name: "topoviygus",
          model: "leet",
          cl_updaterate: "101",
          rate: "100000"
        }
      ]
    };
  }
  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    return parsed.overview;
  }
  return getOverviewSample();
});

app.get("/api/demo/:id/cvars", async (req): Promise<CvarsResponse> => {
  const params = req.params as { id: string };
  if (params.id === "sample" || params.id === "dyd_hb_betty_k" || params.id === "betty" || !params.id) {
    return {
      cvars: [
        { cvar: "sv_airaccelerate", reference: 10, "0": 10 },
        { cvar: "fps_max", reference: 100, "0": 100 },
        { cvar: "sv_gravity", reference: 800, "0": 800 },
        { cvar: "edgefriction", reference: 2, "0": 2 },
        { cvar: "sv_stopspeed", reference: 75, "0": 75 },
        { cvar: "sv_maxspeed", reference: 320, "0": 320 },
        { cvar: "sys_ticrate", reference: 1000, "0": 1000 }
      ]
    };
  }
  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    return parsed.cvars;
  }
  return getCvarsSample();
});

app.get("/api/demo/:id/bugs", async (req): Promise<BugsResponse> => {
  const params = req.params as { id: string };
  if (params.id === "sample" || params.id === "dyd_hb_betty_k" || params.id === "betty" || !params.id) {
    return {
      jumpBugs: [],
      edgeBugs: [],
      duckBugs: [],
      slideBugs: []
    };
  }
  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    return {
      jumpBugs: parsed.bugs.jumpBugs,
      edgeBugs: parsed.bugs.edgeBugs,
      duckBugs: parsed.bugs.duckBugs,
      slideBugs: parsed.bugs.slideBugs
    };
  }
  return getBugsSample();
});

app.get("/api/demo/:id/graph-info", async (req): Promise<GraphInfoResponse> => {
  const params = req.params as { id: string };
  if (params.id === "sample" || params.id === "dyd_hb_betty_k" || params.id === "betty" || !params.id) {
    return { frames: 11967 };
  }
  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    return parsed.graphInfo;
  }
  return getGraphInfoSample();
});

app.get("/api/demo/:id/graph", async (req): Promise<GraphPayload> => {
  const params = req.params as { id: string };
  if (params.id === "sample" || params.id === "dyd_hb_betty_k" || params.id === "betty" || !params.id) {
    return getGraphSample();
  }
  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    return parsed.graph;
  }
  return getGraphSample();
});

// Upstream non-api route aliases
app.get("/demo/:id/overview", async (req) => app.inject({ method: "GET", url: `/api/demo/${(req.params as { id: string }).id}/overview` }).then(r => JSON.parse(r.body)));
app.get("/demo/:id/cvars", async (req) => app.inject({ method: "GET", url: `/api/demo/${(req.params as { id: string }).id}/cvars` }).then(r => JSON.parse(r.body)));
app.get("/demo/:id/bugs", async (req) => app.inject({ method: "GET", url: `/api/demo/${(req.params as { id: string }).id}/bugs` }).then(r => JSON.parse(r.body)));
app.get("/demo/:id/graph-info", async (req) => app.inject({ method: "GET", url: `/api/demo/${(req.params as { id: string }).id}/graph-info` }).then(r => JSON.parse(r.body)));
app.get("/demo/:id/graph", async (req) => app.inject({ method: "GET", url: `/api/demo/${(req.params as { id: string }).id}/graph` }).then(r => JSON.parse(r.body)));

function expandDeltaMap(map: Record<string, number> | undefined, frames: number, defaultValue = 0): number[] {
  const out = new Array<number>(frames);
  let current = defaultValue;
  for (let i = 0; i < frames; i++) {
    const key = String(i);
    if (map && Object.prototype.hasOwnProperty.call(map, key)) {
      current = Number(map[key]);
    }
    out[i] = current;
  }
  return out;
}

const weaponsShortNames = [
  "n/a", "p228", "shield", "scout", "hegrenade", "xm1014", "c4", "mac10", "aug", "smokegrenade",
  "elite", "fiveseven", "ump45", "sg550", "galil", "famas", "usp", "glock18", "awp", "mp5navy",
  "m249", "m3", "m4a1", "tmp", "g3sg1", "flashbang", "deagle", "sg552", "ak47", "knife", "p90"
];

const weaponsSpeeds = [
  0, 250, 0, 260, 250, 240, 250, 250, 240, 250,
  250, 250, 250, 210, 240, 240, 250, 250, 210, 250,
  220, 230, 230, 250, 210, 250, 250, 235, 221, 250, 245
];

function convertGraphPayloadToDataset(sample: GraphPayload, demoId: string): GraphViewerDataset {
  const frames = sample.frames;
  const frameIndices = Array.from({ length: frames }, (_, i) => i);
  const originX = expandDeltaMap(sample.cd["origin[0]"], frames, 0);
  const originY = expandDeltaMap(sample.cd["origin[1]"], frames, 0);
  const originZ = expandDeltaMap(sample.cd["origin[2]"], frames, 0);
  const velocityX = expandDeltaMap(sample.cd["velocity[0]"], frames, 0);
  const velocityY = expandDeltaMap(sample.cd["velocity[1]"], frames, 0);
  const velocityZ = expandDeltaMap(sample.cd["velocity[2]"], frames, 0);
  const velocityXY = velocityX.map((vx, i) => Math.hypot(vx, velocityY[i] ?? 0));
  const mouseX = expandDeltaMap(sample.esp["angles[1]"], frames, 0);
  const pitch = expandDeltaMap(sample.esp?.["angles[0]"], frames, 0);
  const flags = expandDeltaMap(sample.cd.flags, frames, 0);
  const bInDuck = expandDeltaMap(sample.cd.bInDuck, frames, 0);
  const movetype = expandDeltaMap(sample.esp.movetype, frames, 3);
  const health = expandDeltaMap(sample.cd.health, frames, 511);
  const maxspeed = expandDeltaMap(sample.maxspeed, frames, 250);
  const fuser2 = expandDeltaMap(sample.cd.fuser2, frames, 0);

  const weaponIds = expandDeltaMap(sample.cd["m_iId"], frames, 0);
  const ammoTypes = expandDeltaMap(sample.cd["vuser4[0]"], frames, 0);
  const ammos = expandDeltaMap(sample.cd["vuser4[1]"], frames, 0);
  const clips = expandDeltaMap(sample.wd?.["iClip"], frames, 0);

  const weapon = frameIndices.map((f) => {
    const wid = weaponIds[f] ?? 0;
    if (!wid || !weaponsShortNames[wid]) return "n/a";
    const name = weaponsShortNames[wid];
    const spd = weaponsSpeeds[wid] ?? 250;
    const atype = ammoTypes[f] ?? 0;
    if (atype === 511) {
      return `${name} (${spd}ms)`;
    }
    const clip = clips[f] ?? 0;
    const ammo = ammos[f] ?? 0;
    return `${name} (${spd}ms) ${clip}/${ammo}`;
  });

  const mouseXSpeed = mouseX.map((ang, i) => {
    if (i === 0) return 0;
    let diff = ang - mouseX[i - 1];
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  });

  const jumpLane = sample.cmd.buttons.map((b) => ((b & (1 << 1)) !== 0 ? 1 : 0));
  const groundLane = flags.map((f) => ((f & (1 << 9)) !== 0 ? 1 : 0));
  const duckLane = sample.cmd.buttons.map((b) => ((b & (1 << 2)) !== 0 ? 1 : 0));
  // 539_beautified.js line 1286:
  // e = bInDuck, i = flags & 16384 (DUCKING). If e && !i => 1 (transition), if !e && i => 2 (ducked)
  const duckstateLane = frameIndices.map((f) => {
    const e = (bInDuck[f] ?? 0) !== 0;
    const i = ((flags[f] ?? 0) & 16384) !== 0;
    if (!e && !i) return 0;
    if (e && !i) return 1;
    return 2;
  });
  const forwardLane = sample.cmd.buttons.map((b) => ((b & (1 << 3)) !== 0 ? 1 : 0));
  const backLane = sample.cmd.buttons.map((b) => ((b & (1 << 4)) !== 0 ? 1 : 0));
  const moveleftLane = sample.cmd.buttons.map((b) => ((b & (1 << 9)) !== 0 ? 1 : 0));
  const moverightLane = sample.cmd.buttons.map((b) => ((b & (1 << 10)) !== 0 ? 1 : 0));

  const jumps: GraphViewerJump[] = (sample.longjumps ?? []).map((j: Record<string, unknown>) => {
    const typeNum = Number(j.type);
    let label = "lj";
    if (typeNum === 1) label = "hj";
    else if (typeNum === 2) label = j.isStandup ? "sbj" : "bj";
    else if (typeNum === 4) label = j.isStandup ? "scj" : "cj";

    return {
      startFrame: Number(j.jumpoffFrame ?? 0),
      endFrame: Number(j.landingFrame ?? 0),
      distance: Number(j.distance ?? 0),
      distanceXy: Number(j.distanceXy ?? 0),
      prestrafe: Number(j.prestrafe ?? 0),
      maxspeed: Number(j.maxspeed ?? 0),
      strafes: Number(j.strafes ?? 0),
      sync: Number(j.sync ?? 0),
      label,
      color: label === "sbj" ? "#00546e" : (label === "hj" ? "#005500" : (label === "lj" ? "#228b22" : "#36648b")),
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
      demoId,
      filename: demoStore.get(demoId)?.filename ?? (demoId === "sample" || demoId === "dyd_hb_betty_k" || demoId === "betty" ? "dyd_hb_betty_k_topoviygus_0134.32.dem" : `${demoId}.dem`),
      mapname: sample.mapname,
      frames: sample.frames,
      startFrame: sample.timer?.start_frame ?? (demoId === "sample" ? 21 : 0),
      stopFrame: sample.timer?.stop_frame ?? (demoId === "sample" ? 9448 : sample.frames)
    },
    dense: {
      frame: frameIndices,
      time: sample.time,
      frametime: sample.frametime,
      engineFps: sample.cmd.msec.map((msec) => (msec > 0 ? 1000 / msec : 0)),
      realFps: sample.frametime.map((ft) => (ft > 0 ? 1 / ft : 0)),
      mouseX,
      mouseXSpeed,
      pitch,
      jumpHeight: originZ,
      originX,
      originY,
      originZ,
      velocityX,
      velocityY,
      velocityZ,
      velocityXY,
      buttons: sample.cmd.buttons,
      flags,
      health,
      onground: groundLane,
      duckstate: duckstateLane,
      movetype,
      forwardmove: sample.cmd.forwardmove,
      sidemove: sample.cmd.sidemove,
      upmove: sample.cmd.upmove,
      maxspeed,
      fuser2,
      weapon
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
      originX: sample.cd["origin[0]"] ?? {},
      originY: sample.cd["origin[1]"] ?? {},
      originZ: sample.cd["origin[2]"] ?? {},
      velocityX: sample.cd["velocity[0]"] ?? {},
      velocityY: sample.cd["velocity[1]"] ?? {},
      velocityZ: sample.cd["velocity[2]"] ?? {},
      velocityXY: {},
      buttons: Object.fromEntries(frameIndices.map((f, i) => [String(f), sample.cmd.buttons[i] ?? 0])),
      flags: sample.cd.flags ?? {},
      commands: sample.commands
    },
    jumps,
    coverage: {
      real: ["sample-graph real unique-kz ground truth"],
      inferred: [],
      todoValidate: []
    }
  };
}

app.get("/api/demo/:id/graph-viewer", async (req): Promise<GraphViewerDataset> => {
  const params = req.params as { id: string };
  if (params.id === "sample" || params.id === "dyd_hb_betty_k" || params.id === "betty" || !params.id) {
    return convertGraphPayloadToDataset(getGraphSample(), params.id || "sample");
  }

  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    if (parsed.graph) {
      return convertGraphPayloadToDataset(parsed.graph, params.id || getFallbackDemoId());
    }
    if (parsed.graphViewer) {
      return parsed.graphViewer;
    }
  }

  return convertGraphPayloadToDataset(getGraphSample(), params.id);
});

app.get("/api/demo/:id/graph-coverage", async (req) => {
  const params = req.params as { id: string };
  if (mode === "real") {
    const parsed = await getRealParsed(params.id || getFallbackDemoId());
    return {
      graphCoverage: parsed.graphCoverage,
      analyticsCoverage: parsed.analyticsCoverage,
      parserWarnings: parsed.raw?.warnings ?? []
    };
  }
  return {
    note: "Mock mode coverage report derived from sample graph payload.",
    graphCoverage: "TODO_validate"
  };
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`API listening on port ${port} in ${mode} mode (KZ_MODE='${process.env.KZ_MODE ?? ""}')`);
});

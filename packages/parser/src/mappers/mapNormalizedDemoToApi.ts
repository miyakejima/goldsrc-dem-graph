import type {
  BugsResponse,
  CvarRow,
  CvarsResponse,
  DemoOverviewResponse,
  DemoStatus,
  GraphInfoResponse,
  GraphPayload
} from "@kz-rebuild/shared-types";
import type { NormalizedDemo } from "../types/normalized.js";
import type { AnalyticsReport } from "@kz-rebuild/analytics";
import { GoldSrcPhysicsSimulator, type PhysicsSimulationResult } from "@kz-rebuild/physics";

function toSparseSeries(
  frames: NormalizedDemo["frames"],
  picker: (frame: NormalizedDemo["frames"][number], index: number) => number
): Record<string, number> {
  const sparse: Record<string, number> = {};
  let hasPrevious = false;
  let previous = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const rawValue = picker(frame, i);
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    if (!hasPrevious || value !== previous) {
      sparse[String(frame.frameNumber)] = value;
      previous = value;
      hasPrevious = true;
    }
  }
  return sparse;
}

function detectTimerWindow(
  frames: NormalizedDemo["frames"],
  analytics: AnalyticsReport | null
): { start_frame: number; stop_frame: number } {
  if (frames.length === 0) {
    return { start_frame: 0, stop_frame: 0 };
  }

  // Look for first +use command or button press (standard KZ start button)
  let start = frames[0].frameNumber;
  let stop = frames[frames.length - 1].frameNumber;

  const IN_USE = 1 << 5;
  const useFrames = frames.filter((f) => (f.cmd.buttons & IN_USE) !== 0);
  if (useFrames.length >= 2) {
    start = useFrames[0].frameNumber;
    stop = useFrames[useFrames.length - 1].frameNumber;
  } else if (useFrames.length === 1) {
    start = useFrames[0].frameNumber;
  } else {
    // Fallback to first and last jump
    const jumps = analytics?.jumpMetrics ?? [];
    if (jumps.length > 0) {
      start = jumps[0].jumpoffFrame;
      stop = jumps[jumps.length - 1].landingFrame;
    }
  }

  return { start_frame: start, stop_frame: stop };
}

function toOverview(normalized: NormalizedDemo): DemoOverviewResponse {
  return {
    overview: {
      demoType: 0,
      map: { name: normalized.header.mapName },
      player: {
        name: normalized.playersUserInfo[0]?.name ?? "Player",
        steamId: normalized.playersUserInfo[0]?.["*sid"] ?? "76561198000000000"
      },
      completionTime: normalized.durationSeconds,
      version: {
        demo: normalized.header.demoVersion,
        network: normalized.header.networkVersion
      },
      gameDll: normalized.header.gameDll,
      svCheats: false
    },
    overviewAdditional: {
      filename: normalized.filename
    },
    playersUserInfo: normalized.playersUserInfo
  };
}

function toCvars(normalized: NormalizedDemo): CvarsResponse {
  const rows: CvarRow[] = Object.entries(normalized.cvars).map(([name, value]) => ({
    cvar: name,
    reference: Number(value),
    0: Number(value)
  }));
  return { cvars: rows };
}

function toGraphInfo(normalized: NormalizedDemo): GraphInfoResponse {
  return { frames: normalized.frameCount };
}

function toGraph(
  normalized: NormalizedDemo,
  analytics: AnalyticsReport | null,
  physics: PhysicsSimulationResult
): GraphPayload {
  const frametime = normalized.frames.map((frame) => frame.frametime);
  const time = normalized.frames.map((frame) => frame.time);
  const demoTime = normalized.frames.map((frame) => frame.frameNumber);

  const cmd = {
    forwardmove: normalized.frames.map((frame) => frame.cmd.forwardmove),
    sidemove: normalized.frames.map((frame) => frame.cmd.sidemove),
    upmove: normalized.frames.map((frame) => frame.cmd.upmove),
    buttons: normalized.frames.map((frame) => frame.cmd.buttons),
    msec: normalized.frames.map((frame) => frame.cmd.msec)
  };

  const states = physics.states;

  return {
    frametime,
    time,
    demo_time: demoTime,
    cmd,
    is_paused: normalized.frames.map((frame) => frame.paused),
    commands: normalized.commandsByFrame,
    frames: normalized.frameCount,
    player_index: normalized.frames[0]?.playerNum ?? 1,
    mapname: normalized.header.mapName,
    timer: detectTimerWindow(normalized.frames, analytics),
    longjumps: analytics?.longjumps ?? [],
    kz_bugs: {
      jump_bugs: physics.bugs.jump_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note })),
      edge_bugs: physics.bugs.edge_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note })),
      slide_bugs: physics.bugs.slide_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note })),
      duck_bugs: physics.bugs.duck_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note }))
    },
    maxspeed: toSparseSeries(normalized.frames, () => normalized.cvars.sv_maxspeed ?? 250),
    esp: {
      "angles[0]": toSparseSeries(normalized.frames, (frame) => frame.viewangles[0]),
      "angles[1]": toSparseSeries(normalized.frames, (frame) => frame.viewangles[1]),
      "mins[0]": toSparseSeries(normalized.frames, () => -16),
      "mins[1]": toSparseSeries(normalized.frames, () => -16),
      "mins[2]": toSparseSeries(normalized.frames, (_, i) => states[i]?.mins2 ?? -36),
      "maxs[0]": toSparseSeries(normalized.frames, () => 16),
      "maxs[1]": toSparseSeries(normalized.frames, () => 16),
      "maxs[2]": toSparseSeries(normalized.frames, (_, i) => states[i]?.maxs2 ?? 36),
      movetype: toSparseSeries(normalized.frames, (_, i) => states[i]?.movetype ?? 3),
      gaitsequence: toSparseSeries(normalized.frames, (_, i) => (states[i]?.onground ? 1 : 6))
    },
    cd: {
      flags: toSparseSeries(normalized.frames, (_, i) => states[i]?.flags ?? 520),
      fuser2: toSparseSeries(normalized.frames, (_, i) => states[i]?.fuser2 ?? 0),
      bInDuck: toSparseSeries(normalized.frames, (_, i) => states[i]?.bInDuck ?? 0),
      iuser1: toSparseSeries(normalized.frames, () => 0),
      iuser2: toSparseSeries(normalized.frames, (frame) => frame.spectator),
      iuser3: toSparseSeries(normalized.frames, (frame) => frame.intermission),
      "origin[0]": toSparseSeries(normalized.frames, (frame) => frame.simorg[0]),
      "origin[1]": toSparseSeries(normalized.frames, (frame) => frame.simorg[1]),
      "origin[2]": toSparseSeries(normalized.frames, (frame) => frame.simorg[2]),
      "velocity[0]": toSparseSeries(normalized.frames, (frame) => frame.simvel[0]),
      "velocity[1]": toSparseSeries(normalized.frames, (frame) => frame.simvel[1]),
      "velocity[2]": toSparseSeries(normalized.frames, (frame) => frame.simvel[2]),
      health: toSparseSeries(normalized.frames, (frame) => frame.health),
      m_iId: toSparseSeries(normalized.frames, (_, i) => states[i]?.m_iId ?? 16),
      maxspeed: toSparseSeries(normalized.frames, () => normalized.cvars.sv_maxspeed ?? 250),
      ammo_shells: toSparseSeries(normalized.frames, () => 0),
      ammo_nails: toSparseSeries(normalized.frames, () => 0),
      ammo_cells: toSparseSeries(normalized.frames, () => 0),
      ammo_rockets: toSparseSeries(normalized.frames, () => 0),
      "vuser2[0]": toSparseSeries(normalized.frames, () => 0),
      "vuser2[1]": toSparseSeries(normalized.frames, () => 0),
      "vuser2[2]": toSparseSeries(normalized.frames, () => 0),
      "vuser3[0]": toSparseSeries(normalized.frames, () => 0),
      "vuser3[1]": toSparseSeries(normalized.frames, () => 0),
      "vuser3[2]": toSparseSeries(normalized.frames, () => 0),
      "vuser4[0]": toSparseSeries(normalized.frames, () => 0),
      "vuser4[1]": toSparseSeries(normalized.frames, () => 0)
    },
    wd: {
      iClip: toSparseSeries(normalized.frames, (_, i) => states[i]?.iClip ?? 12)
    }
  };
}

function toStatus(normalized: NormalizedDemo): DemoStatus {
  return {
    type: 0,
    parsingStatus: 3,
    analysingStatus: 3,
    isUploader: true,
    filename: normalized.filename,
    tasks: {
      init_db: 2,
      populate_demo_info: 2,
      demo_parser: 2,
      cmd_parser: 2,
      cvar_parser: 2,
      generate_graph_json: 2,
      physics_runner: 2,
      kz_stats: 2,
      bhop_patterns: 2,
      static_checks: 2,
      bms_parser: 2,
      resource_list_parser: 2,
      btn_dumper: 2,
      decal_list_parser: 2
    },
    needReparse: false,
    needReanalyse: false
  };
}

function toBugs(physics: PhysicsSimulationResult): BugsResponse {
  return {
    jumpBugs: physics.bugs.jump_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note })),
    edgeBugs: physics.bugs.edge_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note })),
    duckBugs: physics.bugs.duck_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note })),
    slideBugs: physics.bugs.slide_bugs.map((b) => ({ frame: b.frame, time: b.time, note: b.note }))
  };
}

export function mapNormalizedDemoToApi(normalized: NormalizedDemo): {
  status: DemoStatus;
  overview: DemoOverviewResponse;
  cvars: CvarsResponse;
  bugs: BugsResponse;
  graphInfo: GraphInfoResponse;
  graph: GraphPayload;
} {
  return mapNormalizedDemoToApiWithAnalytics(normalized, null);
}

export function mapNormalizedDemoToApiWithAnalytics(
  normalized: NormalizedDemo,
  analytics: AnalyticsReport | null
): {
  status: DemoStatus;
  overview: DemoOverviewResponse;
  cvars: CvarsResponse;
  bugs: BugsResponse;
  graphInfo: GraphInfoResponse;
  graph: GraphPayload;
} {
  const telemetry = normalized.frames.map((frame) => ({
    frameNumber: frame.frameNumber,
    time: frame.time,
    frametime: frame.frametime,
    msec: frame.cmd.msec,
    buttons: frame.cmd.buttons,
    forwardmove: frame.cmd.forwardmove,
    sidemove: frame.cmd.sidemove,
    upmove: frame.cmd.upmove,
    viewangles: frame.viewangles,
    simorg: frame.simorg,
    simvel: frame.simvel,
    onground: frame.onground,
    health: frame.health,
    paused: frame.paused
  }));

  const physics = GoldSrcPhysicsSimulator.simulate(telemetry);
  const graph = toGraph(normalized, analytics, physics);

  return {
    status: toStatus(normalized),
    overview: toOverview(normalized),
    cvars: toCvars(normalized),
    bugs: toBugs(physics),
    graphInfo: toGraphInfo(normalized),
    graph
  };
}

export interface GraphCoverageReport {
  denseArrays: Record<string, number>;
  sparseLaneCounts: {
    commands: number;
    maxspeed: number;
    cd: Record<string, number>;
    esp: Record<string, number>;
    wd: Record<string, number>;
  };
}

export function buildGraphCoverageReport(graph: GraphPayload): GraphCoverageReport {
  return {
    denseArrays: {
      frametime: graph.frametime.length,
      time: graph.time.length,
      demo_time: graph.demo_time.length,
      is_paused: graph.is_paused.length,
      cmd_forwardmove: graph.cmd.forwardmove.length,
      cmd_sidemove: graph.cmd.sidemove.length,
      cmd_upmove: graph.cmd.upmove.length,
      cmd_buttons: graph.cmd.buttons.length,
      cmd_msec: graph.cmd.msec.length
    },
    sparseLaneCounts: {
      commands: Object.keys(graph.commands).length,
      maxspeed: Object.keys(graph.maxspeed).length,
      cd: Object.fromEntries(Object.entries(graph.cd).map(([lane, values]) => [lane, Object.keys(values).length])),
      esp: Object.fromEntries(Object.entries(graph.esp).map(([lane, values]) => [lane, Object.keys(values).length])),
      wd: Object.fromEntries(Object.entries(graph.wd).map(([lane, values]) => [lane, Object.keys(values).length]))
    }
  };
}

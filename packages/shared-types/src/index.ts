export type KzMode = "mock" | "real";

export interface DemoListItem {
  id: string;
  filename: string;
  size: number;
  message?: string;
}

export interface UploadResponse {
  demos: DemoListItem[];
}

// TODO_validate: live API pagination shape needs capture confirmation.
export interface DemosPageResponse {
  demos: DemoListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DemoStatus {
  type: number;
  parsingStatus: number;
  analysingStatus: number;
  isUploader: boolean;
  filename: string;
  tasks: Record<string, number> | [];
  needReparse: boolean;
  needReanalyse: boolean;
}

export interface DemoOverviewResponse {
  overview: {
    demoType: number;
    map: { name: string };
    player: { name: string; steamId: string };
    completionTime: number;
    version: { demo: number; network: number };
    gameDll: string;
    svCheats: boolean;
  };
  overviewAdditional: {
    filename: string;
  };
  playersUserInfo: Array<Record<string, string>>;
}

export interface CvarRow {
  cvar: string;
  reference: number;
  [key: string]: string | number;
}

export interface CvarsResponse {
  cvars: CvarRow[];
}

export interface BugsResponse {
  jumpBugs: unknown[];
  edgeBugs: unknown[];
  duckBugs: unknown[];
  slideBugs: unknown[];
}

export interface GraphInfoResponse {
  frames: number;
}

export interface GraphPayload {
  frametime: number[];
  time: number[];
  demo_time: number[];
  cmd: {
    forwardmove: number[];
    sidemove: number[];
    upmove: number[];
    buttons: number[];
    msec: number[];
  };
  is_paused: number[];
  commands: Record<string, string>;
  frames: number;
  player_index: number;
  mapname: string;
  timer: {
    start_frame: number;
    stop_frame: number;
  };
  longjumps: Array<Record<string, unknown>>;
  kz_bugs: {
    jump_bugs: unknown[];
    edge_bugs: unknown[];
    slide_bugs: unknown[];
    duck_bugs: unknown[];
  };
  maxspeed: Record<string, number>;
  esp: Record<string, Record<string, number>>;
  cd: Record<string, Record<string, number>>;
  wd: Record<string, Record<string, number>>;
}

export interface GraphViewerJump {
  label: string;
  startFrame: number;
  endFrame: number;
  distance: number;
  prestrafe: number;
  maxspeed: number;
  strafes: number;
  sync: number;
  color: string;
  fullName?: string;
  distanceXy?: number;
  isStandup?: boolean;
  isIdealBhop?: boolean;
  block?: number;
  jumpoff?: number;
  landing?: number;
  frames?: number;
  framesInDuck?: number;
  preJumpVelocityJumpoff?: number;
  preJumpVelocityBeforeJumpoff?: number;
}

export interface GraphViewerDataset {
  meta: {
    demoId: string;
    filename: string;
    mapname: string;
    frames: number;
    startFrame?: number;
    stopFrame?: number;
    timer?: {
      startFrame: number;
      stopFrame: number;
    };
  };
  dense: {
    frame: number[];
    time: number[];
    frametime: number[];
    engineFps: number[];
    realFps: number[];
    mouseX: number[];
    mouseXSpeed: number[];
    jumpHeight: number[];
    jumpHeightDemo?: number[];
    jumpHeightCalc?: number[];
    minsZ?: number[];
    bInDuck?: number[];
    isPaused?: number[];
    originX: number[];
    originY: number[];
    originZ: number[];
    velocityX: number[];
    velocityY: number[];
    velocityZ: number[];
    velocityXY: number[];
    buttons: number[];
    flags: number[];
    health: number[];
    onground: number[];
    duckstate: number[];
    movetype: number[];
    forwardmove: number[];
    sidemove: number[];
    upmove: number[];
    maxspeed: number[];
    fuser2?: number[];
    pitch?: number[];
    yaw?: number[];
    weapon?: string[];
  };
  lanes: {
    jump: number[];
    ground: number[];
    duck: number[];
    duckstate: number[];
    use?: number[];
    freezetime?: number[];
    forward: number[];
    back: number[];
    moveleft: number[];
    moveright: number[];
  };
  sparse: {
    originX: Record<string, number>;
    originY: Record<string, number>;
    originZ: Record<string, number>;
    velocityX: Record<string, number>;
    velocityY: Record<string, number>;
    velocityZ: Record<string, number>;
    velocityXY: Record<string, number>;
    buttons: Record<string, number>;
    flags: Record<string, number>;
    commands: Record<string, string>;
  };
  jumps: GraphViewerJump[];
  coverage: {
    real: string[];
    inferred: string[];
    todoValidate: string[];
  };
}

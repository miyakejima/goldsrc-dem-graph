export interface RawDemoHeader {
  magic: string;
  demoVersion: number;
  networkVersion: number;
  mapName: string;
  gameDll: string;
  mapCrc: number;
  directoryOffset: number;
}

export interface RawDirectoryEntry {
  type: number;
  title: string;
  flags: number;
  play: number;
  time: number;
  frames: number;
  offset: number;
  length: number;
}

export interface RawFrame {
  frameType: number;
  frameNumber: number;
  time: number;
  frametime: number | null;
  paused: number | null;
  playerNum: number | null;
  refParams: {
    vieworg: [number | null, number | null, number | null];
    viewangles: [number | null, number | null, number | null];
    clViewangles: [number | null, number | null, number | null];
    punchangle: [number | null, number | null, number | null];
    simvel: [number | null, number | null, number | null];
    simorg: [number | null, number | null, number | null];
    viewheight: [number | null, number | null, number | null];
    health: number | null;
    maxclients: number | null;
    viewentity: number | null;
    onground: number | null;
    waterlevel: number | null;
    spectator: number | null;
    intermission: number | null;
    viewsize: number | null;
  };
  userCmdViewangles: [number | null, number | null, number | null];
  cmd: {
    forwardmove: number | null;
    sidemove: number | null;
    upmove: number | null;
    buttons: number | null;
    msec: number | null;
  };
  movvars: {
    gravity: number | null;
    stopspeed: number | null;
    maxspeed: number | null;
    spectatormaxspeed: number | null;
    accelerate: number | null;
    airaccelerate: number | null;
    wateraccelerate: number | null;
    friction: number | null;
    edgefriction: number | null;
    waterfriction: number | null;
    bounce: number | null;
    stepsize: number | null;
    maxvelocity: number | null;
    footsteps: number | null;
  };
  clientCommand: string | null;
}

export interface RawParsedDemo {
  header: RawDemoHeader;
  directory: RawDirectoryEntry[];
  frames: RawFrame[];
  playersBySlot: Record<number, string>;
  warnings: string[];
}

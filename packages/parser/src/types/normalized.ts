export interface NormalizedDemo {
  id: string;
  filename: string;
  size: number;
  header: {
    demoVersion: number;
    networkVersion: number;
    mapName: string;
    gameDll: string;
  };
  frameCount: number;
  durationSeconds: number;
  frames: Array<{
    frameNumber: number;
    time: number;
    frametime: number;
    paused: number;
    playerNum: number;
    onground: number;
    waterlevel: number;
    spectator: number;
    intermission: number;
    viewsize: number;
    maxclients: number;
    viewentity: number;
    viewangles: [number, number, number];
    clViewangles: [number, number, number];
    punchangle: [number, number, number];
    vieworg: [number, number, number];
    simvel: [number, number, number];
    simorg: [number, number, number];
    health: number;
    cmd: {
      forwardmove: number;
      sidemove: number;
      upmove: number;
      buttons: number;
      msec: number;
    };
  }>;
  cvars: Record<string, number>;
  playersUserInfo: Array<Record<string, string>>;
  commandsByFrame: Record<string, string>;
  warnings: string[];
}

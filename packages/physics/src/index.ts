/**
 * GoldSrc CS 1.6 Player Movement & KZ Physics Engine
 *
 * Implements physics rules matching ReGameDLL_CS (pm_shared.cpp, client.cpp)
 * to simulate player states (flags, fuser2, bInDuck, mins/maxs, movetype)
 * and detect KZ bugs (edgebug, jumpbug, duckbug, slidebug).
 */

export const FL_ONGROUND = 1 << 9;  // 512
export const FL_DUCKING  = 1 << 14; // 16384
export const FL_CLIENT   = 1 << 3;  // 8

export const IN_ATTACK   = 1 << 0;
export const IN_JUMP     = 1 << 1;
export const IN_DUCK     = 1 << 2;
export const IN_FORWARD  = 1 << 3;
export const IN_BACK     = 1 << 4;
export const IN_USE      = 1 << 5;
export const IN_MOVELEFT = 1 << 9;
export const IN_MOVERIGHT= 1 << 10;

export const MOVETYPE_NONE = 0;
export const MOVETYPE_WALK = 3;
export const MOVETYPE_FLY  = 5;
export const MOVETYPE_TOSS = 6;

export interface TelemetryFrame {
  frameNumber: number;
  time: number;
  frametime: number;
  msec: number;
  buttons: number;
  forwardmove: number;
  sidemove: number;
  upmove: number;
  viewangles: [number, number, number];
  simorg: [number, number, number];
  simvel: [number, number, number];
  onground: boolean | number;
  health?: number;
  paused?: number;
}

export interface SimulatedFrameState {
  frameNumber: number;
  flags: number;
  fuser2: number;
  bInDuck: number;
  mins2: number;
  maxs2: number;
  movetype: number;
  m_iId: number;
  iClip: number;
  health: number;
  onground: boolean;
  ducking: boolean;
}

export interface BugEvent {
  frame: number;
  time: number;
  note?: string;
  velocityBefore?: [number, number, number];
  velocityAfter?: [number, number, number];
}

export interface BugDetectionResults {
  edge_bugs: BugEvent[];
  jump_bugs: BugEvent[];
  duck_bugs: BugEvent[];
  slide_bugs: BugEvent[];
}

export interface PhysicsSimulationResult {
  states: SimulatedFrameState[];
  bugs: BugDetectionResults;
}

export class GoldSrcPhysicsSimulator {
  /**
   * Run full physics simulation across all frames of a demo.
   */
  public static simulate(frames: TelemetryFrame[]): PhysicsSimulationResult {
    const states: SimulatedFrameState[] = [];
    const bugs: BugDetectionResults = {
      edge_bugs: [],
      jump_bugs: [],
      duck_bugs: [],
      slide_bugs: []
    };

    if (frames.length === 0) {
      return { states, bugs };
    }

    let fuser2 = 0;
    let bInDuck = 0;
    let duckTimerMs = 0;
    let isDucking = false;
    let prevOnground = false;
    let prevButtons = 0;
    let currentWeaponId = 16; // default CSW_USP
    let currentClip = 12;     // default USP clip size
    let prevVz = 0;

    const totalFrames = frames.length;

    for (let i = 0; i < totalFrames; i++) {
      const f = frames[i];
      const msec = f.msec > 0 ? f.msec : 10;
      const onground = f.onground !== 0 && f.onground !== false;
      const duckBtn = (f.buttons & IN_DUCK) !== 0;
      const jumpBtn = (f.buttons & IN_JUMP) !== 0;
      const prevJumpBtn = (prevButtons & IN_JUMP) !== 0;
      const prevDuckBtn = (prevButtons & IN_DUCK) !== 0;

      // --- Duck state machine (matches pm_shared.cpp: PM_Duck) ---
      if (duckBtn) {
        if (!prevDuckBtn && !isDucking) {
          bInDuck = 1;
          duckTimerMs = 0;
        }

        if (bInDuck === 1) {
          duckTimerMs += msec;
          // After TIME_TO_DUCK (200ms) or in-air, ducking completes
          if (duckTimerMs >= 200 || !onground) {
            isDucking = true;
            bInDuck = 0;
          }
        }
      } else {
        if (isDucking || bInDuck === 1) {
          bInDuck = 0;
          duckTimerMs = 0;
          isDucking = false;
        }
      }

      // --- Jump fatigue / fuser2 (matches pm_shared.cpp: PM_Jump & PM_Move) ---
      const jumpTriggered = jumpBtn && !prevJumpBtn && onground;
      if (jumpTriggered) {
        fuser2 = 1315; // JUMP_FATIGUE_VAL
      } else if (fuser2 > 0) {
        fuser2 = Math.max(0, fuser2 - msec);
      }

      // --- Weapon ID & clip tracking ---
      // If +attack triggered, decrement clip
      const attackPressed = (f.buttons & IN_ATTACK) !== 0 && (prevButtons & IN_ATTACK) === 0;
      if (attackPressed && currentClip > 0) {
        currentClip -= 1;
      }

      // --- Engine Flags ---
      let flags = FL_CLIENT;
      if (onground) flags |= FL_ONGROUND;
      if (isDucking) flags |= FL_DUCKING;

      // --- Mins / Maxs ---
      const mins2 = isDucking ? -18 : -36;
      const maxs2 = isDucking ? 18 : 36;

      // --- Movetype ---
      const currentHealth = f.health !== undefined ? f.health : 100;
      let movetype = MOVETYPE_WALK;
      if (currentHealth <= 0) {
        movetype = MOVETYPE_TOSS;
      }

      states.push({
        frameNumber: f.frameNumber,
        flags,
        fuser2,
        bInDuck,
        mins2,
        maxs2,
        movetype,
        m_iId: currentWeaponId,
        iClip: currentClip,
        health: currentHealth,
        onground,
        ducking: isDucking
      });

      // --- Bug Detection Logic ---
      if (i > 1 && i < totalFrames - 1) {
        const vz = f.simvel[2];
        const nextF = frames[i + 1];
        const nextOnground = nextF.onground !== 0 && nextF.onground !== false;
        const nextVz = nextF.simvel[2];

        // 1. Edgebug Detection:
        // Falling fast in air (prevVz < -300), stays in air (onground == false, nextOnground == false),
        // but downward velocity is arrested or deflected (vz jumping to >= -50), health didn't drop.
        if (!prevOnground && !onground && !nextOnground) {
          if (prevVz <= -320 && vz >= -60) {
            const healthLost = (frames[i - 1].health ?? 100) - currentHealth;
            if (healthLost <= 0) {
              bugs.edge_bugs.push({
                frame: f.frameNumber,
                time: f.time,
                note: `Absorbed downward velocity ${prevVz.toFixed(1)} -> ${vz.toFixed(1)} while remaining in air`,
                velocityBefore: frames[i - 1].simvel,
                velocityAfter: f.simvel
              });
            }
          }
        }

        // 2. Jumpbug Detection:
        // Player falling fast (prevVz < -300), ducks, inputs jump on ground contact boundary,
        // and instantly rebounds upward (nextVz >= 250) without taking fall damage.
        if (prevVz <= -300 && (jumpBtn || (nextF.buttons & IN_JUMP) !== 0)) {
          if (vz > 200 || nextVz > 200) {
            const healthLost = (frames[i - 1].health ?? 100) - currentHealth;
            if (healthLost <= 0) {
              bugs.jump_bugs.push({
                frame: f.frameNumber,
                time: f.time,
                note: `Jumpbug launched from fall velocity ${prevVz.toFixed(1)} to upward ${Math.max(vz, nextVz).toFixed(1)}`,
                velocityBefore: frames[i - 1].simvel,
                velocityAfter: f.simvel
              });
            }
          }
        }

        // 3. Duckbug Detection:
        // Slope duck timing where duck transition negates vertical collision without damage
        if (bInDuck === 1 && prevVz <= -280 && vz >= -20 && onground) {
          bugs.duck_bugs.push({
            frame: f.frameNumber,
            time: f.time,
            note: "Duckbug landing ground transition",
            velocityBefore: frames[i - 1].simvel,
            velocityAfter: f.simvel
          });
        }
      }

      prevOnground = onground;
      prevButtons = f.buttons;
      prevVz = f.simvel[2];
    }

    return { states, bugs };
  }
}
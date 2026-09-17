import type { RawDirectoryEntry, RawFrame, RawParsedDemo } from "../types/raw.js";

class Reader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    this.offset = value;
  }

  remaining(): number {
    return this.buffer.length - this.offset;
  }

  private ensure(size: number): void {
    if (this.offset + size > this.buffer.length) {
      throw new Error(`Unexpected EOF at ${this.offset}, requested ${size}`);
    }
  }

  readUInt8(): number {
    this.ensure(1);
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt16LE(): number {
    this.ensure(2);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt32LE(): number {
    this.ensure(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readUInt32LE(): number {
    this.ensure(4);
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readFloatLE(): number {
    this.ensure(4);
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  readFixedString(length: number): string {
    this.ensure(length);
    const data = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    const end = data.indexOf(0);
    const slice = end >= 0 ? data.subarray(0, end) : data;
    return slice.toString("utf8");
  }

  readCString(): string {
    let end = this.offset;
    while (end < this.buffer.length && this.buffer[end] !== 0) {
      end += 1;
    }
    if (end >= this.buffer.length) {
      throw new Error("CString terminator not found");
    }
    const value = this.buffer.subarray(this.offset, end).toString("utf8");
    this.offset = end + 1;
    return value;
  }

  readBytes(length: number): Buffer {
    this.ensure(length);
    const out = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  skip(length: number): void {
    this.ensure(length);
    this.offset += length;
  }

  peekUInt8(position: number): number {
    if (position < 0 || position >= this.buffer.length) {
      throw new Error(`peekUInt8 out of range: ${position}`);
    }
    return this.buffer.readUInt8(position);
  }

  peekInt32LE(position: number): number {
    if (position < 0 || position + 4 > this.buffer.length) {
      throw new Error(`peekInt32LE out of range: ${position}`);
    }
    return this.buffer.readInt32LE(position);
  }

  peekUInt32LE(position: number): number {
    if (position < 0 || position + 4 > this.buffer.length) {
      throw new Error(`peekUInt32LE out of range: ${position}`);
    }
    return this.buffer.readUInt32LE(position);
  }

  peekFloatLE(position: number): number {
    if (position < 0 || position + 4 > this.buffer.length) {
      throw new Error(`peekFloatLE out of range: ${position}`);
    }
    return this.buffer.readFloatLE(position);
  }
}

function parseUpdateUserInfoFromMsg(msg: Buffer, playersBySlot: Record<number, string>): void {
  const r = new Reader(msg);

  while (r.remaining() > 0) {
    const type = r.readUInt8();

    if (type === 7) {
      if (r.remaining() < 4) return;
      r.skip(4);
      continue;
    }
    if (type === 8 || type === 9 || type === 54) {
      try {
        r.readCString();
      } catch {
        return;
      }
      if (type === 54 && r.remaining() > 0) {
        r.skip(1);
      }
      continue;
    }
    if (type === 11) {
      if (r.remaining() < 31) return;
      r.skip(28);
      r.skip(3);
      try {
        r.readCString();
        r.readCString();
        r.readCString();
        r.readCString();
      } catch {
        return;
      }
      if (r.remaining() > 0) {
        r.skip(1);
      }
      continue;
    }
    if (type === 13) {
      if (r.remaining() < 5) return;
      const slot = r.readUInt8();
      r.readInt32LE();
      try {
        playersBySlot[slot] = r.readCString();
      } catch {
        return;
      }
      if (r.remaining() < 16) return;
      r.skip(16);
      continue;
    }
    if (type === 39) {
      if (r.remaining() < 18) return;
      r.skip(18);
      continue;
    }
    if (type === 45) {
      if (r.remaining() < 8) return;
      r.skip(8);
      continue;
    }
    if (type === 58) {
      if (r.remaining() < 4) return;
      r.skip(4);
      try {
        r.readCString();
      } catch {
        return;
      }
      continue;
    }

    // TODO_validate: add robust handlers for remaining SVC message types.
    return;
  }
}

function parseMovvars(payload: Buffer): RawFrame["movvars"] {
  const base = 288;
  const readFloat = (offset: number): number | null => {
    if (offset + 4 > payload.length) return null;
    return payload.readFloatLE(offset);
  };
  const readInt = (offset: number): number | null => {
    if (offset + 4 > payload.length) return null;
    return payload.readInt32LE(offset);
  };

  return {
    gravity: readFloat(base + 0),
    stopspeed: readFloat(base + 4),
    maxspeed: readFloat(base + 8),
    spectatormaxspeed: readFloat(base + 12),
    accelerate: readFloat(base + 16),
    airaccelerate: readFloat(base + 20),
    wateraccelerate: readFloat(base + 24),
    friction: readFloat(base + 28),
    edgefriction: readFloat(base + 32),
    waterfriction: readFloat(base + 36),
    bounce: readFloat(base + 44),
    stepsize: readFloat(base + 48),
    maxvelocity: readFloat(base + 52),
    footsteps: readInt(base + 64)
  };
}

function readFloatAt(payload: Buffer, offset: number): number | null {
  if (offset + 4 > payload.length) return null;
  const value = payload.readFloatLE(offset);
  if (!Number.isFinite(value)) return null;
  return value;
}

function readIntAt(payload: Buffer, offset: number): number | null {
  if (offset + 4 > payload.length) return null;
  return payload.readInt32LE(offset);
}

function readUIntAt(payload: Buffer, offset: number): number | null {
  if (offset + 4 > payload.length) return null;
  return payload.readUInt32LE(offset);
}

function readUInt16At(payload: Buffer, offset: number): number | null {
  if (offset + 2 > payload.length) return null;
  return payload.readUInt16LE(offset);
}

function readUInt8At(payload: Buffer, offset: number): number | null {
  if (offset + 1 > payload.length) return null;
  return payload.readUInt8(offset);
}

function findGameDataFrameBoundary(params: {
  reader: Reader;
  dataStart: number;
  segmentEnd: number;
  frameNumber: number;
  allowType0: boolean;
}): { payloadLength: number; msgLength: number } | null {
  const { reader, dataStart, segmentEnd, frameNumber, allowType0 } = params;

  for (let payloadLength = 440; payloadLength <= 560; payloadLength += 1) {
    const msgSizePos = dataStart + payloadLength;
    if (msgSizePos + 4 > segmentEnd) {
      continue;
    }

    const msgLength = reader.peekUInt32LE(msgSizePos);
    const nextFramePos = msgSizePos + 4 + msgLength;

    if (nextFramePos === segmentEnd) {
      return { payloadLength, msgLength };
    }

    if (nextFramePos + 9 > segmentEnd) {
      continue;
    }

    const nextType = reader.peekUInt8(nextFramePos);
    if (nextType < 0 || nextType > 9) {
      continue;
    }
    if (!allowType0 && nextType === 0) {
      continue;
    }

    const nextFrameNumber = reader.peekInt32LE(nextFramePos + 5);
    if (nextFrameNumber < frameNumber || nextFrameNumber > frameNumber + 4096) {
      continue;
    }

    return { payloadLength, msgLength };
  }

  return null;
}

function findNextFrameHeaderPosition(params: {
  reader: Reader;
  dataStart: number;
  segmentEnd: number;
  frameNumber: number;
  frameTime: number;
  allowType0: boolean;
}): number | null {
  const { reader, dataStart, segmentEnd, frameNumber, frameTime, allowType0 } = params;
  const searchEnd = Math.min(segmentEnd - 9, dataStart + 20000);

  for (let pos = dataStart + 1; pos <= searchEnd; pos += 1) {
    const type = reader.peekUInt8(pos);
    if (type < 0 || type > 9) {
      continue;
    }
    if (!allowType0 && type === 0) {
      continue;
    }

    const decodedTime = reader.peekFloatLE(pos + 1);
    if (!Number.isFinite(decodedTime) || decodedTime < frameTime - 0.25 || decodedTime > frameTime + 5) {
      continue;
    }

    const nextFrame = reader.peekInt32LE(pos + 5);
    if (nextFrame < frameNumber || nextFrame > frameNumber + 8192) {
      continue;
    }

    return pos;
  }

  return null;
}

function parseGameDataFrameData(
  reader: Reader,
  warnings: string[],
  playersBySlot: Record<number, string>,
  frameNumber: number,
  segmentEnd: number,
  frameTime: number,
  allowType0: boolean
): {
  frametime: number | null;
  paused: number | null;
  playerNum: number | null;
  refParams: RawFrame["refParams"];
  userCmdViewangles: RawFrame["userCmdViewangles"];
  cmd: RawFrame["cmd"];
  movvars: RawFrame["movvars"];
} {
  if (reader.remaining() < 128) {
    warnings.push("Frame too short for type 0/1 payload; frame skipped.");
    return {
      frametime: null,
      paused: null,
      playerNum: null,
      refParams: {
        vieworg: [null, null, null],
        viewangles: [null, null, null],
        clViewangles: [null, null, null],
        punchangle: [null, null, null],
        simvel: [null, null, null],
        simorg: [null, null, null],
        health: null,
        maxclients: null,
        viewentity: null,
        onground: null,
        waterlevel: null,
        spectator: null,
        intermission: null,
        viewsize: null
      },
      userCmdViewangles: [null, null, null],
      cmd: { forwardmove: null, sidemove: null, upmove: null, buttons: null, msec: null },
      movvars: {
        gravity: null,
        stopspeed: null,
        maxspeed: null,
        spectatormaxspeed: null,
        accelerate: null,
        airaccelerate: null,
        wateraccelerate: null,
        friction: null,
        edgefriction: null,
        waterfriction: null,
        bounce: null,
        stepsize: null,
        maxvelocity: null,
        footsteps: null
      }
    };
  }

  const dataStart = reader.position;
  const boundary = findGameDataFrameBoundary({
    reader,
    dataStart,
    segmentEnd,
    frameNumber,
    allowType0
  });

  let payloadLength = boundary?.payloadLength;
  let msgLength = boundary?.msgLength;
  let resyncPosition: number | null = null;

  if (!boundary) {
    resyncPosition = findNextFrameHeaderPosition({
      reader,
      dataStart,
      segmentEnd,
      frameNumber,
      frameTime,
      allowType0
    });
    payloadLength = Math.min(460, Math.max(0, (resyncPosition ?? segmentEnd) - dataStart));
    msgLength = 0;
    warnings.push(
      `Could not detect message boundary for frame ${frameNumber}; ` +
        `${resyncPosition ? `resynced at ${resyncPosition}` : "using fallback consumption"}`
    );
  }

  const payload = reader.readBytes(Math.min(payloadLength ?? 460, Math.max(0, segmentEnd - reader.position)));
  if (resyncPosition !== null) {
    reader.position = resyncPosition;
  }

  if (reader.position + 4 > segmentEnd || msgLength === undefined) {
    warnings.push(`Missing msg_size field for frame ${frameNumber}.`);
    return {
      frametime: payload.length >= 68 ? payload.readFloatLE(64) : null,
      paused: readUIntAt(payload, 76),
      playerNum: readUIntAt(payload, 184),
      refParams: {
        vieworg: [readFloatAt(payload, 4), readFloatAt(payload, 8), readFloatAt(payload, 12)],
        viewangles: [readFloatAt(payload, 16), readFloatAt(payload, 20), readFloatAt(payload, 24)],
        clViewangles: [readFloatAt(payload, 132), readFloatAt(payload, 136), readFloatAt(payload, 140)],
        punchangle: [readFloatAt(payload, 164), readFloatAt(payload, 168), readFloatAt(payload, 172)],
        simvel: [readFloatAt(payload, 92), readFloatAt(payload, 96), readFloatAt(payload, 100)],
        simorg: [readFloatAt(payload, 104), readFloatAt(payload, 108), readFloatAt(payload, 112)],
        health: readUIntAt(payload, 144),
        maxclients: readUIntAt(payload, 176),
        viewentity: readUIntAt(payload, 180),
        onground: readUIntAt(payload, 84),
        waterlevel: readUIntAt(payload, 88),
        spectator: readUIntAt(payload, 80),
        intermission: readUIntAt(payload, 72),
        viewsize: readFloatAt(payload, 160)
      },
      userCmdViewangles: [readFloatAt(payload, 240), readFloatAt(payload, 244), readFloatAt(payload, 248)],
      cmd: {
        forwardmove: readFloatAt(payload, 252),
        sidemove: readFloatAt(payload, 256),
        upmove: readFloatAt(payload, 260),
        buttons: readUInt16At(payload, 266),
        msec: readUInt8At(payload, 238)
      },
      movvars: parseMovvars(payload)
    };
  }
  const declaredMsgLength = reader.readUInt32LE();
  const effectiveMsgLength = msgLength ?? declaredMsgLength;
  const safeMsgLength = Math.min(effectiveMsgLength, Math.max(0, segmentEnd - reader.position));
  const msg = reader.readBytes(safeMsgLength);

  if (msg.length > 0) {
    parseUpdateUserInfoFromMsg(msg, playersBySlot);
  }

  const cmd = {
    // TODO_validate: offsets are inferred from DemoParser reference code and may vary by demo type.
    forwardmove: readFloatAt(payload, 252),
    sidemove: readFloatAt(payload, 256),
    upmove: readFloatAt(payload, 260),
    buttons: readUInt16At(payload, 266),
    msec: readUInt8At(payload, 238)
  };

  const frametime = readFloatAt(payload, 64);

  return {
    frametime,
    paused: readUIntAt(payload, 76),
    playerNum: readUIntAt(payload, 184),
    refParams: {
      vieworg: [readFloatAt(payload, 4), readFloatAt(payload, 8), readFloatAt(payload, 12)],
      viewangles: [readFloatAt(payload, 16), readFloatAt(payload, 20), readFloatAt(payload, 24)],
      clViewangles: [readFloatAt(payload, 132), readFloatAt(payload, 136), readFloatAt(payload, 140)],
      punchangle: [readFloatAt(payload, 164), readFloatAt(payload, 168), readFloatAt(payload, 172)],
      simvel: [readFloatAt(payload, 92), readFloatAt(payload, 96), readFloatAt(payload, 100)],
      simorg: [readFloatAt(payload, 104), readFloatAt(payload, 108), readFloatAt(payload, 112)],
      health: readUIntAt(payload, 144),
      maxclients: readUIntAt(payload, 176),
      viewentity: readUIntAt(payload, 180),
      onground: readUIntAt(payload, 84),
      waterlevel: readUIntAt(payload, 88),
      spectator: readUIntAt(payload, 80),
      intermission: readUIntAt(payload, 72),
      viewsize: readFloatAt(payload, 160)
    },
    userCmdViewangles: [readFloatAt(payload, 240), readFloatAt(payload, 244), readFloatAt(payload, 248)],
    cmd,
    movvars: parseMovvars(payload)
  };
}

function parseDirectoryEntries(reader: Reader, offset: number): RawDirectoryEntry[] {
  const previous = reader.position;
  reader.position = offset;
  const count = reader.readInt32LE();
  const entries: RawDirectoryEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    entries.push({
      type: reader.readInt32LE(),
      title: reader.readFixedString(64),
      flags: reader.readInt32LE(),
      play: reader.readInt32LE(),
      time: reader.readFloatLE(),
      frames: reader.readInt32LE(),
      offset: reader.readInt32LE(),
      length: reader.readInt32LE()
    });
  }

  reader.position = previous;
  return entries;
}

function parseSegmentFrames(reader: Reader, entry: RawDirectoryEntry, warnings: string[], playersBySlot: Record<number, string>): RawFrame[] {
  const frames: RawFrame[] = [];
  const segmentStart = entry.offset;
  const segmentEnd = entry.offset + entry.length;

  reader.position = segmentStart;

  while (reader.position + 9 <= segmentEnd && reader.remaining() >= 9) {
    const frameType = reader.readUInt8();
    const time = reader.readFloatLE();
    const frameNumber = reader.readInt32LE();

    if (frameType === 5) {
      break;
    }

    if (frameType === 0 || frameType === 1) {
      const parsed = parseGameDataFrameData(
        reader,
        warnings,
        playersBySlot,
        frameNumber,
        segmentEnd,
        time,
        entry.type !== 1
      );
      frames.push({
        frameType,
        frameNumber,
        time,
        frametime: parsed.frametime,
        paused: parsed.paused,
        playerNum: parsed.playerNum,
        refParams: parsed.refParams,
        userCmdViewangles: parsed.userCmdViewangles,
        cmd: parsed.cmd,
        movvars: parsed.movvars,
        clientCommand: null
      });
      continue;
    }

    if (frameType === 2) {
      frames.push({
        frameType,
        frameNumber,
        time,
        frametime: null,
        paused: null,
        playerNum: null,
        refParams: {
          vieworg: [null, null, null],
          viewangles: [null, null, null],
          clViewangles: [null, null, null],
          punchangle: [null, null, null],
          simvel: [null, null, null],
          simorg: [null, null, null],
          health: null,
          maxclients: null,
          viewentity: null,
          onground: null,
          waterlevel: null,
          spectator: null,
          intermission: null,
          viewsize: null
        },
        userCmdViewangles: [null, null, null],
        cmd: { forwardmove: null, sidemove: null, upmove: null, buttons: null, msec: null },
        movvars: {
          gravity: null,
          stopspeed: null,
          maxspeed: null,
          spectatormaxspeed: null,
          accelerate: null,
          airaccelerate: null,
          wateraccelerate: null,
          friction: null,
          edgefriction: null,
          waterfriction: null,
          bounce: null,
          stepsize: null,
          maxvelocity: null,
          footsteps: null
        },
        clientCommand: null
      });
      continue;
    }

    if (frameType === 3) {
      const clientCommand = reader.readFixedString(64);
      frames.push({
        frameType,
        frameNumber,
        time,
        frametime: null,
        paused: null,
        playerNum: null,
        refParams: {
          vieworg: [null, null, null],
          viewangles: [null, null, null],
          clViewangles: [null, null, null],
          punchangle: [null, null, null],
          simvel: [null, null, null],
          simorg: [null, null, null],
          health: null,
          maxclients: null,
          viewentity: null,
          onground: null,
          waterlevel: null,
          spectator: null,
          intermission: null,
          viewsize: null
        },
        userCmdViewangles: [null, null, null],
        cmd: { forwardmove: null, sidemove: null, upmove: null, buttons: null, msec: null },
        movvars: {
          gravity: null,
          stopspeed: null,
          maxspeed: null,
          spectatormaxspeed: null,
          accelerate: null,
          airaccelerate: null,
          wateraccelerate: null,
          friction: null,
          edgefriction: null,
          waterfriction: null,
          bounce: null,
          stepsize: null,
          maxvelocity: null,
          footsteps: null
        },
        clientCommand
      });
      continue;
    }

    if (frameType === 4) {
      reader.skip(32);
      continue;
    }

    if (frameType === 6) {
      reader.skip(84);
      continue;
    }

    if (frameType === 7) {
      reader.skip(8);
      continue;
    }

    if (frameType === 8) {
      reader.skip(4);
      const soundNameLength = reader.readInt32LE();
      if (soundNameLength > 0 && soundNameLength <= reader.remaining()) {
        reader.skip(soundNameLength);
      }
      if (reader.remaining() >= 16) {
        reader.skip(16);
      }
      continue;
    }

    if (frameType === 9) {
      const chunkLength = reader.readInt32LE();
      if (chunkLength > 0 && chunkLength <= reader.remaining()) {
        reader.skip(chunkLength);
      }
      continue;
    }

    // TODO_validate: additional frame types are currently unsupported.
    warnings.push(`Unsupported frame type ${frameType} at frame ${frameNumber}; stopping segment parse.`);
    break;
  }

  return frames;
}

export function parseHalfLifeDemoBuffer(buffer: Buffer): RawParsedDemo {
  const warnings: string[] = [];
  const reader = new Reader(buffer);

  const header = {
    magic: reader.readFixedString(8),
    demoVersion: reader.readInt32LE(),
    networkVersion: reader.readInt32LE(),
    mapName: reader.readFixedString(260),
    gameDll: reader.readFixedString(260),
    mapCrc: reader.readInt32LE(),
    directoryOffset: reader.readInt32LE()
  };

  if (!header.magic.startsWith("HLDEMO")) {
    throw new Error(`Unsupported demo magic: ${header.magic}`);
  }

  const directory = parseDirectoryEntries(reader, header.directoryOffset);
  const playersBySlot: Record<number, string> = {};

  const frames: RawFrame[] = [];
  for (const entry of directory) {
    try {
      frames.push(...parseSegmentFrames(reader, entry, warnings, playersBySlot));
    } catch (error) {
      warnings.push(`Failed parsing segment '${entry.title}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    header,
    directory,
    frames,
    playersBySlot,
    warnings
  };
}

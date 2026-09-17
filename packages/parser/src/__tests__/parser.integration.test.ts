import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MockDemoParserAdapter,
  RealDemoParserAdapter,
  mapNormalizedDemoToApi,
  normalizeParsedDemo,
  parseHalfLifeDemoBuffer
} from "../index.js";
import type { RawFrame } from "../types/raw.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, "fixtures", "realdem.dem");

test("parses real demo fixture header and frames", () => {
  const buffer = fs.readFileSync(fixturePath);
  const raw = parseHalfLifeDemoBuffer(buffer);

  assert.ok(raw.header.magic.startsWith("HLDEMO"));
  assert.ok(raw.header.mapName.length > 0);
  assert.ok(raw.header.demoVersion > 0);
  assert.ok(raw.directory.length > 0);
  assert.ok(raw.frames.length > 0);

  const hasGameFrame = raw.frames.some((frame: RawFrame) => frame.frameType === 0 || frame.frameType === 1);
  assert.ok(hasGameFrame);
});

test("maps normalized output into stable API graph schema", () => {
  const buffer = fs.readFileSync(fixturePath);
  const raw = parseHalfLifeDemoBuffer(buffer);
  const normalized = normalizeParsedDemo({
    id: "fixture-demo",
    filename: "realdem.dem",
    size: buffer.length,
    raw
  });

  const mapped = mapNormalizedDemoToApi(normalized);

  assert.equal(mapped.status.filename, "realdem.dem");
  assert.equal(mapped.graph.frames, mapped.graph.time.length);
  assert.equal(mapped.graph.cmd.forwardmove.length, mapped.graph.frames);
  assert.ok(Object.prototype.hasOwnProperty.call(mapped.graph, "cd"));
  assert.ok(Object.prototype.hasOwnProperty.call(mapped.graph, "esp"));
  assert.ok(Object.prototype.hasOwnProperty.call(mapped.graph, "wd"));
  assert.ok(Object.prototype.hasOwnProperty.call(mapped.graph, "kz_bugs"));
  assert.ok(Object.keys(mapped.graph.cd).length > 0);
  assert.ok(Object.keys(mapped.graph.esp).length > 0);
});

test("real adapter returns graph coverage and populated real lanes", async () => {
  const buffer = fs.readFileSync(fixturePath);
  const adapter = new RealDemoParserAdapter();
  const result = await adapter.parseDemo({
    demoId: "fixture-demo",
    demoBuffer: buffer,
    filename: "realdem.dem",
    size: buffer.length
  });

  assert.ok(result.graphCoverage.denseArrays.time > 0);
  assert.ok(result.graphCoverage.sparseLaneCounts.cd["origin[0]"] > 0);
  assert.ok(result.graphCoverage.sparseLaneCounts.esp["angles[0]"] > 0);
  assert.ok(Array.isArray(result.graph.longjumps));
  assert.ok(result.analyticsCoverage !== null);
});

test("mock adapter keeps graph schema stable", async () => {
  const adapter = new MockDemoParserAdapter();
  const result = await adapter.parseDemo({
    demoId: "mock",
    demoBuffer: Buffer.alloc(0),
    filename: "mock.dem",
    size: 0
  });

  const keys = Object.keys(result.graph).sort();
  assert.deepEqual(keys, [
    "cd",
    "cmd",
    "commands",
    "demo_time",
    "esp",
    "frames",
    "frametime",
    "is_paused",
    "kz_bugs",
    "longjumps",
    "mapname",
    "maxspeed",
    "player_index",
    "time",
    "timer",
    "wd"
  ]);
});

test("real adapter simulates GoldSrc physics, flags, fuser2, and bug detection", async () => {
  const buffer = fs.readFileSync(fixturePath);
  const adapter = new RealDemoParserAdapter();
  const result = await adapter.parseDemo({
    demoId: "fixture-demo",
    demoBuffer: buffer,
    filename: "realdem.dem",
    size: buffer.length
  });

  // Verify physics simulation populated cd lanes
  assert.ok(result.graph.cd.flags);
  assert.ok(result.graph.cd.fuser2);
  assert.ok(result.graph.cd.bInDuck);
  assert.ok(result.graph.cd.m_iId);
  assert.ok(result.graph.wd.iClip);
  assert.ok(result.graph.esp["mins[2]"]);
  assert.ok(result.graph.esp["maxs[2]"]);
  assert.ok(result.graph.esp.movetype);

  // Verify all tasks in status are completed (status 2)
  const taskValues = Object.values(result.status.tasks as Record<string, number>);
  assert.ok(taskValues.length >= 8);
  assert.ok(taskValues.every((val) => val === 2));

  // Verify bugs object structure matches upstream schema
  assert.ok(Array.isArray(result.bugs.jumpBugs));
  assert.ok(Array.isArray(result.bugs.edgeBugs));
  assert.ok(Array.isArray(result.bugs.duckBugs));
  assert.ok(Array.isArray(result.bugs.slideBugs));

  // Verify timer window is detected
  assert.ok(result.graph.timer.start_frame > 0);
  assert.ok(result.graph.timer.stop_frame >= result.graph.timer.start_frame);
});


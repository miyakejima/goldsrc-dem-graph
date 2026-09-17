import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import {
  getBugsSample,
  getCvarsSample,
  getDemoStatusSample,
  getGraphInfoSample,
  getGraphSample,
  getOverviewSample
} from "@kz-rebuild/mock-data";

test("API routes return valid schema responses", async () => {
  const app = Fastify();
  await app.register(cors, { origin: true });
  await app.register(multipart);

  app.get("/health", async () => ({ ok: true }));
  app.get("/api/demo/:id/overview", async () => getOverviewSample());
  app.get("/api/demo/:id/cvars", async () => getCvarsSample());
  app.get("/api/demo/:id/bugs", async () => getBugsSample());
  app.get("/api/demo/:id/graph-info", async () => getGraphInfoSample());
  app.get("/api/demo/:id/graph", async () => getGraphSample());

  // Test /health
  const resHealth = await app.inject({ method: "GET", url: "/health" });
  assert.equal(resHealth.statusCode, 200);
  assert.deepEqual(resHealth.json(), { ok: true });

  // Test /overview
  const resOverview = await app.inject({ method: "GET", url: "/api/demo/test/overview" });
  assert.equal(resOverview.statusCode, 200);
  const overview = resOverview.json();
  assert.ok(overview.overview.map.name);
  assert.ok(overview.overview.player.name);

  // Test /cvars
  const resCvars = await app.inject({ method: "GET", url: "/api/demo/test/cvars" });
  assert.equal(resCvars.statusCode, 200);
  assert.ok(Array.isArray(resCvars.json().cvars));

  // Test /bugs
  const resBugs = await app.inject({ method: "GET", url: "/api/demo/test/bugs" });
  assert.equal(resBugs.statusCode, 200);
  const bugs = resBugs.json();
  assert.ok(Array.isArray(bugs.edgeBugs));
  assert.ok(Array.isArray(bugs.jumpBugs));

  // Test /graph-info
  const resGraphInfo = await app.inject({ method: "GET", url: "/api/demo/test/graph-info" });
  assert.equal(resGraphInfo.statusCode, 200);
  assert.ok(typeof resGraphInfo.json().frames === "number");

  // Test /graph
  const resGraph = await app.inject({ method: "GET", url: "/api/demo/test/graph" });
  assert.equal(resGraph.statusCode, 200);
  const graph = resGraph.json();
  assert.ok(Array.isArray(graph.frametime));
  assert.ok(Array.isArray(graph.time));
  assert.ok(Array.isArray(graph.demo_time));
  assert.ok(graph.cmd.forwardmove);
  assert.ok(graph.cd.flags);
  assert.ok(graph.esp.movetype);
  assert.ok(graph.wd.iClip);
});

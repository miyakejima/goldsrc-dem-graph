import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  BugsResponse,
  CvarsResponse,
  DemoOverviewResponse,
  DemoStatus,
  GraphInfoResponse,
  GraphPayload,
  UploadResponse
} from "@kz-rebuild/shared-types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveSamplesDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../../samples"),
    path.resolve(__dirname, "../../../../samples"),
    path.resolve(process.cwd(), "samples")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not resolve samples directory.");
}

function readJson<T>(filename: string): T {
  const samplesDir = resolveSamplesDir();
  const fullPath = path.join(samplesDir, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as T;
}

export function getUploadSample(): UploadResponse {
  return readJson<UploadResponse>("upload_response_sample.json");
}

export function getDemoStatusSample(): DemoStatus {
  return readJson<DemoStatus>("demo_status_sample.json");
}

export function getRequestUpdateSample(): DemoStatus {
  return readJson<DemoStatus>("request_update_sample.json");
}

export function getOverviewSample(): DemoOverviewResponse {
  return readJson<DemoOverviewResponse>("overview_sample.json");
}

export function getCvarsSample(): CvarsResponse {
  return readJson<CvarsResponse>("cvars_sample.json");
}

export function getBugsSample(): BugsResponse {
  return readJson<BugsResponse>("bugs_sample.json");
}

export function getGraphInfoSample(): GraphInfoResponse {
  return readJson<GraphInfoResponse>("graph_info_sample.json");
}

export function getGraphSample(): GraphPayload {
  return readJson<GraphPayload>("graph_full_sample.json");
}


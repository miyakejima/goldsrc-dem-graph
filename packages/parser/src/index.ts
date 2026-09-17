import { getBugsSample, getCvarsSample, getDemoStatusSample, getGraphInfoSample, getGraphSample, getOverviewSample } from "@kz-rebuild/mock-data";
import type {
  BugsResponse,
  CvarsResponse,
  DemoOverviewResponse,
  DemoStatus,
  GraphInfoResponse,
  GraphPayload,
  GraphViewerDataset
} from "@kz-rebuild/shared-types";
import { runMovementAnalytics, type AnalyticsReport } from "@kz-rebuild/analytics";

import { parseHalfLifeDemoBuffer } from "./adapters/halfLifeDemoParser.js";
import { parseDemoWithNativeBinary } from "./adapters/nativeParser.js";
import { buildGraphCoverageReport, mapNormalizedDemoToApiWithAnalytics } from "./mappers/mapNormalizedDemoToApi.js";
import { buildGraphViewerDataset } from "./mappers/buildGraphViewerDataset.js";
import { normalizeParsedDemo } from "./normalize/normalizeParsedDemo.js";
import type { NormalizedDemo } from "./types/normalized.js";
import type { RawParsedDemo } from "./types/raw.js";

export const pipelineStageNames = [
  "demo_parser",
  "resource_list_parser",
  "btn_dumper",
  "physics_runner",
  "cmd_parser",
  "kz_stats",
  "bms_parser",
  "cvar_parser",
  "decal_list_parser"
] as const;

export type PipelineStageName = (typeof pipelineStageNames)[number];

export interface ParsedDemoBundle {
  status: DemoStatus;
  overview: DemoOverviewResponse;
  cvars: CvarsResponse;
  bugs: BugsResponse;
  graphInfo: GraphInfoResponse;
  graph: GraphPayload;
  graphViewer: GraphViewerDataset | null;
  graphCoverage: ReturnType<typeof buildGraphCoverageReport>;
  analyticsCoverage: AnalyticsReport["coverage"] | null;
  normalized: NormalizedDemo | null;
  raw: RawParsedDemo | null;
}

export interface DemoParserAdapter {
  parseDemo(params: {
    demoId: string;
    demoBuffer: Buffer;
    filename: string;
    size: number;
  }): Promise<ParsedDemoBundle>;
}

export class MockDemoParserAdapter implements DemoParserAdapter {
  async parseDemo(_params: {
    demoId: string;
    demoBuffer: Buffer;
    filename: string;
    size: number;
  }): Promise<ParsedDemoBundle> {
    return {
      status: getDemoStatusSample(),
      overview: getOverviewSample(),
      cvars: getCvarsSample(),
      bugs: getBugsSample(),
      graphInfo: getGraphInfoSample(),
      graph: getGraphSample(),
      graphViewer: null,
      graphCoverage: buildGraphCoverageReport(getGraphSample()),
      analyticsCoverage: null,
      normalized: null,
      raw: null
    };
  }
}

export class RealDemoParserAdapter implements DemoParserAdapter {
  async parseDemo(params: {
    demoId: string;
    demoBuffer: Buffer;
    filename: string;
    size: number;
  }): Promise<ParsedDemoBundle> {
    if (!params.demoBuffer || params.demoBuffer.length === 0) {
      const fallback = new MockDemoParserAdapter();
      const response = await fallback.parseDemo(params);
      response.status = {
        ...response.status,
        tasks: {
          ...((response.status.tasks as Record<string, number>) ?? {}),
          demo_parser: 0
        }
      };
      return response;
    }

    const nativeResult = parseDemoWithNativeBinary(params);
    if (nativeResult) {
      const { normalized, analytics } = nativeResult;
      const mapped = mapNormalizedDemoToApiWithAnalytics(normalized, analytics);
      return {
        ...mapped,
        graphViewer: buildGraphViewerDataset({ demoId: params.demoId, normalized, analytics }),
        graphCoverage: buildGraphCoverageReport(mapped.graph),
        analyticsCoverage: analytics.coverage,
        raw: null,
        normalized
      };
    }

    const raw = parseHalfLifeDemoBuffer(params.demoBuffer);
    const normalized = normalizeParsedDemo({
      id: params.demoId,
      filename: params.filename,
      size: params.size,
      raw
    });

    const analytics = runMovementAnalytics({
      frames: normalized.frames.map((frame) => ({
        frameNumber: frame.frameNumber,
        time: frame.time,
        onground: frame.onground,
        simorg: frame.simorg,
        simvel: frame.simvel,
        viewangles: frame.viewangles,
        cmd: frame.cmd
      })),
      mapName: normalized.header.mapName
    });
    const mapped = mapNormalizedDemoToApiWithAnalytics(normalized, analytics);
    return {
      ...mapped,
      graphViewer: buildGraphViewerDataset({ demoId: params.demoId, normalized, analytics }),
      graphCoverage: buildGraphCoverageReport(mapped.graph),
      analyticsCoverage: analytics.coverage,
      raw,
      normalized
    };
  }
}

export { parseHalfLifeDemoBuffer } from "./adapters/halfLifeDemoParser.js";
export { normalizeParsedDemo } from "./normalize/normalizeParsedDemo.js";
export { mapNormalizedDemoToApi } from "./mappers/mapNormalizedDemoToApi.js";
export { buildGraphCoverageReport } from "./mappers/mapNormalizedDemoToApi.js";
export { buildGraphViewerDataset } from "./mappers/buildGraphViewerDataset.js";
export type { NormalizedDemo } from "./types/normalized.js";
export type { RawParsedDemo } from "./types/raw.js";

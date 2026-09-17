import type {
  BugsResponse,
  CvarsResponse,
  DemoOverviewResponse,
  DemosPageResponse,
  GraphPayload,
  GraphViewerDataset,
  UploadResponse
} from "@kz-rebuild/shared-types";

const apiBase = import.meta.env.VITE_API_BASE ?? "";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function uploadDemo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return requestJson<UploadResponse>("/api/demos/upload", {
    method: "POST",
    body: formData
  });
}

export function getGraphViewer(id: string): Promise<GraphViewerDataset> {
  return requestJson<GraphViewerDataset>(`/api/demo/${id}/graph-viewer`);
}

export function getGraph(id: string): Promise<GraphPayload> {
  return requestJson<GraphPayload>(`/api/demo/${id}/graph`);
}

export function getOverview(id: string): Promise<DemoOverviewResponse> {
  return requestJson<DemoOverviewResponse>(`/api/demo/${id}/overview`);
}

export function getCvars(id: string): Promise<CvarsResponse> {
  return requestJson<CvarsResponse>(`/api/demo/${id}/cvars`);
}

export function getBugs(id: string): Promise<BugsResponse> {
  return requestJson<BugsResponse>(`/api/demo/${id}/bugs`);
}

export function getDemos(): Promise<DemosPageResponse> {
  return requestJson<DemosPageResponse>("/api/demos");
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5042";

// helpful runtime log when troubleshooting local dev
console.debug("VITE_API_BASE_URL ->", import.meta.env.VITE_API_BASE_URL, "using ->", API_BASE_URL);

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    const error = await response.json().catch(() => null) as
      | { detail?: string; title?: string }
      | null;

    throw new Error(
      error?.detail ?? error?.title ??
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function checkBackend(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);

    return response.ok;
  } catch (error) {
    console.error("Backend connection failed:", error);
    return false;
  }
}

export interface HealthResponse {
  status: string;
  application: string;
  message: string;
}

export async function getHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("/api/health");
}

export interface Pole {
  poleId: string | null;
  feederId: string | null;
  streetName: string | null;
  zone?: string | null;
  state?: string | null;
  subzone?: string | null;
  station?: string | null;
  substation?: string | null;
  latitude: number | null;
  longitude: number | null;
  finalAiRiskScore: number | null;
  finalAiRiskCategory: string | null;
  landCoverType: string | null;

  // Detail fields are optional because older API responses only contain the
  // summary fields above. The modal renders a dash when one is unavailable.
  rvi?: number | null;
  ndvi?: number | null;
  vegetationDensity?: string | number | null;
  cloudScore?: number | null;
  rviTrend3m?: string | number | null;
  ndviTrend3m?: string | number | null;
  action?: string | null;
  riskReason?: string | null;
  lineType?: string | null;
  lastPruneDate?: string | null;
  outageCount12m?: number | null;
  operationalRiskCategory?: string | null;
  aiRiskGroup?: string | null;
  aiRiskScore?: number | null;
  workOrderStatus?: string | null;
  aiValidation?: string | null;
  modifiedOn?: string | null;
}

export async function getPoles(): Promise<Pole[]> {
  return apiGet<Pole[]>("/api/dataverse/poles");
}

export interface WorkFeedback {
  poleId: string | null;
  trimmingWork: string | null;
  modifiedOn: string | null;
}

export async function getWorkFeedback(): Promise<WorkFeedback[]> {
  return apiGet<WorkFeedback[]>("/api/dataverse/work-feedback");
}

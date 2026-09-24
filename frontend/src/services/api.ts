import { normalizeWorkForm } from "./workFormResponse";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5042";

// helpful runtime log when troubleshooting local dev
console.debug("VITE_API_BASE_URL ->", import.meta.env.VITE_API_BASE_URL, "using ->", API_BASE_URL);

async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  let data: any;
  try { data = JSON.parse(body); } catch {
    throw new Error(response.ok
      ? 'The API returned an invalid response. Please retry.'
      : `The server could not complete the request (HTTP ${response.status}). Please retry.`);
  }
  if (!response.ok) throw new Error(data?.message ?? data?.detail ?? data?.title ?? `API request failed (HTTP ${response.status}).`);
  return data;
}

export async function apiGet<T>(endpoint: string, baseUrl: string = API_BASE_URL): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`);

  return readApiResponse(response);
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

export async function getPoles():
  Promise<Pole[]> {

  const response =
    await fetch("/api/poles");


  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? error?.message ?? error?.detail ?? `Unable to load pole data (HTTP ${response.status}).`);
  }

  const records = await response.json().catch(() => {
    throw new Error("The /api/poles endpoint did not return JSON. Check the Vercel API deployment and routing.");
  });
  if (!Array.isArray(records)) {
    throw new Error("The /api/poles endpoint must return an array of pole records.");
  }


  return records.map(
    (record: any): Pole => ({

      poleId:
        record.cr1da_poleidentifier ??
        null,

      feederId:
        record.cr1da_feederidentifier ??
        null,

      streetName:
        record.cr1da_zone ??
        null,

      zone:
        record.crf11_zone_name??
        null,

      latitude:
        record.cr1da_latitude ??
        null,

      longitude:
        record.cr1da_longitude ??
        null,

      finalAiRiskScore:
        record.cr1da_risknumericvalue ??
        null,

      finalAiRiskCategory:
        record["cr1da_finalairiskcategory@OData.Community.Display.V1.FormattedValue"] ??
        (typeof record.cr1da_finalairiskcategory === "string" ? record.cr1da_finalairiskcategory : null) ??
        null,

      landCoverType:
        record["cr1da_landcovertype@OData.Community.Display.V1.FormattedValue"] ??
        (typeof record.cr1da_landcovertype === "string" ? record.cr1da_landcovertype : null) ??
        null,

      state: record.crf11_state ?? null,
      station: record["crf11_station@OData.Community.Display.V1.FormattedValue"] ?? record.crf11_station ?? null,
      rvi: record.cr1da_relativevegetationindex ?? null,
      ndvi: record.cr1da_normalizeddifferencevegetationind ?? null,
      vegetationDensity: record["cr1da_vegetationdensity@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_vegetationdensity ?? null,
      cloudScore: record.cr1da_cloudscore ?? null,
      rviTrend3m: record["cr1da_rvitrend3months@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_rvitrend3months ?? null,
      ndviTrend3m: record["cr1da_ndvitrend3months@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_ndvitrend3months ?? null,
      action: record["cr1da_recommendedaction@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_recommendedaction ?? null,
      riskReason: record["cr1da_riskreason@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_riskreason ?? null,
      lineType: record["cr1da_linetype@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_linetype ?? null,
      lastPruneDate: record.cr1da_lastprunedate ?? null,
      outageCount12m: record.cr1da_outagecount12months ?? null,
      operationalRiskCategory: record["cr1da_operationalriskcategory@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_operationalriskcategory ?? null,
      aiRiskGroup: record["cr1da_airiskgroup@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_airiskgroup ?? null,
      aiRiskScore: record.cr1da_airiskscore ?? null,
      workOrderStatus: record["cr1da_workorderstatus@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_workorderstatus ?? null,
      aiValidation: record["cr1da_aivalidation@OData.Community.Display.V1.FormattedValue"] ?? record.cr1da_aivalidation ?? null,

      modifiedOn:
        record.modifiedon ??
        null,
    })
  );
}

export interface WorkFeedback {
  poleId: string | null;
  trimmingWork: string | null;
  modifiedOn: string | null;
}

const feedbackCache = new Map<string, { expires: number; data: WorkFeedback[] }>();
export function invalidateWorkFeedback(poleId?: string) {
  if (poleId) feedbackCache.delete(poleId.trim());
  else feedbackCache.clear();
}
export async function getWorkFeedback(poleIds: string[], signal?: AbortSignal): Promise<WorkFeedback[]> {
  const ids = [...new Set(poleIds.map(id => id.trim()).filter(Boolean))];
  const result: WorkFeedback[][] = new Array(ids.length);
  let next = 0;
  const failures: string[] = [];
  async function worker() {
    while (next < ids.length) {
      signal?.throwIfAborted();
      const index = next++;
      const id = ids[index];
      const cached = feedbackCache.get(id);
      if (cached && cached.expires > Date.now()) { result[index] = cached.data; continue; }
      try {
        let response = await fetch(`/api/work-feedback?poleId=${encodeURIComponent(id)}`, { signal });
        if ([429, 502, 503, 504].includes(response.status)) {
          const failure = await response.clone().json().catch(() => null);
          if (failure?.retryable !== false) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            signal?.throwIfAborted();
            response = await fetch(`/api/work-feedback?poleId=${encodeURIComponent(id)}`, { signal });
          }
        }
        const data = await readApiResponse(response);
        if (!Array.isArray(data)) throw new Error('Invalid trimming data response.');
        feedbackCache.set(id, { expires: Date.now() + 300000, data });
        result[index] = data;
      } catch (error) {
        signal?.throwIfAborted();
        failures.push(`${id}: ${error instanceof Error ? error.message : 'Unable to load feedback.'}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker));
  if (failures.length) throw new Error(`${failures.length} pole(s) could not load. ${failures[0]} Successful requests are retained; Refresh retries missing data.`);
  return result.flat();
}

export type WorkFormValue = string | number | number[] | null;
export interface WorkFormField {
  name: string; label: string; type: string; required: boolean; maxLength: number | null; readOnly?: boolean;
  options: { value: number; label: string }[] | null; value: WorkFormValue;
}
export interface WorkFormRecord { found?: boolean; id: string | null; version: string | null; fields: WorkFormField[] }
export async function getWorkForm(poleId: string): Promise<WorkFormRecord> {
  const data = await apiGet(`/api/work-form?poleId=${encodeURIComponent(poleId)}`, "");
  return normalizeWorkForm(data, poleId);
}
export async function saveWorkForm(poleId: string, id: string | null, version: string | null, values: Record<string, WorkFormValue>): Promise<void> {
  const body = JSON.stringify({ id, version, values });
  if (new TextEncoder().encode(body).length > 4_400_000) throw new Error("The form and photos are too large. Choose smaller images and try again.");
  const response = await fetch(`/api/work-form?poleId=${encodeURIComponent(poleId)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? error?.detail ?? "Unable to save the work form.");
  }
}

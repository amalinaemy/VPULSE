import { normalizeWorkForm, workFormChoices } from "./workFormResponse";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5042";

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

export async function apiGet<T>(
  endpoint: string
): Promise<T> {

  const response =
    await fetch(
      `${API_BASE_URL}${endpoint}`
    );

  if (!response.ok) {

    const error =
      await response.json().catch(
        () => null
      );

    throw new Error(
      error?.detail ??
      error?.title ??
      `API request failed: ${response.status}`
    );
  }

  return response.json();
}

export interface HealthResponse {
  status: string;
  application: string;
  message: string;
}

export async function getHealth():
  Promise<HealthResponse> {

  return apiGet<HealthResponse>(
    "/api/health"
  );
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
    throw new Error(error?.message ?? error?.detail ?? `Unable to load pole data (HTTP ${response.status}).`);
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
      subzone: record["crf11_subzone@OData.Community.Display.V1.FormattedValue"] ??
        (typeof record.crf11_subzone === "string" ? record.crf11_subzone : null),
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

      substation: record.substation ?? record.cr1da_feederidentifier ?? null,

      modifiedOn:
        record.modifiedon ??
        record.modifiedOn ??
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
const feedbackKey = (id: string) => id.trim().toLowerCase();
const feedbackListeners = new Set<(feedback: WorkFeedback) => void>();
export function subscribeWorkFeedback(listener: (feedback: WorkFeedback) => void) {
  feedbackListeners.add(listener);
  return () => { feedbackListeners.delete(listener); };
}
function publishFeedback(feedback: WorkFeedback) {
  if (!feedback.poleId) return;
  feedbackCache.set(feedbackKey(feedback.poleId), { expires: Date.now() + 300000, data: [feedback] });
  feedbackListeners.forEach(listener => listener(feedback));
}
export function invalidateWorkFeedback(poleId?: string) {
  if (poleId) feedbackCache.delete(feedbackKey(poleId));
  else feedbackCache.clear();
}
export async function getWorkFeedback(poleIds: string[], signal?: AbortSignal,
  onProgress?: (feedback: WorkFeedback) => void): Promise<WorkFeedback[]> {
  const ids = [...new Map(poleIds.map(id => [feedbackKey(id), id.trim()])).values()].filter(Boolean);
  const result: WorkFeedback[][] = new Array(ids.length);
  let next = 0;
  const failures: string[] = [];
  let stopped = false;
  async function worker() {
    while (next < ids.length && !stopped) {
      signal?.throwIfAborted();
      const index = next++;
      const id = ids[index];
      const key = feedbackKey(id);
      const before = feedbackCache.get(key);
      if (before && before.expires > Date.now()) {
        result[index] = before.data;
        before.data.forEach(item => onProgress?.(item));
        continue;
      }
      try {
        const deadline = AbortSignal.timeout(65000);
        const response = await fetch(`/api/work-feedback?poleId=${encodeURIComponent(id)}`, {
          signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        });
        // Do not create more flow runs while the service is overloaded or unavailable.
        if ([429, 502, 503, 504].includes(response.status)) stopped = true;
        const data = await readApiResponse(response);
        signal?.throwIfAborted();
        if (!Array.isArray(data)) throw new Error('Invalid trimming data response.');
        // A form load/save may have published a newer status while this read was pending.
        const current = feedbackCache.get(key);
        const records: WorkFeedback[] = current !== before && current ? current.data
          : data.length ? data : [{ poleId: id, trimmingWork: null, modifiedOn: null }];
        if (current === before) feedbackCache.set(key, { expires: Date.now() + 300000, data: records });
        result[index] = records;
        records.forEach(item => onProgress?.(item));
      } catch (error) {
        signal?.throwIfAborted();
        stopped = true;
        failures.push(`${id}: ${error instanceof Error ? error.message : 'Unable to load feedback.'}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker));
  if (failures.length) throw new Error(`${failures[0]} Background requests stopped. Loaded statuses are retained; Retry resumes unresolved poles.`);
  return result.flat();
}


/*
|--------------------------------------------------------------------------
| Work Form
|--------------------------------------------------------------------------
*/

export type WorkFormValue =
  string |
  number |
  boolean |
  number[] |
  null;


export interface WorkFormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  maxLength: number | null;

  options:
    {
      value: number;
      label: string;
    }[] | null;

  value: WorkFormValue;
}


export interface WorkFormRecord {
  found?: boolean;
  id: string | null;
  version: string | null;
  fields: WorkFormField[];
}


/*
|--------------------------------------------------------------------------
| GET Work Form
|--------------------------------------------------------------------------
|
| React
|   ↓
| /api/work-form?poleId=...
|   ↓
| Vercel API
|   ↓
| Power Automate
|   ↓
| LV VM Model
|
*/

export async function getWorkForm(
  poleId: string
): Promise<WorkFormRecord> {
  const before = feedbackCache.get(feedbackKey(poleId));

  const response =
    await fetch(
      `/api/work-form?poleId=${
        encodeURIComponent(poleId)
      }`
    );


  if (!response.ok) {

    const error =
      await response
        .json()
        .catch(() => null);


    throw new Error(
      error?.message ??
      error?.detail ??
      `Unable to load work form (HTTP ${response.status}).`
    );
  }


  const data =
    await response.json();


  /*
  |--------------------------------------------------------------------------
  | Vercel API should return WorkFormRecord
  |--------------------------------------------------------------------------
  */

  const form = normalizeWorkForm(data, poleId);
  const field = form.fields.find(field => field.name === "crf11_trimmingwork");
  const status = field?.options?.find(option => option.value === field.value)?.label ?? null;
  if (feedbackCache.get(feedbackKey(poleId)) === before) {
    publishFeedback({ poleId, trimmingWork: status, modifiedOn: null });
  }
  return form;
}


/*
|--------------------------------------------------------------------------
| SAVE Work Form
|--------------------------------------------------------------------------
|
| React
|   ↓
| PUT /api/work-form
|   ↓
| Vercel API
|   ↓
| Power Automate
|   ↓
| Add / Update LV VM Model
|
*/

export async function saveWorkForm(
  poleId: string,
  id: string | null,
  version: string | null,
  values: Record<string, WorkFormValue>
): Promise<void> {

  const response =
    await fetch(
      `/api/work-form?poleId=${
        encodeURIComponent(poleId)
      }`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          id,
          version,
          values
        })
      }
    );


  if (!response.ok) {

    const error =
      await response
        .json()
        .catch(() => null);


    throw new Error(
      error?.message ??
      error?.detail ??
      `Unable to save work form (HTTP ${response.status}).`
    );
  }
  if (Object.prototype.hasOwnProperty.call(values, "crf11_trimmingwork")) {
    const status = workFormChoices.crf11_trimmingwork.find(option => option.value === values.crf11_trimmingwork)?.label ?? null;
    publishFeedback({ poleId, trimmingWork: status, modifiedOn: new Date().toISOString() });
  }

}


export interface WorkSummary {
  poleId: string;
  trimmingWork: string | number | null;
  modifiedOn: string | null;
}

export async function getWorkSummary(options: { fresh?: boolean } = {}): Promise<WorkSummary[]> {
  // The server must honor fresh=1 to bypass any application-level summary cache.
  const url = options.fresh ? `/api/work-summary?fresh=1&_=${Date.now()}` : "/api/work-summary";
  const response = await fetch(url, options.fresh ? { cache: "no-store" } : undefined);

  if (!response.ok) {
    throw new Error(
      `Unable to load trimming statuses: ${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid work summary response.");
  }

  return data as WorkSummary[];
}



// The flow sorts modifiedon descending, so the first row for a pole is newest.
export function workSummaryLookup(records: WorkSummary[]): Map<string, WorkFeedback> {
  const lookup = new Map<string, WorkFeedback>();
  for (const record of records) {
    const key = String(record.poleId ?? "").trim().toUpperCase();
    if (!key || lookup.has(key)) continue;
    const value = record.trimmingWork;
    const choice = workFormChoices.crf11_trimmingwork.find(option => String(option.value) === String(value));
    lookup.set(key, {
      poleId: key,
      trimmingWork: choice?.label ?? (typeof value === "string" ? value : null),
      modifiedOn: record.modifiedOn,
    });
  }
  return lookup;
}

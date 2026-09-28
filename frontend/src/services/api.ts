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
        record.cr1da_finalairiskcategory ??
        null,

      landCoverType:
        record.cr1da_landcovertype ??
        null,

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
export function invalidateWorkFeedback(poleId?: string) {
  if (poleId) feedbackCache.delete(poleId.trim());
  else feedbackCache.clear();
}
export async function getWorkFeedback(poleIds: string[], signal?: AbortSignal): Promise<WorkFeedback[]> {
  const ids = [...new Set(poleIds.map(id => id.trim()).filter(Boolean))];
  const result: WorkFeedback[][] = new Array(ids.length);
  let next = 0;
  const failures: string[] = [];
  let serviceTimedOut = false;
  let connectionFailed = false;
  function fetchFeedback(id: string) {
    const deadline = AbortSignal.timeout(65000);
    return fetch(`/api/work-feedback?poleId=${encodeURIComponent(id)}`, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    });
  }
  async function worker() {
    while (next < ids.length && !serviceTimedOut && !connectionFailed) {
      signal?.throwIfAborted();
      const index = next++;
      const id = ids[index];
      const cached = feedbackCache.get(id);
      if (cached && cached.expires > Date.now()) { result[index] = cached.data; continue; }
      try {
        let response = await fetchFeedback(id);
        if ([429, 502, 503].includes(response.status)) {
          const failure = await response.clone().json().catch(() => null);
          if (failure?.retryable !== false) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            signal?.throwIfAborted();
            response = await fetchFeedback(id);
          }
        }
        // Stop scheduling more flow runs when the service is already timing out.
        if (response.status === 504) serviceTimedOut = true;
        const data = await readApiResponse(response);
        if (!Array.isArray(data)) throw new Error('Invalid trimming data response.');
        feedbackCache.set(id, { expires: Date.now() + 300000, data });
        result[index] = data;
      } catch (error) {
        signal?.throwIfAborted();
        // Fetch and response-body reads reject when no usable HTTP response arrives.
        if (error instanceof TypeError || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
          connectionFailed = true;
        }
        failures.push(`${id}: ${error instanceof Error ? error.message : 'Unable to load feedback.'}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker));
  if (connectionFailed) throw new Error("Could not connect to the work-record service. Background requests have stopped. Check your connection, then use Refresh to retry. Successful requests are retained.");
  if (serviceTimedOut) throw new Error("The work-record service timed out. Background requests have stopped. Successful results are retained; use Refresh to retry after the service recovers. You can still open an individual work form.");
  if (failures.length) throw new Error(`${failures.length} pole(s) could not load. ${failures[0]} Successful requests are retained; Refresh retries missing data.`);
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

  return data as WorkFormRecord;
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
}

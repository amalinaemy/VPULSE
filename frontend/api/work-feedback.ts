export const maxDuration = 60;

const formattedSuffix = '@odata.community.display.v1.formattedvalue';

function recordOf(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('GetWorkForm must return one Dataverse record or {"found":false}.');
  }
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key.toLowerCase(), value]));
}

function feedbackFromWorkForm(data: unknown, poleId: string) {
  const record = recordOf(data);
  if (record.found === false) return [];
  let status = record['crf11_trimmingwork' + formattedSuffix] ?? record.crf11_trimmingwork;
  if (Array.isArray(record.fields)) {
    const field = record.fields.find((field: any) => field.name?.toLowerCase() === 'crf11_trimmingwork');
    status = field?.options?.find((option: any) => option.value === field.value)?.label ?? field?.value;
  } else if (!('cr1da_feederpolesection' in record) && !('crf11_trimmingwork' in record)) {
    throw new Error('GetWorkForm returned an unrecognized work record.');
  }
  if (typeof status === 'number') status = ({ 0: 'Completed', 1: 'In Progress', 2: 'Not Started' } as Record<number, string>)[status] ?? status;
  if (status != null && typeof status !== 'string') {
    throw new Error('GetWorkForm returned a numeric trimming choice without its formatted label. Include the Dataverse formatted values in the Response.');
  }
  const returnedId = record.cr1da_feederpolesection;
  if (typeof returnedId === 'string' && returnedId.trim().toLowerCase() !== poleId.trim().toLowerCase()) {
    throw new Error('GetWorkForm returned a record for a different pole. Check the poleId filter.');
  }
  return [{ poleId, trimmingWork: status ?? null, modifiedOn: typeof record.modifiedon === 'string' ? record.modifiedon : null }];
}



export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' });
  const poleId = req.query?.poleId;
  if (typeof poleId !== 'string' || !poleId.trim()) {
    return res.status(400).json({ message: 'Pole ID is required.' });
  }
  const flowUrl = process.env.POWER_AUTOMATE_GET_WORK_FORM_URL;
  if (!flowUrl) return res.status(500).json({ message: 'POWER_AUTOMATE_GET_WORK_FORM_URL is not configured in Vercel.' });
  try {
    const response = await fetch(flowUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poleId }), signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) {
      const failure: any = await response.json().catch(() => null);
      const code = typeof failure?.error?.code === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(failure.error.code) ? ` (${failure.error.code})` : '';
      return res.status(502).json({ message: `GetWorkForm returned HTTP ${response.status}${code}. Check the failed action in the flow run history.` });
    }
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); }
    catch { return res.status(502).json({ message: `GetWorkForm returned HTTP ${response.status} with ${raw.trim() ? 'a non-JSON' : 'an empty'} response. Its Response action must return a record or {"found":false}.`, retryable: false }); }
    try {
      return res.status(200).json(feedbackFromWorkForm(data, poleId));
    } catch (error) {
      return res.status(502).json({ message: error instanceof Error ? error.message : 'Invalid work feedback response.' });
    }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return res.status(timedOut ? 504 : 502).json({
      message: timedOut ? 'GetWorkForm exceeded the 55-second response limit. Check the duration and Response action in its latest run.' : 'The connection to GetWorkForm was interrupted. Retry the request.',
      retryable: !timedOut,
    });
  }
}

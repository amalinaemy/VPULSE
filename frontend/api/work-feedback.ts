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
      body: JSON.stringify({ poleId }), signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const failure: any = await response.json().catch(() => null);
      const code = typeof failure?.error?.code === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(failure.error.code) ? ` (${failure.error.code})` : '';
      return res.status(502).json({ message: `GetWorkForm returned HTTP ${response.status}${code}. Check the failed action in the flow run history.` });
    }
    const data = await response.json();
    try {
      return res.status(200).json(feedbackFromWorkForm(data, poleId));
    } catch (error) {
      return res.status(502).json({ message: error instanceof Error ? error.message : 'Invalid work feedback response.' });
    }
  } catch {
    return res.status(502).json({ message: 'Unable to read GetWorkForm. Check the flow run history and Response action.' });
  }
}

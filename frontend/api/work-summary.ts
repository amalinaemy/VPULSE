export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' });
  const flowUrl = process.env.POWER_AUTOMATE_GET_WORK_SUMMARY_URL;
  if (!flowUrl) return res.status(503).json({ message: 'POWER_AUTOMATE_GET_WORK_SUMMARY_URL is not configured in Vercel.' });
  try {
    const response = await fetch(flowUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(55000), cache: 'no-store',
    });
    if (!response.ok) return res.status(502).json({ message: `Work summary flow returned HTTP ${response.status}.` });
    const data: unknown = await response.json();
    const envelope = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const rows = Array.isArray(data) ? data : envelope?.value;
    if (!Array.isArray(rows) || envelope?.['@odata.nextLink']) {
      return res.status(502).json({ message: 'Work summary flow must return all records as an array. Enable pagination in the flow.' });
    }
    const records = rows.map((row: any) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid summary row');
      const poleId = row.poleId ?? row.cr1da_feederpolesection;
      if (typeof poleId !== 'string') throw new Error('Missing pole ID');
      const trimmingWork = row.trimmingWork ?? row['crf11_trimmingwork@OData.Community.Display.V1.FormattedValue'] ?? row.crf11_trimmingwork ?? null;
      if (trimmingWork !== null && !['string', 'number'].includes(typeof trimmingWork)) throw new Error('Invalid status');
      return { poleId: poleId.trim(), trimmingWork, modifiedOn: row.modifiedOn ?? row.modifiedon ?? null };
    }).filter((row: any) => row.poleId);
    const timestamp = (value: unknown) => typeof value === 'string' ? Date.parse(value) || 0 : 0;
    records.sort((a: any, b: any) => timestamp(b.modifiedOn) - timestamp(a.modifiedOn));
    return res.status(200).json(records);
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return res.status(timeout ? 504 : 502).json({ message: timeout ? 'Work summary flow timed out.' : 'Unable to load a valid work summary. Check the flow response.' });
  }
}

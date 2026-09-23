import { feedbackFromWorkForm } from '../src/services/workFormResponse.ts';

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
    if (!response.ok) return res.status(502).json({ message: `GetWorkForm returned HTTP ${response.status} for this pole. Check the flow run history, column logical names and trigger authentication.` });
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

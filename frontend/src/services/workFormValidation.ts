export const requiredWorkFields: Record<string, string> = {
  cr1da_inspectionstatus: 'Inspection Status',
  cr1da_risklevel: 'Risk Level',
  cr1da_namapegawaicontractors: 'Nama Pegawai (Rondaan)',
  cr1da_inspectiondate: 'Inspection Date',
  cr1da_aiconfirmedenroachment: 'AI Confirmed Enroachment',
  cr1da_fieldtrimmingrequired: 'Field Trimming Required',
  crf11_trimmingwork: 'Trimming Work',
};
export function workDateRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return { today, yesterday };
}
export function validateWorkForm(values: Record<string, unknown>, now = new Date()) {
  const errors: Record<string, string> = {};
  for (const [name, label] of Object.entries(requiredWorkFields)) {
    const value = values[name];
    if (value == null || (typeof value === 'string' && !value.trim())) errors[name] = `${label} is required.`;
  }
  const {today} = workDateRange(now);
  for (const [name, label] of [['cr1da_inspectiondate', 'Inspection Date'], ['crf11_trimmingdate', 'Trimming Date']]) {
    const value = values[name];
    if (value != null && value !== '') {
      const validDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
        && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
      if (!validDate || String(value) > today) errors[name] = `${label} must be a valid date on or before today (Malaysia time).`;
    }
  }
  return errors;
}

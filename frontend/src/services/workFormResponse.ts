interface WorkFeedback { poleId: string | null; trimmingWork: string | null; modifiedOn: string | null }
interface WorkFormField {
  name: string; label: string; type: string; required: boolean; maxLength: number | null;
  options: { value: number; label: string }[] | null;
  value: string | number | number[] | null; readOnly?: boolean;
}
interface WorkFormRecord { found?: boolean; id: string | null; version: string | null; fields: WorkFormField[] }

const formattedSuffix = '@odata.community.display.v1.formattedvalue';
// Dataverse choice values supplied by the user. AI labels use the visible, unambiguous text.
export const workFormChoices: Record<string, { value: number; label: string }[]> = {
  cr1da_aiconfirmedenroachment: [
    { value: 0, label: 'AI Correct - vegetation risk confirmed' },
    { value: 1, label: 'AI Partially Correct' },
    { value: 2, label: 'AI False Positive' },
  ],
  cr1da_fieldtrimmingrequired: [{ value: 0, label: 'No' }, { value: 1, label: 'Yes' }],
  crf11_trimmingwork: [
    { value: 0, label: 'Completed' }, { value: 1, label: 'In Progress' }, { value: 2, label: 'Not Started' },
  ],
  cr1da_inspectionstatus: [
    { value: 0, label: 'Inspection Completed' }, { value: 1, label: 'Trimming Completed' },
    { value: 2, label: 'Access Issue' }, { value: 3, label: 'No Vegetation Found' },
    { value: 4, label: 'Escalate for Shutdown' },
  ],
  cr1da_risklevel: [
    { value: 0, label: 'Critical - within 1m' }, { value: 1, label: 'High - 1m to 2m' },
    { value: 2, label: 'Medium - monitor' }, { value: 3, label: 'Low - normal' },
  ],
};

const fieldDefinitions = [
  ['cr1da_feederpolesection', 'Pole ID', 'text'],
  ['cr1da_feederid', 'Feeder ID', 'text'],
  ['cr1da_zone', 'Street Name', 'text'],
  ['cr1da_gpsautocapture', 'Latitude', 'text'],
  ['cr1da_gambaraireference', 'Longitude', 'text'],
  ['cr1da_inspectionstatus', 'Inspection Status', 'choice'],
  ['cr1da_risklevel', 'Risk Level', 'choice'],
  ['cr1da_namapegawaicontractors', 'Nama Pegawai / Contractors', 'text'],
  ['cr1da_inspectiondate', 'Inspection Date', 'date'],
  ['cr1da_aiconfirmedenroachment', 'AI Confirmed Enroachment', 'choice'],
  ['cr1da_gambarsemasaditapak', 'Gambar Semasa di Tapak', 'image'],
  ['crf11_gambarselepasditapak', 'Gambar Selepas di Tapak', 'image'],
  ['cr1da_fieldtrimmingrequired', 'Field Trimming Required', 'choice'],
  ['crf11_trimmingwork', 'Trimming Work', 'choice'],
  ['cr1da_remarksactiontaken', 'Remarks / Action Taken', 'text'],
] as const;

function recordOf(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('GetWorkForm must return one Dataverse record or {"found":false}.');
  }
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key.toLowerCase(), value]));
}

export function feedbackFromWorkForm(data: unknown, poleId: string): WorkFeedback[] {
  const record = recordOf(data);
  if (record.found === false) return [];
  let status = record['crf11_trimmingwork' + formattedSuffix] ?? record.crf11_trimmingwork;
  if (Array.isArray(record.fields)) {
    const field = record.fields.find((field: any) => field.name?.toLowerCase() === 'crf11_trimmingwork');
    status = field?.options?.find((option: any) => option.value === field.value)?.label ?? field?.value;
  } else if (!('cr1da_feederpolesection' in record) && !('crf11_trimmingwork' in record)) {
    throw new Error('GetWorkForm returned an unrecognized work record.');
  }
  if (typeof status === 'number') status = workFormChoices.crf11_trimmingwork.find(option => option.value === status)?.label ?? status;
  if (status != null && typeof status !== 'string') {
    throw new Error('GetWorkForm returned a numeric trimming choice without its formatted label. Include the Dataverse formatted values in the Response.');
  }
  const returnedId = record.cr1da_feederpolesection;
  if (typeof returnedId === 'string' && returnedId.trim().toLowerCase() !== poleId.trim().toLowerCase()) {
    throw new Error('GetWorkForm returned a record for a different pole. Check the poleId filter.');
  }
  return [{ poleId, trimmingWork: status ?? null, modifiedOn: typeof record.modifiedon === 'string' ? record.modifiedon : null }];
}

export function normalizeWorkForm(data: unknown, poleId: string): WorkFormRecord {
  const record = recordOf(data);
  if (Array.isArray(record.fields)) return data as WorkFormRecord;
  if (record.found !== false && !('cr1da_feederpolesection' in record)) {
    throw new Error('GetWorkForm did not return a recognized Dataverse work record.');
  }
  const returnedId = record.cr1da_feederpolesection;
  if (typeof returnedId === 'string' && returnedId.trim().toLowerCase() !== poleId.trim().toLowerCase()) {
    throw new Error('GetWorkForm returned a record for a different pole.');
  }
  const fields: WorkFormField[] = fieldDefinitions.map(([name, label, type]) => {
    const raw = name === 'cr1da_feederpolesection' ? poleId : record[name] ?? null;
    const formatted = record[name + formattedSuffix];
    if (type === 'choice') {
      const options = workFormChoices[name];
      const numeric = typeof raw === 'boolean' ? Number(raw)
        : typeof raw === 'number' ? raw
        : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : null;
      const selected = options.find(option => option.value === numeric)
        ?? options.find(option => option.label.toLowerCase() === String(raw ?? formatted ?? '').toLowerCase());
      if (raw != null && !selected) throw new Error(`Unrecognized ${label} value returned by GetWorkForm.`);
      return {
        name, label, type: 'choice', required: false, maxLength: null,
        options, value: selected?.value ?? null,
      };
    }
    return {
      name, label, type, required: false, maxLength: null, options: null,
      value: raw == null ? null : type === 'date' ? String(raw).slice(0, 10) : String(raw),
    };
  });
  return {
    found: record.found !== false,
    id: typeof record.cr1da_lvvmmodelid === 'string' ? record.cr1da_lvvmmodelid : null,
    version: typeof record['@odata.etag'] === 'string' ? record['@odata.etag'] : null,
    fields,
  };
}

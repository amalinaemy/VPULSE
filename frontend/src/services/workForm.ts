import type { Pole, WorkFormField, WorkFormRecord, WorkFormValue } from "./api";
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const lockedFieldNames = new Set(["cr1da_feederpolesection", "cr1da_feederid", "cr1da_zone", "cr1da_gpsautocapture", "cr1da_gambaraireference"]);
export const isLockedField = (field: {
    name: string;
    label: string;
    readOnly?: boolean;
}) => field.readOnly === true || lockedFieldNames.has(field.name) || ["poleid", "feederid", "streetname", "latitude", "longitude"].includes(key(field.label));
const fieldOrder = ["poleid", "feederid", "streetname", "latitude", "longitude", "inspectionstatus", "risklevel", "namapegawaicontractors", "inspectiondate", "aiconfirmedenroachment", "gambarsemasaditapak", "gambarselepasditapak", "fieldtrimmingrequired", "trimmingwork", "remarksactiontaken"];
export function sortWorkFormFields(fields: WorkFormField[]) {
    const position = (field: WorkFormField) => fieldOrder.indexOf(field.name === "cr1da_feederpolesection" ? "poleid" : key(field.label));
    return fields.slice().sort((first, second) => position(first) - position(second));
}
export function initialWorkFormValues(form: WorkFormRecord, pole: Pole): Record<string, WorkFormValue> {
    const initial: Record<string, WorkFormValue> = {};
    const details: Record<string, WorkFormValue> = {
        cr1da_feederpolesection: pole.poleId,
        cr1da_feederid: pole.feederId,
        cr1da_zone: pole.streetName,
        cr1da_gpsautocapture: pole.latitude,
        cr1da_gambaraireference: pole.longitude,
        poleid: pole.poleId,
        feederid: pole.feederId,
        streetname: pole.streetName,
        latitude: pole.latitude,
        longitude: pole.longitude,
    };
    for (const field of form.fields) {
        const detailKey = field.name in details ? field.name : key(field.label);
        // Assessment values remain authoritative even when blank or changed since the work record was saved.
        initial[field.name] = detailKey in details
            ? details[detailKey] ?? ""
            : field.value ?? (field.type === "multiselect" ? [] : "");
        if (field.type === "text" && initial[field.name] != null)
            initial[field.name] = String(initial[field.name]);
    }
    return initial;
}
export function editableWorkFormValues(record: WorkFormRecord, values: Record<string, WorkFormValue>) {
    return Object.fromEntries(record.fields
        .filter(field => !isLockedField(field) && (field.type !== "image" || (typeof values[field.name] === "string" && String(values[field.name]).startsWith("data:image/") && values[field.name] !== field.value)))
        .map(field => [field.name, values[field.name] === "" ? null : values[field.name]]));
}

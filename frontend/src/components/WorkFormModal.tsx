import { requiredWorkFields, validateWorkForm, workDateRange } from "../services/workFormValidation";
import { MapModalPortal } from "./MapModalPortal";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
    getWorkForm,
    saveWorkForm,
    type Pole,
    type WorkFormField,
    type WorkFormRecord,
    type WorkFormValue,
} from "../services/api";
import {
    editableWorkFormValues,
    initialWorkFormValues,
    isLockedField,
    sortWorkFormFields,
} from "../services/workForm";
import "./WorkFormModal.css";

interface WorkFormModalProps {
    pole: Pole;
    onClose: () => void;
    onSaved: () => Promise<void>;
}

interface FormFieldProps {
    error?: string;
    field: WorkFormField;
    value: WorkFormValue;
    onChange: (value: WorkFormValue) => void;
    onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function WorkFormModal({ pole, onClose, onSaved }: WorkFormModalProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [record, setRecord] = useState<WorkFormRecord | null>(null);
    const [values, setValues] = useState<Record<string, WorkFormValue>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [readingImages, setReadingImages] = useState(0);

    useEffect(() => {
        const element = dialog.current!;
        const previous = document.activeElement as HTMLElement | null;
        element.showModal();
        return () => {
            element.close();
            previous?.focus();
        };
    }, []);

    useEffect(() => {
        let active = true;
        setError("");
        getWorkForm(pole.poleId!)
            .then((form) => {
                if (!active) return;
                if (!form.fields.length) {
                    throw new Error("The Dataverse form fields could not be identified.");
                }
                form.fields = form.fields.map(field => ({ ...field,
                    label: requiredWorkFields[field.name] ?? field.label,
                    required: field.name in requiredWorkFields || field.required,
                }));
                setRecord(form);
                setValues(initialWorkFormValues(form, pole));
            })
            .catch((error) => {
                if (active) setError(error.message);
            });
        return () => { active = false; };
    }, [pole, loadAttempt]);

    function updateField(name: string, value: WorkFormValue) {
        setValues(current => ({ ...current, [name]: value }));
        setFieldErrors(current => {
            if (!(name in current)) return current;
            const next = { ...current };
            const message = validateWorkForm({ ...values, [name]: value })[name];
            if (message) next[name] = message; else delete next[name];
            return next;
        });
    }

    function readImage(name: string, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) {
            setError("Choose a JPG or PNG image of 1.5 MB or smaller.");
            event.target.value = "";
            return;
        }

        setError("");
        setReadingImages(count => count + 1);
        const reader = new FileReader();
        reader.onload = () => updateField(name, String(reader.result));
        reader.onerror = () => setError("Unable to read the image. Please choose it again.");
        reader.onloadend = () => setReadingImages(count => count - 1);
        reader.readAsDataURL(file);
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!record || saving || readingImages > 0) return;
        const validation = validateWorkForm(values);
        setFieldErrors(validation);
        if (Object.keys(validation).length) {
            setError("Please correct the highlighted fields before saving.");
            return;
        }
        setSaving(true);
        setError("");

        try {
            const changed = editableWorkFormValues(record, values);
            await saveWorkForm(pole.poleId!, record.id, record.version, changed);
            setSaved(true);
            try {
                await onSaved();
                onClose();
            } catch {
                setError("Form saved. Status refresh failed; refresh the page to see the latest status.");
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Unable to save the form.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <MapModalPortal><dialog
            ref={dialog}
            className="work-form-dialog"
            aria-labelledby="work-form-title"
            onCancel={event => {
                event.preventDefault();
                if (!saving) onClose();
            }}
        >
            <form onSubmit={submit} noValidate>
                <header>
                    <div>
                        <h2 id="work-form-title">{record?.id ? "Update Work Form" : "Work Form"}</h2>
                        <p>{pole.poleId} · {pole.streetName}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} aria-label="Close form">×</button>
                </header>

                <dl className="work-form-pole-context" aria-label="Pole assessment details">
                    <div><dt>Land Cover Type</dt><dd>{pole.landCoverType?.trim() || "Not recorded"}</dd></div>
                    <div><dt>Recommended Action</dt><dd>{pole.action?.trim() || "Not recorded"}</dd></div>
                </dl>

                {error && <p role="alert" className="work-form-error">{error}</p>}
                {error && !record && <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>Retry loading form</button>}
                {record?.found === false && <p role="status">No existing work record was found for this pole. Pole details are prefilled below.</p>}
                {!record && !error && <p role="status">Loading work form…</p>}

                <fieldset disabled={saving || saved} className="work-form-fields">
                    {sortWorkFormFields(record?.fields ?? []).map(field => (
                        <label
                            key={field.name}
                            className={field.name === "cr1da_remarksactiontaken" ? "work-form-remarks" : undefined}
                        >
                            <span>{field.required && !isLockedField(field) && <b aria-hidden="true">* </b>}{field.label}</span>
                            <FormField
                                field={field}
                                error={fieldErrors[field.name]}
                                value={values[field.name]}
                                onChange={value => updateField(field.name, value)}
                                onImageChange={event => readImage(field.name, event)}
                            />
                            {fieldErrors[field.name] && <small id={`${field.name}-error`} className="work-form-error" role="alert">{fieldErrors[field.name]}</small>}
                        </label>
                    ))}
                </fieldset>

                <footer>
                    <button type="button" onClick={onClose} disabled={saving}>
                        {saved ? "Close" : "Cancel"}
                    </button>
                    <button type="submit" disabled={!record || saving || saved || readingImages > 0}>
                        {saving ? "Saving…" : saved ? "Saved" : record?.id ? "Update form" : "Submit"}
                    </button>
                </footer>
            </form>
        </dialog></MapModalPortal>
    );
}

function FormField({ field, value, onChange, onImageChange, error }: FormFieldProps) {
    const locked = isLockedField(field);
    const { today } = workDateRange();
    const dateRestricted = ["cr1da_inspectiondate", "crf11_trimmingdate"].includes(field.name);

    if (field.type === "choice" || field.type === "multiselect") {
        return (
            <select
                aria-invalid={!!error}
                aria-describedby={error ? `${field.name}-error` : undefined}
                disabled={locked}
                required={field.required && !locked}
                multiple={field.type === "multiselect"}
                value={Array.isArray(value) ? value.map(String) : String(value ?? "")}
                onChange={event => onChange(
                    field.type === "multiselect"
                        ? Array.from(event.target.selectedOptions, option => Number(option.value))
                        : event.target.value === "" ? "" : Number(event.target.value)
                )}
            >
                {field.type === "choice" && <option value="">Select…</option>}
                {field.options?.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        );
    }

    if (field.type === "image") {
        return (
            <>
                <input
                    type="file"
                    accept="image/jpeg,image/png"
                    required={field.required && !locked && !value}
                    onChange={onImageChange}
                />
                <small>JPG or PNG, up to 1.5 MB. A selected image replaces this photo when saved.</small>
                {typeof value === "string" && value.startsWith("data:image/") && (
                    <img src={value} alt={field.label} />
                )}
            </>
        );
    }

    if (field.name === "cr1da_remarksactiontaken") {
        return (
            <textarea
                rows={3}
                required={field.required && !locked}
                maxLength={field.maxLength ?? undefined}
                value={String(value ?? "")}
                onChange={event => onChange(event.target.value)}
            />
        );
    }

    return (
        <input
            aria-invalid={!!error}
            aria-describedby={error ? `${field.name}-error` : undefined}
            readOnly={locked}
            required={field.required && !locked}
            maxLength={field.maxLength ?? undefined}
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            max={dateRestricted ? today : undefined}
            step="any"
            value={String(value ?? "")}
            onChange={event => onChange(
                field.type === "number" && event.target.value !== ""
                    ? Number(event.target.value)
                    : event.target.value
            )}
        />
    );
}

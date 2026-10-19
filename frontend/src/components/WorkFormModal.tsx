import { prepareWorkPhoto } from "../services/workPhoto";
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
    const [showAiInfo, setShowAiInfo] = useState(false);
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
        const poleId = pole.poleId?.trim();
        if (!poleId) {
            setError("A Pole ID is required to load the form.");
            return;
        }
        let active = true;
        setError("");
        setRecord(null);
        getWorkForm(poleId)
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

    async function readImage(name: string, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = "";
        setError("");
        setReadingImages(count => count + 1);
        try {
            const photo = await prepareWorkPhoto(file);
            updateField(name, photo);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Unable to prepare the photo.");
        } finally {
            setReadingImages(count => count - 1);
        }
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
            onClose();
            // App refreshes the summary once and displays any refresh error on the dashboard.
            await onSaved();
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

                {readingImages > 0 && <p role="status">Preparing photo…</p>}
                <fieldset disabled={saving || saved || readingImages > 0} className="work-form-fields">
                    {sortWorkFormFields(record?.fields ?? []).map(field => {
                        const isAiField = field.name === "cr1da_aiconfirmedenroachment";
                        const Container = field.type === "image" || isAiField ? "div" : "label";
                        return (
                        <Container
                            key={field.name}
                            className={isAiField ? "work-ai-field" : field.name === "cr1da_remarksactiontaken" ? "work-form-remarks" : field.type === "image" ? "work-photo-field" : undefined}
                        >
                            {isAiField ? <>
                                <div className="work-ai-heading">
                                    <label htmlFor={field.name}>{field.required && <b aria-hidden="true">* </b>}{field.label}</label>
                                    <button type="button" className="work-ai-info-button" aria-label="AI assessment guidance"
                                        aria-expanded={showAiInfo} aria-controls="work-ai-guidance" onClick={() => setShowAiInfo(value => !value)}>i</button>
                                </div>
                                {showAiInfo && <div id="work-ai-guidance" className="work-ai-guidance">
                                    <p><strong>AI correct</strong> <strong>:</strong> vegetation risk confirmed</p>
                                    <p>AI <strong>Partially correct :</strong></p>
                                    <ul>
                                        <li>vegetation within 30m radius</li>
                                        <li>Land Cover Type / Risk Category / Recommended Action : At least one is <strong>correct.</strong></li>
                                    </ul>
                                    <p><strong>AI False positive :</strong></p>
                                    <ul>
                                        <li>vegetation out of 30 m radius</li>
                                        <li>Land Cover Type, Risk Category, Recommended Action : All are <strong>incorrect.</strong></li>
                                    </ul>
                                </div>}
                            </> : <span>{field.required && !isLockedField(field) && <b aria-hidden="true">* </b>}{field.label}</span>}
                            <FormField
                                field={field}
                                error={fieldErrors[field.name]}
                                value={values[field.name]}
                                onChange={value => updateField(field.name, value)}
                                onImageChange={event => readImage(field.name, event)}
                            />
                            {fieldErrors[field.name] && <small id={`${field.name}-error`} className="work-form-error" role="alert">{fieldErrors[field.name]}</small>}
                        </Container>
                    ); })}
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
                id={field.name}
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
        return <WorkPhotoInput field={field} value={value} onImageChange={onImageChange} />;
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

function WorkPhotoInput({ field, value, onImageChange }: Pick<FormFieldProps, "field" | "value" | "onImageChange">) {
    const upload = useRef<HTMLInputElement>(null);
    const camera = useRef<HTMLInputElement>(null);
    return <>
        <div className="work-photo-actions" role="group" aria-label={field.label}>
            <button type="button" onClick={() => upload.current?.click()}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></svg>
                Upload photo
            </button>
            <button type="button" onClick={() => camera.current?.click()}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4 7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3z" /><circle cx="12" cy="13" r="4" /></svg>
                Take photo
            </button>
        </div>
        <input ref={upload} hidden type="file" accept="image/*" aria-label={`Upload photo for ${field.label}`} onChange={onImageChange} />
        <input ref={camera} hidden type="file" accept="image/*" capture="environment" aria-label={`Take photo for ${field.label}`} onChange={onImageChange} />
        <small>Choose a photo or use your camera. Photos are resized for upload and saved when you submit or update the form.</small>
        {typeof value === "string" && value.startsWith("data:image/") && <img src={value} alt={field.label} />}
    </>;
}

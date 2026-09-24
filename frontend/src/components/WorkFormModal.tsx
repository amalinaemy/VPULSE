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
    field: WorkFormField;
    value: WorkFormValue;
    onChange: (value: WorkFormValue) => void;
    onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function WorkFormModal({ pole, onClose, onSaved }: WorkFormModalProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [record, setRecord] = useState<WorkFormRecord | null>(null);
    const [values, setValues] = useState<Record<string, WorkFormValue>>({});
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
        getWorkForm(pole.poleId!)
            .then((form) => {
                if (!active) return;
                if (!form.fields.length) {
                    throw new Error("The Dataverse form fields could not be identified.");
                }
                setRecord(form);
                setValues(initialWorkFormValues(form, pole));
            })
            .catch((error) => {
                if (active) setError(error.message);
            });
        return () => { active = false; };
    }, [pole]);

    function updateField(name: string, value: WorkFormValue) {
        setValues(current => ({ ...current, [name]: value }));
    }

    function readImage(name: string, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) {
            setError("Choose a JPG or PNG image of 4 MB or smaller.");
            event.target.value = "";
            return;
        }

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
        <dialog
            ref={dialog}
            className="work-form-dialog"
            aria-labelledby="work-form-title"
            onCancel={event => {
                event.preventDefault();
                if (!saving) onClose();
            }}
        >
            <form onSubmit={submit}>
                <header>
                    <div>
                        <h2 id="work-form-title">{record?.id ? "Update Work Form" : "Work Form"}</h2>
                        <p>{pole.poleId} · {pole.streetName}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} aria-label="Close form">×</button>
                </header>

                {error && <p role="alert" className="work-form-error">{error}</p>}
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
                                value={values[field.name]}
                                onChange={value => updateField(field.name, value)}
                                onImageChange={event => readImage(field.name, event)}
                            />
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
        </dialog>
    );
}

function FormField({ field, value, onChange, onImageChange }: FormFieldProps) {
    const locked = isLockedField(field);

    if (field.type === "choice" || field.type === "multiselect") {
        return (
            <select
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
            readOnly={locked}
            required={field.required && !locked}
            maxLength={field.maxLength ?? undefined}
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
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

import { useEffect, useId, useRef } from "react";

export function FieldMultiFilter({ label, allLabel, options, selected, onChange, hideLabel = false }: {
    label: string; allLabel: string; options: string[]; selected: string[];
    onChange: (values: string[]) => void; hideLabel?: boolean;
}) {
    const ref = useRef<HTMLDetailsElement>(null);
    const id = useId();
    useEffect(() => {
        const closeOutside = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
        };
        document.addEventListener("pointerdown", closeOutside);
        return () => document.removeEventListener("pointerdown", closeOutside);
    }, []);
    const summary = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} selected`;
    return <div className="field-multi-filter">
        {!hideLabel && <span className="field-multi-label" id={id}>{label}</span>}
        <details ref={ref} onKeyDown={event => {
            if (event.key === "Escape" && ref.current) {
                ref.current.open = false;
                ref.current.querySelector("summary")?.focus();
            }
        }}>
            <summary aria-label={`${label}: ${summary}`} title={selected.join(", ") || allLabel}>{summary}</summary>
            <div className="field-multi-options" role="group" aria-label={label}>
                <label><input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />{allLabel}</label>
                {[...new Set([...options, ...selected])].map(option => <label key={option}>
                    <input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option)
                        ? selected.filter(value => value !== option) : [...selected, option])} />{option}
                </label>)}
            </div>
        </details>
    </div>;
}

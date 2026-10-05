import { useId } from "react";
import type { LineTypeFilterValue } from "../services/lineType";
import "./StateFilter.css";

export function LineTypeFilter({ value, onChange }: {
    value: LineTypeFilterValue; onChange: (value: LineTypeFilterValue) => void;
}) {
    const name = useId();
    return <fieldset className="page-state-filter">
        <legend>Filter by line type</legend>
        <div className="state-filter-options">
            {(["ALL", "MV", "LV"] as const).map(option => <label key={option}>
                <input type="radio" name={name} value={option} checked={value === option}
                    onChange={() => onChange(option)} />
                {option === "ALL" ? "All line types" : option}
            </label>)}
        </div>
    </fieldset>;
}

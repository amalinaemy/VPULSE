export type LineTypeFilterValue = "ALL" | "MV" | "LV";

// Dataverse formatted labels are preferred by the API adapter. Do not guess numeric choice codes.
export function matchesLineType(value: unknown, filter: LineTypeFilterValue): boolean {
    if (filter === "ALL") return true;
    if (typeof value !== "string") return false;
    const label = value.trim().toUpperCase().replace(/\s+/g, " ");
    // Stored overhead-line labels include the OHL suffix (for example, MV OHL).
    return label === filter || label === `${filter} OHL` || label === (filter === "MV" ? "MEDIUM VOLTAGE" : "LOW VOLTAGE");
}

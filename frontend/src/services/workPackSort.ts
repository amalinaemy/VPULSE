export type WorkPackSort = "priority" | "poleIdAsc" | "poleIdDesc";

// Input is already in risk priority order; preserve that order for equal IDs.
export function sortWorkPackPoles<T extends { poleId: string | null }>(poles: readonly T[], order: WorkPackSort): T[] {
    const sorted = [...poles];
    if (order === "priority") return sorted;
    return sorted.sort((first, second) => {
        const comparison = (first.poleId ?? "").localeCompare(second.poleId ?? "");
        return order === "poleIdAsc" ? comparison : -comparison;
    });
}

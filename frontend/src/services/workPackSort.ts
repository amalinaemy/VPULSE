export type WorkPackSort = "priority" | "poleIdAsc" | "poleIdDesc";

const poleIdCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function comparePoleIds(first: string | null, second: string | null): number {
    return poleIdCollator.compare((first ?? "").trim(), (second ?? "").trim());
}

// Input is already in risk priority order; preserve that order for equal IDs.
export function sortWorkPackPoles<T extends { poleId: string | null }>(poles: readonly T[], order: WorkPackSort): T[] {
    const sorted = [...poles];
    if (order === "priority") return sorted;
    return sorted.sort((first, second) => {
        const comparison = comparePoleIds(first.poleId, second.poleId);
        return order === "poleIdAsc" ? comparison : -comparison;
    });
}

import type { WorkFeedback } from "./api";

export type TrimmingStatus = "Completed" | "Not Started" | "In Progress" | "Pending";

export function trimmingWorkStatus(value: string | undefined): TrimmingStatus {
    if (!value?.trim()) return "Pending";
    const status = value.trim().toLowerCase();
    if (status.includes("complete") || status.includes("done") || status === "yes") return "Completed";
    if (status.includes("progress") || status.includes("ongoing")) return "In Progress";
    if (status.includes("not started") || status.includes("not-started")) return "Not Started";
    return "Pending";
}

export function poleTrimmingStatus(poleId: string | null, feedback: WorkFeedback[]): TrimmingStatus {
    const id = poleId?.trim().toLowerCase();
    const match = id ? feedback.find((item) => item.poleId?.trim().toLowerCase() === id && item.trimmingWork) : undefined;
    return trimmingWorkStatus(match?.trimmingWork ?? undefined);
}

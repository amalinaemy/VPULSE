import type { WorkFeedback } from "./api";

export type TrimmingStatus = "Completed" | "Not Started" | "N/A" | "Pending";

export function trimmingWorkStatus(value: string | undefined): TrimmingStatus {
    const mapped = getTrimmingStatus(value);
    if (mapped) return mapped;
    if (!value?.trim()) return "Pending";
    const status = value.trim().toLowerCase();
    if (status.includes("complete") || status.includes("done") || status === "yes") return "Completed";
    if (status.includes("progress") || status.includes("ongoing")) return "N/A";
    if (status.includes("not started") || status.includes("not-started")) return "Not Started";
    return "Pending";
}

export function poleTrimmingStatus(poleId: string | null, feedback: WorkFeedback[]): TrimmingStatus | "Unavailable" {
    const id = poleId?.trim().toLowerCase();
    const match = id ? feedback.find((item) => item.poleId?.trim().toLowerCase() === id) : undefined;
    return match ? trimmingWorkStatus(match.trimmingWork ?? undefined) : "Unavailable";
}


// These are the choice values already recorded in the form configuration.
// No numeric Pending choice has been confirmed; missing records are handled separately.
export function getTrimmingStatus(value: string | number | null | undefined): TrimmingStatus | null {
    if (value == null || String(value).trim() === "") return null;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "0" || normalized === "completed") return "Completed";
    if (normalized === "1" || normalized === "n/a" || normalized === "not applicable" || normalized === "in progress") return "N/A";
    if (normalized === "2" || normalized === "not started") return "Not Started";
    if (normalized === "pending") return "Pending";
    return null;
}

export type DashboardTrimmingStatus = TrimmingStatus | "Unknown" | "Loading" | "Unavailable";

export function dashboardTrimmingStatus(
    hasRecord: boolean, value: string | number | null | undefined,
    loading: boolean, failed: boolean,
): DashboardTrimmingStatus {
    if (loading) return "Loading";
    if (failed) return "Unavailable";
    return hasRecord ? getTrimmingStatus(value) ?? "Unknown" : "Pending";
}

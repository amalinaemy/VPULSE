import { WorkFormModal } from "../components/WorkFormModal";
import { trimmingWorkStatus } from "../services/trimmingWork";
import { useEffect, useMemo, useState } from "react";
import { GeospatialAnalysis } from "../components/GeospatialAnalysis";
import type { Pole, WorkFeedback } from "../services/api";
import { PoleDetailsModal } from "./EngineerPage";

export interface FieldTeamPageProps {
    poles: Pole[];
    workFeedback: WorkFeedback[];
    isLoading: boolean;
    error: string | null;
    feedbackLoading: boolean;
    feedbackError: string | null;
    onRefreshFeedback: () => void;
    onWorkFormSaved: () => Promise<void>;
}

type TrimmingStatus = "Completed" | "Not Started" | "In Progress" | "Pending";
type TrimmingFilter = "All" | TrimmingStatus;
type RiskFilter = "All" | "CRITICAL" | "HIGH";
const pageSize = 10;

export function FieldTeamPage({ poles, workFeedback, isLoading, error, feedbackLoading, feedbackError, onRefreshFeedback, onWorkFormSaved }: FieldTeamPageProps) {
    const [formPole, setFormPole] = useState<Pole | null>(null);
    const [trimmingFilter, setTrimmingFilter] = useState<TrimmingFilter>("All");
    const [riskFilter, setRiskFilter] = useState<RiskFilter>("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [targetPoleId, setTargetPoleId] = useState<string | null>(null);
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const priorityPoles = useMemo(() => poles
        .filter((pole) => ["CRITICAL", "HIGH"].includes(riskLevel(pole)))
        .sort((first, second) => riskScore(second) - riskScore(first)), [poles]);
    const trimmingWorkByPole = useMemo(() => {
        const feedbackByPole = new Map<string, string>();
        workFeedback.forEach((feedback) => {
            const poleId = normalizePoleId(feedback.poleId);
            if (poleId && feedback.trimmingWork && !feedbackByPole.has(poleId)) {
                feedbackByPole.set(poleId, feedback.trimmingWork);
            }
        });
        return feedbackByPole;
    }, [workFeedback]);
    const statusCounts = useMemo(() => {
        const counts: Record<TrimmingStatus, number> = {
            "Completed": 0,
            "In Progress": 0,
            "Not Started": 0,
            "Pending": 0,
        };
        priorityPoles.forEach((pole) => {
            const trimmingWork = trimmingWorkByPole.get(normalizePoleId(pole.poleId));
            counts[trimmingWorkStatus(trimmingWork)] += 1;
        });
        return counts;
    }, [priorityPoles, trimmingWorkByPole]);

    //Filter poles & Pending Poles without work order
    const criticalPendingPoles = useMemo(() => priorityPoles.filter((pole) =>
        riskLevel(pole) === "CRITICAL"
        && trimmingWorkStatus(trimmingWorkByPole.get(normalizePoleId(pole.poleId))) === "Pending"
    ), [priorityPoles, trimmingWorkByPole]);
    const filteredPoles = useMemo(() => priorityPoles.filter((pole) => {
        const query = search.trim().toLowerCase();
        if (query && ![pole.poleId, pole.feederId, pole.streetName]
            .some((value) => (value ?? "").toLowerCase().includes(query))) return false;
        if (riskFilter !== "All" && riskLevel(pole) !== riskFilter) return false;
        if (trimmingFilter === "All") return true;
        return trimmingWorkStatus(trimmingWorkByPole.get(normalizePoleId(pole.poleId))) === trimmingFilter;
    }), [priorityPoles, trimmingWorkByPole, trimmingFilter, riskFilter, search]);
    const priorityRankByPole = useMemo(() => new Map(priorityPoles.map((pole, index) => [pole, index + 1])), [priorityPoles]);
    const totalPages = Math.max(1, Math.ceil(filteredPoles.length / pageSize));
    const pagePoles = filteredPoles.slice((page - 1) * pageSize, page * pageSize);

    const hasActiveFilters = search.trim() !== "" || riskFilter !== "All" || trimmingFilter !== "All";

    useEffect(() => setPage(1), [riskFilter, trimmingFilter, search]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
    useEffect(() => {
        if (!targetPoleId) return;
        const target = document.getElementById(fieldTaskId(targetPoleId));
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
        setTargetPoleId(null);
    }, [targetPoleId, pagePoles]);

    function resetFilters() {
        setSearch("");
        setRiskFilter("All");
        setTrimmingFilter("All");
        setPage(1);
    }

    function openPendingPole(pole: Pole) {
        const poleId = pole.poleId?.trim();
        if (!poleId) return;
        setSearch(poleId);
        setRiskFilter("CRITICAL");
        setTrimmingFilter("Pending");
        setPage(1);
        setTargetPoleId(poleId);
    }

    async function exportWorkOrders() {
        const XLSX = await import("xlsx");
        const rows = filteredPoles.map((pole) => ({
            "Priority Rank": priorityRankByPole.get(pole),
            "Pole ID": pole.poleId ?? "",
            "Feeder ID": pole.feederId ?? "",
            "Street Name": pole.streetName ?? "",
            "Latitude": pole.latitude ?? "",
            "Longitude": pole.longitude ?? "",
            "Risk Category": riskLevel(pole),
            "Risk Score": pole.finalAiRiskScore ?? "",
            "Land Cover Type": pole.landCoverType ?? "",
            "Recommended Action": pole.action ?? "Field inspection required",
            "Trimming Work": trimmingWorkStatus(trimmingWorkByPole.get(normalizePoleId(pole.poleId))),
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet["!cols"] = [
            { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
            { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 42 }, { wch: 18 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Work Orders");
        XLSX.writeFile(workbook, `field-work-orders-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
    }

    return <>
        <section className="hero-panel field-team-hero">
            <span className="eyebrow">Field Team View</span>
            <h2>Work Pack and Site Navigation</h2>
            <p>Execution-focused view for task selection, route opening, completion status and evidence collection.</p>
            <div className="pill-row"><span>Field validation</span></div>
        </section>
        {feedbackLoading ? <p className="loading" role="status">Loading trimming progress…</p> : feedbackError &&
            <div className="loading" role="alert">
                <p>Unable to refresh trimming progress: {feedbackError}</p>
                <button type="button" onClick={onRefreshFeedback}>Retry</button>
            </div>}
        <section className="metrics field-team-metrics">
            <FieldMetric label="Today Work Pack" value={priorityPoles.length} note="Critical + High tasks" />
            <FieldMetric label="Completed" value={statusCounts.Completed} note="Trimming work completed" accent="green" />
            <FieldMetric label="In Progress" value={statusCounts["In Progress"]} note="Work currently underway" accent="orange" />
            <FieldMetric label="Not Started" value={statusCounts["Not Started"]} note="Work has not started" accent="red" />
            <FieldMetric label="Pending" value={statusCounts.Pending} note="Need site action" />
        </section>
        {isLoading ? 
        <p className="loading">Loading field work pack…</p> 
        : error ? <p className="loading">{error}</p> : priorityPoles.length === 0 ? 
        <p className="loading">No Critical or High poles found.</p> : <>
            <div className="field-team-map">
                <GeospatialAnalysis poles={priorityPoles} showFeederRanking={false} onViewDetails={setSelectedPole} />
                <article className="feeder-ranking-card critical-pending-card">
                    <div className="critical-pending-heading">
                        <div><p>Pending work analysis</p><h3>Critical Pending Work</h3></div>
                        <button className="map-info-button" type="button" aria-label="Critical pending work information">
                            i<span>Critical-risk poles that require field action.</span>
                        </button>
                    </div>
                    {criticalPendingPoles.length === 0 ? <span className="no-critical-poles">
                        No Critical poles have pending work.</span> 
                            : <ol>{criticalPendingPoles.map((pole, index) => <li key={`${pole.poleId ?? "pole"}-${index}`}>
                        <button className="critical-pending-link" type="button" onClick={() => openPendingPole(pole)}>
                            <span><b>{index + 1}. {pole.poleId ?? "Unnamed pole"}</b><small>{pole.streetName ?? "Street not recorded"}</small></span>
                            <strong>{pole.finalAiRiskScore ?? "—"}</strong>
                        </button>
                    </li>)}</ol>}
                </article>
            </div>
            <section className="engineer-panel field-work-pack">
                <div className="engineer-heading">
                    <div className="field-work-pack-title-row">
                        <div><h3>Field Work Pack</h3>
                        <p>Prioritised inspection and pruning tasks for field execution.</p></div>
                        <div className="field-work-pack-title-actions">
                            <button className="export-work-orders-button" type="button" onClick={exportWorkOrders} disabled={filteredPoles.length === 0}>Export Excel</button>
                            <span className="data-tag">{filteredPoles.length} of {priorityPoles.length} poles</span>
                        </div>
                    </div>

                    {/*Search and filter controls*/}
                    <div className="field-work-pack-tools">
                        <label className="field-pole-search">Search poles
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pole ID, Feeder ID, or Street Name" type="search" />
                        </label>
                        <label>Risk category
                            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}>
                                <option value="All">All categories</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option>
                            </select>
                        </label>
                        <label>Trimming work
                            <select value={trimmingFilter} onChange={(event) => setTrimmingFilter(event.target.value as TrimmingFilter)}>
                                <option value="All">All</option>
                                <option value="Completed">Completed</option>
                                <option value="Not Started">Not Started</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </label>
                        <button className="reset-filters-button" type="button" onClick={resetFilters} disabled={!hasActiveFilters} aria-label="Reset filters" title="Reset filters">
                            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M4 4v6h6M5.6 15a7 7 0 1 0 .7-7.9L4 10" /></svg>
                        </button>
                    </div></div>
                {filteredPoles.length === 0 ? <p className="loading">No poles match the selected filters.</p> : <><div className="field-task-list">{pagePoles.map((pole, index) => {
                    const category = riskLevel(pole);
                    const trimmingWork = trimmingWorkStatus(trimmingWorkByPole.get(normalizePoleId(pole.poleId)));
                    return <article className="field-task" id={fieldTaskId(pole.poleId)} tabIndex={-1} key={`${pole.poleId ?? "pole"}-${index}`}>
                        <div className="field-task-rank" aria-label={`Priority rank ${priorityRankByPole.get(pole)}`}>{priorityRankByPole.get(pole)}</div>
                        <div className="field-task-info"><h4>{pole.poleId ?? "Unnamed pole"}</h4><p>{pole.streetName ?? "Street not recorded"}</p>
                            <small>{pole.action ?? "Field inspection required"}</small>
                            <span className={`trimming-status ${trimmingStatusClass(trimmingWork)}`}>Trimming work: {trimmingWork}</span>
                        </div>
                        <div className="field-task-statuses">
                            <strong className={`risk-${category.toLowerCase()}`}>{category} {pole.finalAiRiskScore ?? "—"}</strong>
                        </div>
                        <div className="field-task-actions">
                            <button type="button" onClick={() => openGoogleMaps(pole)}>Map</button>
                            <button type="button" disabled={!pole.poleId} onClick={() => setFormPole(pole)}>Form</button>
                        </div>
                    </article>;
                })}</div>

                {/*Pagination */}
                    <div className="table-pagination field-task-pagination">
                        <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredPoles.length)} of {filteredPoles.length}</span>
                        <div>
                            <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>←</button>
                            <span>Page {page} of {totalPages}</span>
                            <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>→</button>
                        </div>
                    </div>
                </>}
            </section>
            {formPole && <WorkFormModal pole={formPole} onClose={() => setFormPole(null)} onSaved={onWorkFormSaved} />}
            {selectedPole && <PoleDetailsModal workFeedback={workFeedback} pole={selectedPole} onClose={() => setSelectedPole(null)} />}
        </>}
    </>;
}

function FieldMetric({ label, value, note, accent = "blue" }: { label: string; value: number; note: string; accent?: string }) {
    return <article className="metric"><span>{label}</span><strong className={accent}>{value}</strong><p>{note}</p></article>;
}

function riskScore(pole: Pole) { return Number(pole.finalAiRiskScore ?? -1); }
function normalizePoleId(poleId: string | null) { return poleId?.trim().toLowerCase() ?? ""; }
function fieldTaskId(poleId: string | null) { return `field-task-${normalizePoleId(poleId).replace(/[^a-z0-9_-]/g, "-")}`; }
function trimmingStatusClass(status: TrimmingStatus) {
    if (status === "Completed") return "status-completed";
    if (status === "In Progress") return "status-in-progress";
    if (status === "Not Started") return "status-not-started";
    return "status-pending";
}
function riskLevel(pole: Pole) {
    const category = pole.finalAiRiskCategory?.trim().toUpperCase();
    if (category === "CRITICAL" || category === "HIGH" || category === "MEDIUM" || category === "LOW") return category;
    const score = riskScore(pole);
    return score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}
function openGoogleMaps(pole: Pole) { window.open(`https://www.google.com/maps?q=${pole.latitude},${pole.longitude}`, "_blank", "noopener,noreferrer"); }

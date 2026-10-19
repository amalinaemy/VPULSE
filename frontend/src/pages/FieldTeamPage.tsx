import { matchesSelection } from "../services/filterSelection";
import { FieldMultiFilter } from "../components/FieldMultiFilter";
import { sortWorkPackPoles, type WorkPackSort } from "../services/workPackSort";
import { StateFilter } from "../components/StateFilter";
import { useStateFilter } from "../services/useStateFilter";
import { LineTypeFilter } from "../components/LineTypeFilter";
import { matchesLineType, type LineTypeFilterValue } from "../services/lineType";
import { WorkFormModal } from "../components/WorkFormModal";
import { dashboardTrimmingStatus, type DashboardTrimmingStatus } from "../services/trimmingWork";
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

type TrimmingStatus = "Completed" | "Not Started" | "N/A" | "Pending";
const pageSize = 10;

export function FieldTeamPage({ poles: allPoles, workFeedback, isLoading, error, feedbackLoading, feedbackError, onRefreshFeedback, onWorkFormSaved }: FieldTeamPageProps) {
    const { poles: statePoles, states, selection, setSelection } = useStateFilter(allPoles);
    const [lineType, setLineType] = useState<LineTypeFilterValue>("ALL");
    const [formPole, setFormPole] = useState<Pole | null>(null);
    const [trimmingFilter, setTrimmingFilter] = useState<string[]>([]);
    const [riskFilter, setRiskFilter] = useState<string[]>([]);
    const [sortOrder, setSortOrder] = useState<WorkPackSort>("priority");
    const [stationFilter, setStationFilter] = useState<string[]>([]);
    const [substationFilter, setSubstationFilter] = useState<string[]>([]);
    const [landCoverFilter, setLandCoverFilter] = useState<string[]>([]);
    const trimmingWorkByPole = useMemo(() => {
        const feedbackByPole = new Map<string, string | undefined>();
        workFeedback.forEach((feedback) => {
            const poleId = normalizePoleId(feedback.poleId);
            if (poleId && !feedbackByPole.has(poleId)) {
                feedbackByPole.set(poleId, feedback.trimmingWork ?? undefined);
            }
        });
        return feedbackByPole;
    }, [workFeedback]);
    const statusesLoading = isLoading || feedbackLoading;
    const statusesFailed = Boolean(error || feedbackError);
    const statusesReady = !statusesLoading && !statusesFailed;
    const statusByPole = useMemo(() => new Map(allPoles.map(pole => {
        const key = normalizePoleId(pole.poleId);
        return [key, dashboardTrimmingStatus(trimmingWorkByPole.has(key), trimmingWorkByPole.get(key), statusesLoading, statusesFailed)];
    })), [allPoles, trimmingWorkByPole, statusesLoading, statusesFailed]);
    // Summary scope follows State and Line Type, independently of the trimming filter.
    const summaryPoles = useMemo(() => statePoles.filter(pole =>
        matchesLineType(pole.lineType, lineType)
    ), [statePoles, lineType]);
    const poles = useMemo(() => summaryPoles.filter(pole =>
        matchesSelection(trimmingFilter, statusByPole.get(normalizePoleId(pole.poleId)) ?? "Unavailable")
    ), [summaryPoles, trimmingFilter, statusByPole]);
    const stations = useMemo(() => [...new Set(poles.map(workPackStation))].sort((a, b) => a.localeCompare(b)), [poles]);
    const substations = useMemo(() => [...new Set(poles.map(workPackSubstation))].sort((a, b) => a.localeCompare(b)), [poles]);
    const landCoverTypes = useMemo(() => [...new Set(poles.map(workPackLandCover))].sort((a, b) => a.localeCompare(b)), [poles]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [targetPoleId, setTargetPoleId] = useState<string | null>(null);
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const priorityPoles = useMemo(() => [...poles]
        .sort((first, second) => riskScore(second) - riskScore(first)), [poles]);
    const statusCounts = useMemo(() => {
        const counts: Record<TrimmingStatus | "Unknown", number> = {
            "Completed": 0,
            "N/A": 0,
            "Not Started": 0,
            "Pending": 0,
            "Unknown": 0,
        };
        summaryPoles.forEach((pole) => {
            const status = statusByPole.get(normalizePoleId(pole.poleId));
            if (status && status !== "Loading" && status !== "Unavailable") counts[status] += 1;
        });
        return counts;
    }, [summaryPoles, statusByPole]);



    //Filter poles & Pending Poles without work order
    const criticalPendingPoles = useMemo(() => priorityPoles.filter((pole) =>
        riskLevel(pole) === "CRITICAL"
        && statusByPole.get(normalizePoleId(pole.poleId)) === "Pending"
    ), [priorityPoles, statusByPole]);
    const filteredPoles = useMemo(() => priorityPoles.filter((pole) => {
        if (!matchesSelection(stationFilter, workPackStation(pole))) return false;
        if (!matchesSelection(landCoverFilter, workPackLandCover(pole))) return false;
        if (!matchesSelection(substationFilter, workPackSubstation(pole))) return false;
        const query = search.trim().toLowerCase();
        if (query && ![pole.poleId, pole.feederId, pole.streetName, pole.substation]
            .some((value) => (value ?? "").toLowerCase().includes(query))) return false;
        if (!matchesSelection(riskFilter, riskLevel(pole))) return false;
        return true;
    }), [priorityPoles, riskFilter, stationFilter, substationFilter, landCoverFilter, search]);
    const priorityRankByPole = useMemo(() => new Map(priorityPoles.map((pole, index) => [pole, index + 1])), [priorityPoles]);
    const totalPages = Math.max(1, Math.ceil(filteredPoles.length / pageSize));
    const sortedPoles = useMemo(() => sortWorkPackPoles(filteredPoles, sortOrder), [filteredPoles, sortOrder]);
    const pagePoles = sortedPoles.slice((page - 1) * pageSize, page * pageSize);

    const hasActiveFilters = sortOrder !== "priority" || stationFilter.length > 0 || landCoverFilter.length > 0 || substationFilter.length > 0 || search.trim() !== "" || riskFilter.length > 0;

    useEffect(() => setPage(1), [sortOrder, riskFilter, trimmingFilter, stationFilter, substationFilter, landCoverFilter, search]);
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
        setSortOrder("priority");
        setStationFilter([]);
        setLandCoverFilter([]);
        setSubstationFilter([]);
        setSearch("");
        setRiskFilter([]);
        setPage(1);
    }

    function selectRankedSubstation(substation: string | null) {
        setStationFilter([]);
        setLandCoverFilter([]);
        setSubstationFilter(substation ? [substation] : []);
        setSearch("");
        setRiskFilter([]);
        setPage(1);
        setTargetPoleId(null);
    }

    function openPendingPole(pole: Pole) {
        const poleId = pole.poleId?.trim();
        if (!poleId) return;
        setStationFilter([]);
        setLandCoverFilter([]);
        setSubstationFilter([]);
        setSearch(poleId);
        setRiskFilter(["CRITICAL"]);
        setPage(1);
        setTargetPoleId(poleId);
    }

    async function exportWorkOrders() {
        const XLSX = await import("xlsx");
        const rows = sortedPoles.map((pole) => ({
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
            "Trimming Work": statusByPole.get(normalizePoleId(pole.poleId)) ?? "Unavailable",
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
        <div className="field-general-filters">
            <LineTypeFilter value={lineType} onChange={value => { setLineType(value); setSelectedPole(null); setPage(1); setTargetPoleId(null); setFormPole(null); }} />
            <fieldset className="page-state-filter">
                <legend>Filter by trimming work</legend>
                <FieldMultiFilter label="Filter by trimming work" hideLabel allLabel="All trimming work"
                    options={["Completed", "Not Started", "N/A", "Pending"]} selected={trimmingFilter} onChange={values => {
                        setTrimmingFilter(values);
                        setPage(1);
                        setSelectedPole(null);
                        setTargetPoleId(null);
                        setFormPole(null);
                    }} />
            </fieldset>
        </div>
        <StateFilter states={states} selection={selection} count={poles.length} onChange={value => {
            setSelection(value);
            setPage(1);
            setSelectedPole(null);
            setTargetPoleId(null);
            setFormPole(null);
        }} />
        <p className="field-feedback-notice" role="status">
            {statusesLoading ? "Loading trimming summary…" : statusesFailed
                ? "Trimming statuses are unavailable."
                : "Trimming summary loaded. Poles without an inspection record are Pending."}
        </p>
        {feedbackError &&
            <div className="loading" role="alert">
                <p>Unable to refresh trimming progress: {feedbackError}</p>
                <button type="button" onClick={onRefreshFeedback}>Retry</button>
            </div>}
        {!feedbackLoading && !feedbackError && <button type="button" className="export-work-orders-button" onClick={onRefreshFeedback}>Refresh trimming statuses</button>}
        <section className="metrics field-team-metrics">
            <FieldMetric label="Today Work Pack" value={statusesReady ? summaryPoles.length : "—"} note="All risk categories" />
            <FieldMetric label="Completed" value={statusesReady ? statusCounts.Completed : "—"} note="Trimming work completed" accent="green" />
            <FieldMetric label="N/A" value={statusesReady ? statusCounts["N/A"] : "—"} note="Trimming not applicable" accent="orange" />
            <FieldMetric label="Not Started" value={statusesReady ? statusCounts["Not Started"] : "—"} note="Work has not started" accent="red" />
            <FieldMetric label="Pending" value={statusesReady ? statusCounts.Pending : "—"} note="Need site action" />
        </section>
        {isLoading ?
        <p className="loading">Loading field work pack…</p>
        : error ? <p className="loading">{error}</p> : poles.length === 0 ?
        <p className="loading">No poles match the selected general filters.</p> : <>
            <div className="field-team-map">
                <GeospatialAnalysis poles={poles} onSelectPole={openPendingPole} onViewDetails={setSelectedPole} onOpenForm={setFormPole} onSubstationChange={selectRankedSubstation} />
                <article className="feeder-ranking-card critical-pending-card">
                    <div className="critical-pending-heading">
                        <div><p>Pending work analysis</p><h3>Critical Pending Work</h3></div>
                        <button className="map-info-button" type="button" aria-label="Critical pending work information">
                            i<span>Critical-risk poles that require field action.</span>
                        </button>
                    </div>
                    {criticalPendingPoles.length === 0 ? <span className="no-critical-poles">
                        {statusesLoading ? "Loading pending work…" : statusesFailed ? "Pending work is unavailable." : "No Critical poles have pending work."}</span>
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
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pole ID, Feeder ID, Street Name, or Substation" type="search" />
                        </label>
                        <FieldMultiFilter label="Risk category" allLabel="All categories" options={["CRITICAL", "HIGH", "MEDIUM", "LOW"]} selected={riskFilter} onChange={setRiskFilter} />
                        <FieldMultiFilter label="Station" allLabel="All stations" options={stations} selected={stationFilter} onChange={setStationFilter} />
                        <FieldMultiFilter label="Substation" allLabel="All substations" options={substations} selected={substationFilter} onChange={setSubstationFilter} />
                        <FieldMultiFilter label="Land cover type" allLabel="All land cover types" options={landCoverTypes} selected={landCoverFilter} onChange={setLandCoverFilter} />
                        <label>Sort by
                            <select value={sortOrder} onChange={event => setSortOrder(event.target.value as WorkPackSort)}>
                                <option value="priority">Priority (highest risk first)</option>
                                <option value="poleIdAsc">Pole ID ↑ (ascending)</option>
                                <option value="poleIdDesc">Pole ID ↓ (descending)</option>
                            </select>
                        </label>
                        <button className="reset-filters-button" type="button" onClick={resetFilters} disabled={!hasActiveFilters} aria-label="Reset filters" title="Reset filters">
                            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M4 4v6h6M5.6 15a7 7 0 1 0 .7-7.9L4 10" /></svg>
                        </button>
                    </div></div>
                {filteredPoles.length === 0 ? <p className="loading">No poles match the selected filters.</p> : <><div className="field-task-list">{pagePoles.map((pole, index) => {
                    const category = riskLevel(pole);
                    const trimmingWork = statusByPole.get(normalizePoleId(pole.poleId)) ?? "Unavailable";
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

function FieldMetric({ label, value, note, accent = "blue" }: { label: string; value: number | string; note: string; accent?: string }) {
    return <article className="metric"><span>{label}</span><strong className={accent}>{value}</strong><p>{note}</p></article>;
}

function workPackStation(pole: Pole) { return pole.station?.trim() || "Unassigned"; }
function workPackLandCover(pole: Pole) { return pole.landCoverType?.trim() || "Unknown"; }
function riskScore(pole: Pole) { return Number(pole.finalAiRiskScore ?? -1); }
function normalizePoleId(poleId: unknown) { return String(poleId ?? "").trim().toUpperCase(); }
function fieldTaskId(poleId: string | null) { return `field-task-${normalizePoleId(poleId).replace(/[^A-Z0-9_-]/g, "-")}`; }
function trimmingStatusClass(status: DashboardTrimmingStatus) {
    if (status === "Completed") return "status-completed";
    if (status === "N/A") return "status-not-applicable";
    if (status === "Not Started") return "status-not-started";
    return status === "Pending" ? "status-pending" : "status-unknown";
}
function riskLevel(pole: Pole) {
    const category = pole.finalAiRiskCategory?.trim().toUpperCase();
    if (category === "CRITICAL" || category === "HIGH" || category === "MEDIUM" || category === "LOW") return category;
    const score = riskScore(pole);
    return score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}
function openGoogleMaps(pole: Pole) { window.open(`https://www.google.com/maps?q=${pole.latitude},${pole.longitude}`, "_blank", "noopener,noreferrer"); }

function workPackSubstation(pole: Pole) { return pole.substation?.trim() || pole.feederId?.trim() || "Unassigned feeder"; }

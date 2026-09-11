import { useEffect, useMemo, useState } from "react";
import type { Pole } from "../services/api";
import { GeospatialAnalysis } from "../components/GeospatialAnalysis";
import { EngineerHierarchyTable } from "../components/EngineerHierarchyTable";

type SortKey = "poleId" | "riskCategory" | "riskScore";
type SortDirection = "asc" | "desc";
const riskLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type RiskCategory = typeof riskLevels[number];
const pageSize = 20;

export function EngineerPage({ poles, isLoading, error, viewLabel = "Engineer View", hierarchyMode = false }: { poles: Pole[]; isLoading: boolean; error: string | null; viewLabel?: string; hierarchyMode?: boolean }) {
    const [search, setSearch] = useState("");
    const [riskFilter, setRiskFilter] = useState("all");
    const [landFilter, setLandFilter] = useState("all");
    const [sortKey, setSortKey] = useState<SortKey>("riskScore");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(1);
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const [targetPoleId, setTargetPoleId] = useState<string | null>(null);
    const [hierarchyTarget, setHierarchyTarget] = useState<{ pole: Pole; request: number } | null>(null);

    const riskCategories = useMemo(() => uniqueValues(poles.map((pole) => riskLevel(pole))), [poles]);
    const landTypes = useMemo(() => uniqueValues(poles.map((pole) => pole.landCoverType ?? "Unknown")), [poles]);
    const riskSummary = useMemo(() => {
        const counts: Record<RiskCategory, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        poles.forEach((pole) => { counts[riskLevel(pole)] += 1; });
        return counts;
    }, [poles]);

    const filteredPoles = useMemo(() => {
        const query = search.trim().toLowerCase();

        return poles
        .filter((pole) => !query || [pole.poleId, pole.feederId, pole.streetName]
            .some((value) => (value ?? "").toLowerCase().includes(query)))
        .filter((pole) => riskFilter === "all" || riskLevel(pole) === riskFilter)
        .filter((pole) => landFilter === "all" || (pole.landCoverType ?? "Unknown") === landFilter)
        .sort((first, second) => comparePoles(first, second, sortKey, sortDirection));
    },
        [poles, search, riskFilter, landFilter, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredPoles.length / pageSize));
    const pageRows = filteredPoles.slice((page - 1) * pageSize, page * pageSize);
    const hasActiveFilters = search.trim() !== "" || riskFilter !== "all" || landFilter !== "all";

    useEffect(() => setPage(1), [search, riskFilter, landFilter, sortKey, sortDirection]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
    useEffect(() => {
        if (!targetPoleId) return;
        const target = document.getElementById(engineerRowId(targetPoleId));
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
        setTargetPoleId(null);
    }, [targetPoleId, pageRows]);

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDirection(key === "riskScore" ? "desc" : "asc"); }
    }

    function resetFilters() {
        setSearch("");
        setRiskFilter("all");
        setLandFilter("all");
    }

    function openPoleRecord(pole: Pole) {
        const poleId = pole.poleId?.trim();
        if (!poleId) return;
        if (hierarchyMode) {
            setHierarchyTarget({ pole, request: Date.now() });
            return;
        }
        setSearch(poleId);
        setRiskFilter("all");
        setLandFilter("all");
        setPage(1);
        setTargetPoleId(poleId);
    }

    return <>
        <section className="hero-panel engineer-hero">
            <span className="eyebrow">{viewLabel}</span>
            <h2>Pole-Level Technical Analytics</h2>
            <p>Map-first risk triage with feeder ranking, live Dataverse pole markers and work-order-ready actions.</p>
            <div className="pill-row"><span>Esri Satellite default</span><span>Risk-layer filtering</span><span>Pole marker numbers</span></div>
        </section>
        {!isLoading && !error && poles.length > 0 && <section className="risk-insights" aria-label="Risk overview"><div className="risk-summary-cards">
            {riskLevels.map((category) => <article className={`risk-summary-card risk-${category.toLowerCase()}`} key={category}><span>{category}</span><strong>{riskSummary[category]}</strong><small>poles</small></article>)}
        </div></section>}
        {!isLoading && !error && poles.length > 0 && <GeospatialAnalysis poles={poles} onSelectPole={openPoleRecord} onViewDetails={setSelectedPole} />}
        {hierarchyMode ? <EngineerHierarchyTable poles={poles} isLoading={isLoading} error={error} targetRequest={hierarchyTarget} /> : <section className="engineer-panel" id="pole-risk-records">
            <div className="engineer-heading"><div><h3>Dataverse Pole Risk Records</h3><p>Review pole coordinates, feeder context and the final AI vegetation-risk assessment.</p></div><span className="data-tag">{`${poles.length} live records`}</span></div>
            {isLoading ? <p className="loading">Loading Dataverse records…</p> : error ? <p className="loading">{error}</p> : poles.length === 0 ? <p className="loading">No Dataverse records found.</p> : <>
                <div className="table-controls">
                    <label className="pole-search">SEARCH POLES<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pole ID, Feeder ID, or Street Name" type="search" /></label>
                    <label>RISK CATEGORY<select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="all">All categories</option>{riskCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                    <label>LAND COVER TYPE<select value={landFilter} onChange={(event) => setLandFilter(event.target.value)}><option value="all">All land types</option>{landTypes.map((landType) => <option key={landType} value={landType}>{landType}</option>)}</select></label>
                    <button className="reset-filters-button" type="button" onClick={resetFilters} disabled={!hasActiveFilters} aria-label="Reset filters" title="Reset filters">
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M4 4v6h6M5.6 15a7 7 0 1 0 .7-7.9L4 10" /></svg>
                    </button>
                </div>


                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th scope="col">No.</th>
                                <SortableHeader label="Pole ID" sortKey="poleId" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                                <th>Feeder ID</th>
                                <th>Street Name</th>
                                <th>Latitude</th>
                                <th>Longitude</th>
                                <th>RVI</th>
                                <th>NDVI</th>
                                    <SortableHeader label="AI Risk Score" sortKey="riskScore" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                                    <SortableHeader label="Risk Category" sortKey="riskCategory" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} />
                                <th>Land Cover Type</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>{pageRows.map((pole, index) => { const category = riskLevel(pole);
                            return <tr id={engineerRowId(pole.poleId)} tabIndex={-1} key={`${pole.poleId ?? "pole"}-${index}`}>
                            <td>{(page - 1) * pageSize + index + 1}</td>
                            <td>{pole.poleId ?? "—"}</td>
                            <td>{pole.feederId ?? "—"}</td>
                            <td>{pole.streetName ?? "—"}</td>
                            <td>{pole.latitude ?? "—"}</td>
                            <td>{pole.longitude ?? "—"}</td>
                            <td>{pole.rvi ?? "—"}</td>
                            <td>{pole.ndvi ?? "—"}</td>
                            <td className={`risk-score risk-${category.toLowerCase()}`}>{pole.finalAiRiskScore ?? "—"}</td>
                            <td>
                                <span className={`risk-category risk-${category.toLowerCase()}`}>{category}</span>
                            </td>
                            <td>
                                <span className="land-cover-type">{pole.landCoverType ?? "Unknown"}</span>
                            </td>
                            <td>
                                <div className="record-row-actions">
                                    <button className="record-map-button" type="button" onClick={() => openPoleMap(pole)}>Map</button>
                                    <button className="record-details-button" type="button" onClick={() => setSelectedPole(pole)}>Details</button>
                                </div>
                            </td>
                        </tr>; })}</tbody></table></div>
                        <div className="table-pagination">
                            <span>Showing {filteredPoles.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredPoles.length)} of {filteredPoles.length}</span>
                            <div>
                                <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>←</button>
                                <span>Page {page} of {totalPages}</span>
                                <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>→</button>
                            </div>
                        </div>
                    </>}
                </section>}
                {selectedPole && <PoleDetailsModal pole={selectedPole} onClose={() => setSelectedPole(null)} />}
            </>;
}

function SortableHeader({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
    const isActive = sortKey === activeKey;
    return <th><button className="sort-button" type="button" onClick={() => onSort(sortKey)}>{label} <span>{isActive ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button></th>;
}

export function PoleDetailsModal({ pole, onClose }: { pole: Pole; onClose: () => void }) {
    const category = riskLevel(pole);
    const openMap = () => window.open(`https://www.google.com/maps?q=${pole.latitude},${pole.longitude}`, "_blank", "noopener,noreferrer");
    return <div className="pole-modal-backdrop" role="presentation" onMouseDown={onClose}>
        <section className="pole-modal" role="dialog" aria-modal="true" aria-label={`Details for ${pole.poleId ?? "pole"}`} onMouseDown={(event) => event.stopPropagation()}>
            <button className="pole-modal-close" type="button" onClick={onClose} aria-label="Close details">×</button>
            <span className="pole-modal-caption">Pole intelligence</span><h3>{pole.poleId ?? "Unnamed pole"}</h3>
            <div className="pole-modal-summary">
                <article><span>Final AI risk score</span><strong>{display(pole.finalAiRiskScore)}</strong><b className={`modal-risk-${category.toLowerCase()}`}>{category}</b></article>
                <article><span>Satellite features</span><p>RVI: <b>{display(pole.rvi)}</b><br />NDVI: <b>{display(pole.ndvi)}</b><br />Density: <b>{display(pole.vegetationDensity)}</b><br />Cloud score: <b>{display(pole.cloudScore)}</b><br />RVI trend: <b>{display(pole.rviTrend3m)}</b><br />NDVI trend: <b>{display(pole.ndviTrend3m)}</b></p></article>
                <article><span>Recommended action</span><p>{display(pole.action)}</p></article>
            </div>
            <article className="pole-reason"><span>Why AI flagged this pole</span><p>{display(pole.riskReason)}</p></article>
            <dl className="pole-detail-grid">
                <Detail label="Feeder" value={pole.feederId} />
                <Detail label="Zone / street" value={pole.streetName} />
                <Detail label="Coordinates" value={`${display(pole.latitude)}, ${display(pole.longitude)}`} />
                <Detail label="Line type" value={pole.lineType} />
                <Detail label="Last prune" value={formatDate(pole.lastPruneDate)} />
                <Detail label="Outage count 12M" value={pole.outageCount12m} />
                <Detail label="Land cover" value={pole.landCoverType} />
                <Detail label="Operational category" value={pole.operationalRiskCategory} />
                <Detail label="AI risk group" value={pole.aiRiskGroup} />
                <Detail label="AI risk score" value={pole.aiRiskScore} />
                <Detail label="Work-order status" value={pole.workOrderStatus} />
                <Detail label="AI validation" value={pole.aiValidation} />
                <Detail label="Modified on" value={formatDate(pole.modifiedOn)} />
            </dl>
            <div className="pole-modal-actions"><button type="button" onClick={openMap}>Open Google Maps</button></div>
        </section>
    </div>;
}

function Detail({ label, value }: { label: string; value?: string | number | null }) { return <div><dt>{label}</dt><dd>{display(value)}</dd></div>; }
function engineerRowId(poleId: string | null) { return `engineer-row-${(poleId ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`; }
function openPoleMap(pole: Pole) { window.open(`https://www.google.com/maps?q=${pole.latitude},${pole.longitude}`, "_blank", "noopener,noreferrer"); }
function display(value?: string | number | null) { return value === null || value === undefined || value === "" ? "—" : value; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }

function riskLevel(pole: Pole): RiskCategory {
    const category = pole.finalAiRiskCategory?.toString().trim().toUpperCase();
    if (riskLevels.includes(category as RiskCategory)) return category as RiskCategory;
    const score = riskScore(pole);
    return score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}

function riskScore(pole: Pole) { return Number(pole.finalAiRiskScore ?? -1); }
function uniqueValues(values: string[]) { return [...new Set(values)].sort((first, second) => first.localeCompare(second)); }

function comparePoles(first: Pole, second: Pole, key: SortKey, direction: SortDirection) {
    const values = key === "poleId" ? [(first.poleId ?? ""), (second.poleId ?? "")] : key === "riskCategory" ? [riskLevel(first), riskLevel(second)] : [riskScore(first), riskScore(second)];
    const comparison = typeof values[0] === "number" ? (values[0] as number) - (values[1] as number) : String(values[0]).localeCompare(String(values[1]));
    return direction === "asc" ? comparison : -comparison;
}

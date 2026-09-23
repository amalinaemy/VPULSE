import { useEffect, useMemo, useState } from "react";
import type { Pole, WorkFeedback } from "../services/api";
import { PoleDetailsModal } from "../pages/EngineerPage";

const levels = ["zone", "state", "subzone", "station", "substation", "streetName"] as const;
type Level = typeof levels[number];
type HierarchyPole = { pole: Pole } & Record<Level, string>;
type Selection = Partial<Record<Level, string>>;
type CandidateSort = "poleId" | "riskScore" | "riskCategory";
type SortDirection = "asc" | "desc";
const candidatePageSize = 20;

const levelLabels: Record<Level, string> = {
    zone: "Zone", state: "State", subzone: "Subzone", station: "Station",
    substation: "Substation", streetName: "Street Name",
};

const configuredValues: Partial<Record<Level, string[]>> = {
    zone: ["Utara", "Selatan", "Timur", "Barat", "Metro"],
    subzone: ["M1", "M2", "M3"],
};

export function EngineerHierarchyTable({ workFeedback, poles, isLoading, error, targetRequest }: { workFeedback: WorkFeedback[]; poles: Pole[]; isLoading: boolean; error: string | null; targetRequest?: { pole: Pole; request: number } | null }) {
    const [selection, setSelection] = useState<Selection>({});
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const [poleSearch, setPoleSearch] = useState("");
    const [riskFilters, setRiskFilters] = useState<string[]>([]);
    const [landFilters, setLandFilters] = useState<string[]>([]);
    const hierarchyPoles = useMemo(() => poles.map(toHierarchyPole), [poles]);
    const riskCategories = useMemo(() => [...new Set(poles.map(riskLevel))].sort(), [poles]);
    const landTypes = useMemo(() => [...new Set(poles.map((pole) => pole.landCoverType ?? "Unknown"))].sort(), [poles]);
    const levelIndex = levels.findIndex((level) => !selection[level]);
    const currentLevel = levelIndex === -1 ? null : levels[levelIndex];
    const isSearching = poleSearch.trim().length > 0;
    const matchingPoles = hierarchyPoles
        .filter((item) => levels.every((level) => !selection[level] || item[level] === selection[level]))
        .filter((item) => !poleSearch.trim() || (item.pole.poleId ?? "").toLowerCase().includes(poleSearch.trim().toLowerCase()))
        .filter((item) => riskFilters.length === 0 || riskFilters.includes(riskLevel(item.pole)))
        .filter((item) => landFilters.length === 0 || landFilters.includes(item.pole.landCoverType ?? "Unknown"));
    const values = currentLevel ? hierarchyValues(currentLevel, matchingPoles) : [];
    const breadcrumbSelection: Selection = { ...selection };
    if (isSearching && matchingPoles.length > 0) {
        for (const level of levels) {
            const value = matchingPoles[0][level];
            if (!matchingPoles.every((item) => item[level] === value)) break;
            breadcrumbSelection[level] = value;
        }
    }


    useEffect(() => {
        if (!targetRequest) return;
        const item = toHierarchyPole(targetRequest.pole);
        setSelection({ zone: item.zone, state: item.state, subzone: item.subzone, station: item.station, substation: item.substation, streetName: item.streetName });
        setPoleSearch(item.pole.poleId?.trim() ?? "");
        setRiskFilters([]);
        setLandFilters([]);
        document.getElementById("pole-risk-records")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [targetRequest]);

    function choose(level: Level, value: string) {
        const index = levels.indexOf(level);
        const next: Selection = {};
        levels.slice(0, index).forEach((previous) => { if (breadcrumbSelection[previous]) next[previous] = breadcrumbSelection[previous]; });
        next[level] = value;
        setSelection(next);
        setPoleSearch("");
    }

    function goBack() {
        const selectedLevels = levels.filter((level) => breadcrumbSelection[level]);
        const last = selectedLevels.at(-1);
        if (!last) return;
        const next = { ...breadcrumbSelection };
        delete next[last];
        setSelection(next);
        setPoleSearch("");
    }

    async function exportHierarchyWorkbook() {
        const XLSX = await import("xlsx");
        const grouped = new Map<string, HierarchyPole[]>();
        matchingPoles.forEach((item) => {
            const key = levels.map((level) => item[level]).join("\u0000");
            grouped.set(key, [...(grouped.get(key) ?? []), item]);
        });
        const hierarchyRows = [...grouped.values()].map((items) => {
            const first = items[0];
            return {
                "Zone": first.zone,
                "State": first.state,
                "Subzone": first.subzone,
                "Station": first.station,
                "Substation": first.substation,
                "Street Name": first.streetName,
                "Candidate Count": items.length,
                "Critical Count": items.filter((item) => riskLevel(item.pole) === "CRITICAL").length,
                "High Count": items.filter((item) => riskLevel(item.pole) === "HIGH").length,
                "Highest Risk Score": Math.max(...items.map((item) => Number(item.pole.finalAiRiskScore ?? -1))),
            };
        });
        const candidateRows = matchingPoles
            .map((item) => item.pole)
            .sort((first, second) => Number(second.finalAiRiskScore ?? -1) - Number(first.finalAiRiskScore ?? -1))
            .map((pole, index) => ({
                "No.": index + 1,
                "Pole ID": pole.poleId ?? "",
                "Feeder ID": pole.feederId ?? "",
                "Street Name": pole.streetName ?? "",
                "Latitude": pole.latitude ?? "",
                "Longitude": pole.longitude ?? "",
                "RVI": pole.rvi ?? "",
                "NDVI": pole.ndvi ?? "",
                "AI Risk Score": pole.finalAiRiskScore ?? "",
                "Risk Category": riskLevel(pole),
                "Land Cover Type": pole.landCoverType ?? "Unknown",
                "Recommended Action": pole.action ?? "",
            }));
        const hierarchySheet = XLSX.utils.json_to_sheet(hierarchyRows);
        hierarchySheet["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 20 }];
        const candidateSheet = XLSX.utils.json_to_sheet(candidateRows);
        candidateSheet["!cols"] = [{ wch: 7 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 17 }, { wch: 24 }, { wch: 42 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, hierarchySheet, "Hierarchy Details");
        XLSX.utils.book_append_sheet(workbook, candidateSheet, "Candidate List");
        XLSX.writeFile(workbook, `engineer-candidates-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
    }

    return <section className="engineer-panel hierarchy-panel" id="pole-risk-records">
        <div className="engineer-heading"><div><span className="hierarchy-kicker">Network hierarchy</span><h3>{isSearching ? "Pole search results" : currentLevel ? `Select ${levelLabels[currentLevel]}` : `${selection.streetName} Pole Candidates`}</h3><p>{isSearching ? "Matching pole records are shown below. Clear the search to return to the network hierarchy." : "Search a pole ID to view records directly, or drill down through the network hierarchy."}</p></div><div className="hierarchy-heading-actions"><button className="export-work-orders-button" type="button" onClick={exportHierarchyWorkbook} disabled={matchingPoles.length === 0}>Export Excel</button><span className="data-tag">{matchingPoles.length} records</span></div></div>
        <div className="hierarchy-navigation-row">
            <nav className="hierarchy-breadcrumbs" aria-label="Hierarchy path">
                <button type="button" onClick={() => { setSelection({}); setPoleSearch(""); }}>All records</button>
                {levels.filter((level) => breadcrumbSelection[level]).map((level) => <span key={level}>› <button type="button" title={levelLabels[level]} onClick={() => choose(level, breadcrumbSelection[level]!)}>{breadcrumbSelection[level]}</button></span>)}
            </nav>
            {(Object.keys(breadcrumbSelection).length > 0) && <button className="hierarchy-back" type="button" onClick={goBack}>← Back</button>}
        </div>
        <div className="table-controls hierarchy-controls">
            <label className="pole-search">SEARCH POLE ID<input value={poleSearch} onChange={(event) => setPoleSearch(event.target.value)} placeholder="Enter Pole ID" type="search" /></label>
            <MultiSelect label="RISK CATEGORY" allLabel="All categories" options={riskCategories} selected={riskFilters} onChange={setRiskFilters} />
            <MultiSelect label="LAND COVER TYPE" allLabel="All land types" options={landTypes} selected={landFilters} onChange={setLandFilters} />
            <button className="reset-filters-button" type="button" onClick={() => { setPoleSearch(""); setRiskFilters([]); setLandFilters([]); }} disabled={!poleSearch.trim() && riskFilters.length === 0 && landFilters.length === 0} aria-label="Reset filters" title="Reset filters"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M4 4v6h6M5.6 15a7 7 0 1 0 .7-7.9L4 10" /></svg></button>
        </div>
        <p className="hierarchy-data-note">Browse records by Zone → State → Subzone → Station → Substation → Street Name. Missing zone, state or station values appear as Unassigned. Subzone currently defaults to M1; substation uses feeder data when unavailable.</p>
        {isLoading ? <p className="loading">Loading hierarchy…</p> : error ? <p className="loading">{error}</p> : currentLevel && !isSearching ? <HierarchyLevelTable level={currentLevel} values={values} poles={matchingPoles} onChoose={choose} /> : <CandidateTable rows={matchingPoles} onDetails={setSelectedPole} focusPoleId={targetRequest?.pole.poleId ?? null} />}
        {selectedPole && <PoleDetailsModal workFeedback={workFeedback} pole={selectedPole} onClose={() => setSelectedPole(null)} />}
    </section>;
}

function MultiSelect({ label, allLabel, options, selected, onChange }: { label: string; allLabel: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
    const summary = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} selected`;
    function toggle(value: string) { onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]); }
    return <div className="hierarchy-multi-label"><span>{label}</span><details className="hierarchy-multi-select"><summary>{summary}</summary><div className="hierarchy-multi-menu"><button type="button" className="multi-clear" onClick={() => onChange([])}>{allLabel}</button>{options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />{option}</label>)}</div></details></div>;
}

function HierarchyLevelTable({ level, values, poles, onChoose }: { level: Level; values: string[]; poles: HierarchyPole[]; onChoose: (level: Level, value: string) => void }) {
    return <div className="table-wrap hierarchy-table"><table><thead><tr><th>{levelLabels[level]}</th><th>Records</th><th>Critical</th><th>High</th><th>Highest Risk Score</th><th>Open</th></tr></thead><tbody>{values.map((value) => {
        const rows = poles.filter((item) => item[level] === value);
        const scores = rows.map((item) => Number(item.pole.finalAiRiskScore ?? -1));
        return <tr key={value}><td><button className="hierarchy-value-button" type="button" onClick={() => onChoose(level, value)} disabled={rows.length === 0}>{value}</button></td><td>{rows.length}</td><td>{rows.filter((item) => riskLevel(item.pole) === "CRITICAL").length}</td><td>{rows.filter((item) => riskLevel(item.pole) === "HIGH").length}</td><td>{rows.length ? Math.max(...scores) : "—"}</td><td><button className="hierarchy-open-button" type="button" onClick={() => onChoose(level, value)} disabled={rows.length === 0}>View →</button></td></tr>;
    })}</tbody></table></div>;
}

function CandidateTable({ rows, onDetails, focusPoleId }: { rows: HierarchyPole[]; onDetails: (pole: Pole) => void; focusPoleId: string | null }) {
    const [sortKey, setSortKey] = useState<CandidateSort>("riskScore");
    const [direction, setDirection] = useState<SortDirection>("desc");
    const [page, setPage] = useState(1);
    const sortedRows = useMemo(() => [...rows].sort((first, second) => compareCandidates(first.pole, second.pole, sortKey, direction)), [rows, sortKey, direction]);
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / candidatePageSize));
    const pageRows = sortedRows.slice((page - 1) * candidatePageSize, page * candidatePageSize);
    useEffect(() => setPage(1), [rows, sortKey, direction]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
    useEffect(() => {
        if (!focusPoleId) return;
        const row = document.getElementById(hierarchyRowId(focusPoleId));
        if (!row) return;
        row.focus({ preventScroll: true });
    }, [focusPoleId, pageRows]);

    function toggleSort(key: CandidateSort) {
        if (key === sortKey) setDirection((current) => current === "asc" ? "desc" : "asc");
        else { setSortKey(key); setDirection(key === "poleId" ? "asc" : "desc"); }
    }

    return <><div className="table-wrap hierarchy-table"><table><thead><tr><th>No.</th><CandidateSortHeader label="Pole ID" sortKey="poleId" activeKey={sortKey} direction={direction} onSort={toggleSort} /><th>Feeder ID</th><th>Street Name</th><th>Latitude</th><th>Longitude</th><th>RVI</th><th>NDVI</th><CandidateSortHeader label="AI Risk Score" sortKey="riskScore" activeKey={sortKey} direction={direction} onSort={toggleSort} /><CandidateSortHeader label="Risk Category" sortKey="riskCategory" activeKey={sortKey} direction={direction} onSort={toggleSort} /><th>Land Cover Type</th><th>Actions</th></tr></thead><tbody>{pageRows.map(({ pole }, index) => { const category = riskLevel(pole); return <tr id={hierarchyRowId(pole.poleId)} tabIndex={-1} key={`${pole.poleId ?? "pole"}-${index}`}><td>{(page - 1) * candidatePageSize + index + 1}</td><td>{pole.poleId ?? "—"}</td><td>{pole.feederId ?? "—"}</td><td>{pole.streetName ?? "—"}</td><td>{pole.latitude ?? "—"}</td><td>{pole.longitude ?? "—"}</td><td>{pole.rvi ?? "—"}</td><td>{pole.ndvi ?? "—"}</td><td className={`risk-score risk-${category.toLowerCase()}`}>{pole.finalAiRiskScore ?? "—"}</td><td><span className={`risk-category risk-${category.toLowerCase()}`}>{category}</span></td><td>{pole.landCoverType ?? "Unknown"}</td><td><div className="record-row-actions"><button className="record-map-button" type="button" onClick={() => openMap(pole)}>Map</button><button className="record-details-button" type="button" onClick={() => onDetails(pole)}>Details</button></div></td></tr>; })}</tbody></table></div><div className="table-pagination"><span>Showing {sortedRows.length === 0 ? 0 : (page - 1) * candidatePageSize + 1}–{Math.min(page * candidatePageSize, sortedRows.length)} of {sortedRows.length}</span><div><button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>←</button><span>Page {page} of {totalPages}</span><button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>→</button></div></div></>;
}

function CandidateSortHeader({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: CandidateSort; activeKey: CandidateSort; direction: SortDirection; onSort: (key: CandidateSort) => void }) { const active = sortKey === activeKey; return <th><button className="sort-button" type="button" onClick={() => onSort(sortKey)}>{label} <span>{active ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button></th>; }

function toHierarchyPole(pole: Pole): HierarchyPole {
    const feeder = pole.feederId?.trim() || "Unassigned";
    const rawZone = pole.zone?.trim() || "Unassigned";
    const zone = configuredValues.zone?.find((value) => value.toUpperCase() === rawZone.toUpperCase()) ?? rawZone.toUpperCase();
    return { pole, zone: rawZone === "Unassigned" ? rawZone : zone, state: pole.state?.trim().toUpperCase() || "Unassigned", subzone: pole.subzone?.trim() || "M1", station: pole.station?.trim() || "Unassigned", substation: pole.substation?.trim() || feeder, streetName: pole.streetName?.trim() || "Unknown Street" };
}

function hierarchyValues(level: Level, poles: HierarchyPole[]) {
    const configured = configuredValues[level] ?? [];
    return [...new Set([...configured, ...poles.map((item) => item[level]).sort((first, second) => first.localeCompare(second))])];
}

function riskLevel(pole: Pole) { const category = pole.finalAiRiskCategory?.trim().toUpperCase(); if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(category ?? "")) return category!; const score = Number(pole.finalAiRiskScore ?? -1); return score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW"; }
function hierarchyRowId(poleId: string | null) { return `hierarchy-row-${(poleId ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`; }
function compareCandidates(first: Pole, second: Pole, key: CandidateSort, direction: SortDirection) { const values = key === "poleId" ? [first.poleId ?? "", second.poleId ?? ""] : key === "riskCategory" ? [riskLevel(first), riskLevel(second)] : [Number(first.finalAiRiskScore ?? -1), Number(second.finalAiRiskScore ?? -1)]; const result = typeof values[0] === "number" ? (values[0] as number) - (values[1] as number) : String(values[0]).localeCompare(String(values[1])); return direction === "asc" ? result : -result; }
function openMap(pole: Pole) { window.open(`https://www.google.com/maps?q=${pole.latitude},${pole.longitude}`, "_blank", "noopener,noreferrer"); }

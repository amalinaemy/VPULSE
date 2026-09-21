import { CriticalityPie } from "../components/executive/ExecutiveCharts";
import { useMemo, useState } from "react";
import type { Pole, WorkFeedback } from "../services/api";
import { trimmingWorkStatus } from "../services/trimmingWork";
import "./ExecutivePage.css";

const risks = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
const statuses = ["Completed", "In Progress", "Not Started", "Pending"];
const colors = ["#ed6477", "#efa94c", "#53b6ed", "#51cba0", "#8896b3"];
const locationFields = ["state", "zone", "subzone", "station", "substation", "feederId"] as const;
const labels = ["State", "Zone", "Subzone", "Station", "Substation", "Feeder"];
const valueOf = (value: string | null | undefined) => value?.trim() || "Unassigned";

function riskOf(pole: Pole) {
    const category = pole.finalAiRiskCategory?.trim().toUpperCase();
    if (category && risks.includes(category)) return category;
    const score = pole.finalAiRiskScore;
    return score == null || !Number.isFinite(score) ? "UNKNOWN" : score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}

export function ExecutivePage({ poles, workFeedback, isLoading, error, feedbackLoading, feedbackError }: {
    poles: Pole[]; workFeedback: WorkFeedback[]; isLoading: boolean; error: string | null;
    feedbackLoading: boolean; feedbackError: string | null;
}) {
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [search, setSearch] = useState("");
    const [groupBy, setGroupBy] = useState<typeof locationFields[number]>("feederId");
    const [page, setPage] = useState(1);
    const feedbackUnavailable = feedbackLoading || !!feedbackError;

    const rows = useMemo(() => {
        const feedback = new Map<string, WorkFeedback>();
        for (const item of workFeedback) {
            const id = item.poleId?.trim().toLowerCase();
            if (!id) continue;
            const previous = feedback.get(id);
            if (!previous || (Date.parse(item.modifiedOn ?? "") || 0) > (Date.parse(previous.modifiedOn ?? "") || 0)) feedback.set(id, item);
        }
        return poles.map(pole => ({ pole, risk: riskOf(pole), status: trimmingWorkStatus(feedback.get(pole.poleId?.trim().toLowerCase() ?? "")?.trimmingWork ?? undefined) }));
    }, [poles, workFeedback]);

    const filtered = rows.filter(row => locationFields.every(field => !filters[field] || valueOf(row.pole[field]) === filters[field])
        && (!filters.risk || row.risk === filters.risk)
        && (feedbackUnavailable || !filters.status || row.status === filters.status)
        && [row.pole.poleId, row.pole.feederId, row.pole.streetName].some(value => (value ?? "").toLowerCase().includes(search.trim().toLowerCase())));

    const priority = filtered.filter(row => ["CRITICAL", "HIGH"].includes(row.risk));
    const completed = priority.filter(row => row.status === "Completed").length;
    const percent = priority.length ? Math.round(completed / priority.length * 100) : 0;

    const riskCounts = risks.map((label, index) =>
        ({ label, count: filtered.filter(row => row.risk === label).length, color: colors[index] })
    );

    const groups = new Map<string, number>();
    filtered.forEach(({ pole }) => groups.set(valueOf(pole[groupBy]), (groups.get(valueOf(pole[groupBy])) ?? 0) + 1));

    const bars = [...groups].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([label, count]) => ({ label, count, color: "#53b6ed" }));

    const packs = new Map<string, { location: string; feeder: string; total: number; completed: number; active: number; pending: number }>();
    priority.forEach(({ pole, status }) => {
        const path = locationFields.map(field => valueOf(pole[field]));
        const key = JSON.stringify(path);
        const pack = packs.get(key) ?? { location: path.slice(0, -1).join(" / "), feeder: path[5], total: 0, completed: 0, active: 0, pending: 0 };
        pack.total++; if (status === "Completed") pack.completed++; else if (status === "In Progress") pack.active++; else pack.pending++;
        packs.set(key, pack);
    });

    const packRows = [...packs.entries()].sort((a, b) => b[1].total - a[1].total);
    const pages = Math.max(1, Math.ceil(packRows.length / 10));
    const currentPage = Math.min(page, pages);


    function update(key: string, value: string) { setFilters(current => ({ ...current, [key]: value })); setPage(1); }
    return <div className="executive-dashboard">

        <section className="hero-panel">
            <span className="eyebrow">Executive View</span>
            <h2>Management Overview</h2>
            <p>Candidate pole exposure, priority work packs and trimming progress across the network.</p>
        </section>

        {isLoading ? <p role="status">Loading executive data…</p> : error ? <p role="alert">Unable to load candidate poles: {error}</p> : <>
            {feedbackUnavailable && <p role="status">{feedbackLoading ? "Loading trimming progress…" : `Trimming progress unavailable: ${feedbackError}`}</p>}

            <section className="metrics executive-metrics">
                <Metric label="Candidate poles" value={filtered.length} note="Poles in the selected scope" />
                <Metric label="Critical poles" value={riskCounts[0].count} note="Highest priority exposure" />
                <Metric label="Work-pack groups" value={packs.size} note="Critical + High poles grouped by feeder" />
                <Metric label="Trimming remaining" value={feedbackUnavailable ? "—" : priority.length - completed} note="Critical + High poles not completed" />
                <Metric label="Work completed" value={feedbackUnavailable ? "—" : `${percent}%`} note={feedbackUnavailable ? "Awaiting trimming feedback" : `${completed} of ${priority.length} priority poles`} />
            </section>

            <section className="executive-filters" aria-label="Executive dashboard filters">
                <label>Search
                    <input type="search" placeholder="Pole, Feeder or Street" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
                </label>

                {locationFields.map((field, index) => !["subzone", "station", "substation"].includes(field) &&
                    <label key={field}>{labels[index]}
                        <select value={filters[field] ?? ""} onChange={event => update(field, event.target.value)}>
                            <option value="">All {labels[index].toLowerCase()}s</option>
                            {[...new Set(poles.map(pole => valueOf(pole[field])))].sort().map(value =>
                                <option key={value}>{value}</option>)}</select>
                    </label>)}

                <label>Criticality
                    <select value={filters.risk ?? ""} onChange={event => update("risk", event.target.value)}>
                        <option value="">All levels</option>{risks.map(risk =>
                            <option key={risk}>{risk}</option>)}
                    </select>
                </label>

                <label>Trimming progress
                    <select disabled={feedbackUnavailable} value={filters.status ?? ""} onChange={event => update("status", event.target.value)}>
                        <option value="">All statuses</option>
                        {statuses.map(status =>
                            <option key={status}>{status}</option>)}
                    </select>
                </label>

                <button className="executive-reset"
                    type="button"
                    aria-label="Reset filters"
                    title="Reset filters"
                    onClick={() => { setFilters({}); setSearch(""); setPage(1); }}>
                    <svg aria-hidden="true"
                        viewBox="0 0 24 24" width="18"
                        height="18" fill="none" stroke="currentColor"
                        strokeWidth="1.8" strokeLinecap="round"
                        strokeLinejoin="round"><path d="M4 4v6h6M5.6 15a7 7 0 1 0 .7-7.9L4 10" /></svg>
                </button>
            </section>

            <p className="executive-caption" aria-live="polite">Showing {filtered.length.toLocaleString()} of {poles.length.toLocaleString()} candidate poles.</p>
            {filtered.length === 0 ? <p className="executive-card">No poles match these filters. Reset filters to see the full portfolio.</p> : <>

                <section className="executive-charts">
                    <article className="executive-card">
                        <h3>Poles Criticality</h3>
                        <p>Risk distribution across selected poles</p><CriticalityPie items={riskCounts} /></article>

                    <article className="executive-card">
                        <div className="executive-chart-heading">
                            <h3>Poles By Location</h3>
                            <label>Group by
                                <select value={groupBy}
                                    onChange={event => setGroupBy(event.target.value as typeof groupBy)}>{locationFields.map((field, index) =>
                                        <option key={field} value={field}>{labels[index]}</option>)}
                                </select>
                            </label>
                        </div>
                        <p>Top 10 locations by candidate count · {groups.size} locations total</p>
                        <Bars items={bars} />
                    </article>

                    <article className="executive-card">
                        <h3>Trimming Progress</h3>
                        <p>Critical + High priority work</p>
                        {feedbackUnavailable ? <p>Progress data unavailable.</p> : <>
                            <progress max={100} value={percent} aria-label="Priority work completed" />
                            <p>
                                <strong>{percent}% completed</strong> · {priority.length - completed} poles remaining</p>
                            <Bars items={statuses.map((label, index) =>
                            ({
                                label, count: priority.filter(row => row.status === label).length, color: ["#51cba0", "#53b6ed", "#efa94c", "#8896b3"][index]

                            }))} /></>}
                    </article>
                </section>

                <section className="executive-card">
                    <h3>Work Packs & Progress</h3>
                    <p>Derived from the Field Team work pack: Critical + High poles grouped by location and feeder.</p>
                    <div className="executive-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Location</th>
                                    <th>Poles</th>
                                    <th>Completed</th>
                                    <th>In progress</th>
                                    <th>Pending / Not Started</th>
                                    <th>Completion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {packRows.slice((currentPage - 1) * 10, currentPage * 10).map(([key, pack]) => <tr key={key}>
                                    <td>
                                        <strong>{pack.feeder}</strong>
                                        <small>{pack.location}</small>
                                    </td>
                                    <td>{pack.total}</td>
                                    <td>{feedbackUnavailable ? "—" : pack.completed}</td>
                                    <td>{feedbackUnavailable ? "—" : pack.active}</td>
                                    <td>{feedbackUnavailable ? "—" : pack.pending}</td>
                                    <td>{feedbackUnavailable ? "—" : <><progress
                                        aria-label={`${pack.feeder} completion`}
                                        max={pack.total}
                                        value={pack.completed} />
                                        {Math.round(pack.completed / pack.total * 100)}%</>}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                    {!packs.size && <p>No Critical or High poles in this selection.</p>}
                    <div className="executive-pagination">
                        <span>{packs.size} work-pack groups · Page {currentPage} of {pages}</span>
                        <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                        <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button>
                    </div>
                </section>
            </>}
            <p className="executive-caption">Trimming workload follows the existing Field Team priority rule (Critical + High),
                site validation confirms the required action.</p>
        </>}
    </div>;
}
function Metric({ label, value, note }:
    { label: string; value: string | number; note: string }) {
    return <article className="metric">
        <span>{label}</span>
        <strong className="blue">{typeof value === "number" ? value.toLocaleString() : value}</strong>
        <p>{note}</p></article>;
}

function Bars({ items }: { items: { label: string; count: number; color: string }[] }) {
    const max = Math.max(1, ...items.map(item => item.count));
    return <ul className="executive-bars">
        {items.map(item => <li key={item.label}>
            <div>
                <span>{item.label}</span>
                <strong>{item.count.toLocaleString()}</strong>
            </div>
            <div className="executive-bar-track" aria-hidden="true">
                <span style={{ width: `${item.count / max * 100}%`, background: item.color }} />
            </div>
        </li>)}
    </ul>;
}


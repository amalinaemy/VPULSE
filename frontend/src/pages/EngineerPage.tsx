import { StateFilter } from "../components/StateFilter";
import { useStateFilter } from "../services/useStateFilter";
import { poleTrimmingStatus } from "../services/trimmingWork";
import { useMemo, useState } from "react";
import type { Pole, WorkFeedback } from "../services/api";
import { GeospatialAnalysis } from "../components/GeospatialAnalysis";
import { EngineerHierarchyTable } from "../components/EngineerHierarchyTable";

const riskLevels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type RiskCategory = typeof riskLevels[number];

export function EngineerPage({ poles: allPoles, workFeedback, isLoading, error }: { poles: Pole[]; workFeedback: WorkFeedback[]; isLoading: boolean; error: string | null }) {
    const { poles, states, selection, setSelection } = useStateFilter(allPoles);
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const [hierarchyTarget, setHierarchyTarget] = useState<{ pole: Pole; request: number } | null>(null);

    const riskSummary = useMemo(() => {
        const counts: Record<RiskCategory, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        poles.forEach((pole) => { counts[riskLevel(pole)] += 1; });
        return counts;
    }, [poles]);

    function openPoleRecord(pole: Pole) {
        if (!pole.poleId?.trim()) return;
        setHierarchyTarget({ pole, request: Date.now() });
    }

    return <>
        <section className="hero-panel engineer-hero">
            <span className="eyebrow">Engineer View</span>
            <h2>Pole-Level Technical Analytics</h2>
            <p>Map-first risk triage with feeder ranking, live Dataverse pole markers and work-order-ready actions.</p>
            <div className="pill-row"><span>Esri Satellite default</span><span>Risk-layer filtering</span></div>
        </section>
        <StateFilter states={states} selection={selection} count={poles.length} onChange={value => { setSelection(value); setSelectedPole(null); setHierarchyTarget(null); }} />
        {!isLoading && !error && poles.length > 0 && <section className="risk-insights" aria-label="Risk overview"><div className="risk-summary-cards">
            {riskLevels.map((category) => <article className={`risk-summary-card risk-${category.toLowerCase()}`} key={category}><span>{category}</span><strong>{riskSummary[category]}</strong><small>poles</small></article>)}
        </div></section>}
        {!isLoading && !error && poles.length > 0 && <GeospatialAnalysis poles={poles} onSelectPole={openPoleRecord} onViewDetails={setSelectedPole} />}
        {!isLoading && !error && poles.length === 0 && <p role="status">No poles match the selected states.</p>}
        <EngineerHierarchyTable workFeedback={workFeedback} poles={poles} isLoading={isLoading} error={error} targetRequest={hierarchyTarget} />
                {selectedPole && <PoleDetailsModal workFeedback={workFeedback} pole={selectedPole} onClose={() => setSelectedPole(null)} />}
            </>;
}

export function PoleDetailsModal({ pole, workFeedback, onClose }: { pole: Pole; workFeedback: WorkFeedback[]; onClose: () => void }) {
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
                <Detail label="Zone" value={pole.zone} />
                <Detail label="State" value={pole.state} />
                <Detail label="Feeder" value={pole.feederId} />
                <Detail label="Street name" value={pole.streetName} />
                <Detail label="Coordinates" value={`${display(pole.latitude)}, ${display(pole.longitude)}`} />
                <Detail label="Line type" value={pole.lineType} />
                <Detail label="Last prune" value={formatDate(pole.lastPruneDate)} />
                <Detail label="Outage count 12M" value={pole.outageCount12m} />
                <Detail label="Land cover" value={pole.landCoverType} />
                <Detail label="Operational category" value={pole.operationalRiskCategory} />
                <Detail label="AI risk group" value={pole.aiRiskGroup} />
                <Detail label="AI risk score" value={pole.aiRiskScore} />
                <Detail label="Trimming work status" value={poleTrimmingStatus(pole.poleId, workFeedback)} />
                <Detail label="AI validation" value={pole.aiValidation} />
                <Detail label="Modified on" value={formatDate(pole.modifiedOn)} />
            </dl>
            <div className="pole-modal-actions"><button type="button" onClick={openMap}>Open Google Maps</button></div>
        </section>
    </div>;
}

function Detail({ label, value }: { label: string; value?: string | number | null }) { return <div><dt>{label}</dt><dd>{display(value)}</dd></div>; }
function display(value?: string | number | null) { return value === null || value === undefined || value === "" ? "—" : value; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }

function riskLevel(pole: Pole): RiskCategory {
    const category = pole.finalAiRiskCategory?.toString().trim().toUpperCase();
    if (riskLevels.includes(category as RiskCategory)) return category as RiskCategory;
    const score = riskScore(pole);
    return score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}

function riskScore(pole: Pole) { return Number(pole.finalAiRiskScore ?? -1); }

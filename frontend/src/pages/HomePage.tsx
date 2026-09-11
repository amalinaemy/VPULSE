import type { View } from "../types/view";
import type { Pole } from "../services/api";

type HomePageProps = {
    onNavigate: (view: View) => void;
    poles: Pole[];
    isLoading: boolean;
    error: string | null;
};

export function HomePage({ onNavigate, poles, isLoading, error }: HomePageProps) {
    const mostCriticalPole = poles.reduce<Pole | null>((highest, pole) => {
        if (pole.finalAiRiskScore == null) return highest;
        if (highest?.finalAiRiskScore == null) return pole;
        return pole.finalAiRiskScore > highest.finalAiRiskScore ? pole : highest;
    }, null);

    const poleId = mostCriticalPole?.poleId ?? "—";
    const riskScore = mostCriticalPole?.finalAiRiskScore ?? "—";
    const status = isLoading
        ? "Loading live risk data"
        : error
            ? "Live risk data unavailable"
            : mostCriticalPole
                ? `Prioritise Pole ${poleId}`
                : "No assessed poles";

    return <>
        <section className="home-hero">
            <div className="home-copy">
                <span className="home-eyebrow">● AI-driven distribution vegetation intelligence</span>
                <h1>See vegetation risk before it becomes a network event.</h1>
                <p>V-PULSE combines satellite imagery, geospatial asset data and AI risk scoring to make overhead-line vegetation management prioritised and traceable.</p>
                <div className="home-actions">
                    <button type="button" onClick={() => onNavigate("engineer")}>
                        Enter Engineer View
                        </button>
                    <button className="outline-button" type="button" onClick={() => onNavigate("information")}>
                        Information</button>
                </div>
            </div>
            <div className="home-visual">
                <div className="signal-card">
                    <span>Live corridor intelligence</span>
                    <div>
                        <b>NDVI<br />{displayMetric(mostCriticalPole?.ndvi)}</b>
                        <b>RVI<br />{displayMetric(mostCriticalPole?.rvi)}</b>
                        <b>Trend<br />{displayTrend(mostCriticalPole)}</b>
                    </div>
                </div>
                <div className="priority-card">
                    <div className="priority-card-header">
                        <span>Recommended action</span>
                        {mostCriticalPole?.finalAiRiskCategory &&
                        <b className={`priority-risk-badge priority-risk-${mostCriticalPole.finalAiRiskCategory.toLowerCase()}`}>
                            {toTitleCase(mostCriticalPole.finalAiRiskCategory)}</b>}
                            </div>
            <strong>{status}</strong>
            <p>
                <b>Risk score<br />
                    <em>{riskScore}</em>
                </b>
                <b>Action<br />
                <em>{actionWindow(mostCriticalPole)}</em>
                </b>
            </p>
            <button type="button" onClick={() => onNavigate("engineer")}>Open Critical Queue →</button>
            </div>
            </div>
        </section>
        <section className="home-views"><span className="home-eyebrow dark">Start with your role</span>
            <h2>One intelligence platform, three decision experiences.</h2>
            <div className="role-grid">
                <RoleCard label="Executive view" title="Understand portfolio exposure." onClick={() => onNavigate("executive")} /><RoleCard label="Engineer view" title="Investigate pole-level risk." onClick={() => onNavigate("engineer")} /><RoleCard label="Field team view" title="Execute the daily work pack." onClick={() => onNavigate("field")} /></div></section>
    </>;
}

function displayMetric(value: number | null | undefined) {
    return value == null ? "—" : value;
}

function displayTrend(pole: Pole | null) {
    const trend = pole?.ndviTrend3m ?? pole?.rviTrend3m;
    return trend == null || trend === "" ? "—" : trend;
}

function actionWindow(pole: Pole | null) {
    const category = pole?.finalAiRiskCategory?.toUpperCase();
    if (category === "CRITICAL") return "Immediate";
    if (category === "HIGH") return "Within 7 days";
    if (category === "MEDIUM") return "Within 30 days";
    if (category === "LOW") return "Monitor";
    return "—";
}

function toTitleCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function RoleCard({ label, title, onClick }: { label: string; title: string; onClick: () => void }) { return <button className="role-card" type="button" onClick={onClick}><span>{label}</span><strong>{title}</strong><i>Open view →</i></button>; }

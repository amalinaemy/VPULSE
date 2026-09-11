import type { OverviewView } from "../types/view";

const overview = { information:
    ["Platform information", "Vegetation Risk Command Layer", "One operating picture for management, engineering and field execution across LV overhead-line vegetation risk."],
    executive: ["Management overview", "Executive View", "Monitor network exposure, priority hotspots and mitigation progress across the vegetation risk programme."], 
    field: ["Field execution", "Field Team View", "Work-ready priorities, route context and pole coordinates for on-site inspection and clearance work."] } as const;

export function OverviewPage({ view, poleCount }: { view: OverviewView; poleCount: number }) { const [eyebrow, title, description] = overview[view]; 
    return <><section className="hero-panel"><span className="eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    <p>{description}</p>
    <div className="pill-row">
        <span>GIS pole fusion</span>
        <span>Sentinel feature scoring</span>
        <span>Work order ready</span>
        </div></section>
        <section className="metrics">
            <Metric label="Poles analysed" value={poleCount || "—"} note="GIS asset coordinates" />
            <Metric label="Satellite matched" value={poleCount || "—"} note="Pole ID with satellite features" accent="cyan" />
            <Metric label="Immediate hotspots" value="8" note="Risk score ≥ 80" accent="red" />
            <Metric label="Open work orders" value="35" note="Pending field action" accent="orange" />
        </section>
        <section className="view-cards">
            <article>
                <h3>Executive View</h3>
                <p>Management view for outage risk, cost avoidance, hotspots and work completion summary.</p>
            </article>
            <article>
                <h3>Engineer View</h3>
                <p>Technical view for candidate analysis, risk score, satellite features and feeder ranking.</p>
            </article>
            <article>
                <h3>Field Team View</h3>
                <p>Field execution view for work lists, navigation, site status and evidence feedback.</p>
            </article>
        </section>
    </>;
}

function Metric({ label, value, note, accent = "blue" }:
    { label: string; value: string | number; note: string; accent?: string }) 
    { return <article className="metric">
        <span>{label}</span>
        <strong className={accent}>{value}</strong>
        <p>{note}</p></article>; }

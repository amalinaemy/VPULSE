import { PowerAppsEmbed } from "../components/PowerAppsEmbed";

const powerAppsUrl = import.meta.env.VITE_POWER_APPS_URL?.trim();

export function WorkForm() {
    return (
        <section className="field-inspection-page">
            <section className="hero-panel field-inspection-hero">
                <div className="field-inspection-heading">
                    <div>
                        <span className="eyebrow">Work Digital Form</span>
                        <h2>Field Evidence and AI Validation</h2>
                        <p>Work feedback for inspection result, pruning evidence, risk severity and future model learning.</p>
                    </div>
                    <a
                        className={`power-app-open-button${powerAppsUrl ? "" : " is-disabled"}`}
                        href={powerAppsUrl || undefined}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={!powerAppsUrl}
                        onClick={(event) => { if (!powerAppsUrl) event.preventDefault(); }}
                    >
                        Open Full Screen
                    </a>
                </div>
            </section>

            <PowerAppsEmbed />
        </section>
    );
}

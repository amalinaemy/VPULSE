import type { View } from "../types/view";
import logoTnb from "../assets/logoTNB.png";

interface AppHeaderProps {
    activeView?: View;
    dataStatus: "loading" | "connected" | "error";
    recordCount: number;
    lastModifiedOn: string | null;
    theme: "dark" | "light";
    onThemeToggle: () => void;
}

export function AppHeader({ dataStatus, recordCount, lastModifiedOn, theme, onThemeToggle }: AppHeaderProps) {
    const recordSummary = lastModifiedOn
        ? `Last Refresh ${formatLastRefresh(lastModifiedOn)} · ${recordCount} Records`
        : `Last Refresh unavailable · ${recordCount} Records`;
    return <>
        <nav className="app-navbar" aria-label="Application controls">
            <div className="navbar-brand">
                <img src={logoTnb} alt="TNB" />
                <div className="navbar-brand-copy">
                    <strong>V-PULSE</strong>
                    <span>Vegetation Predictive Utility Line Satellite Analytics Engine</span>
                </div>
            </div>
            <div className="navbar-actions">
                <div className="connection" role="status"><span className={dataStatus === "connected" ? "live-dot" : dataStatus === "error" ? "offline-dot" : undefined} />{dataStatus === "loading" ? "Loading pole data…" : dataStatus === "error" ? "Pole data unavailable" : recordSummary}</div>
                <button className="theme-button" type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? "☀" : "☾"}</button>
                <button className="profile-button" type="button" aria-label="User profile"><span className="profile-avatar">NR</span></button>
            </div>
        </nav>
    </>;
}

function formatLastRefresh(value: string) {
    return new Intl.DateTimeFormat("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(new Date(value));
}

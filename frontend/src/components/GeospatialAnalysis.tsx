import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Pole } from "../services/api";

const categories = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type RiskCategory = typeof categories[number];

export function GeospatialAnalysis({ poles, showFeederRanking = true, onSelectPole, onViewDetails }: { poles: Pole[]; showFeederRanking?: boolean; onSelectPole?: (pole: Pole) => void; onViewDetails?: (pole: Pole) => void }) {
    const cardRef = useRef<HTMLElement>(null);
    const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const syncFullscreen = () => {
            setIsFullscreen(document.fullscreenElement === cardRef.current);
        };
        document.addEventListener("fullscreenchange", syncFullscreen);
        return () => document.removeEventListener("fullscreenchange", syncFullscreen);
    }, []);

    useEffect(() => {
        if (!isFullscreen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !document.fullscreenElement) {
                setIsFullscreen(false);
                fullscreenButtonRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [isFullscreen]);

    async function toggleFullscreen() {
        if (isFullscreen) {
            if (document.fullscreenElement === cardRef.current) await document.exitFullscreen();
            setIsFullscreen(false);
            fullscreenButtonRef.current?.focus();
        } else {
            try {
                await cardRef.current?.requestFullscreen();
            } catch {
                // viewport-filling view when browser fullscreen is unavailable.
            }
            setIsFullscreen(true);
        }
    }

    const [riskFilter, setRiskFilter] = useState<RiskCategory[]>([...categories]);
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const [selectedFeeder, setSelectedFeeder] = useState<string | null>(null);
    const feederRanking = useMemo(() => rankFeeders(poles), [poles]);
    // Offer every substation, including those outside the top-five priority ranking.
    const substations = useMemo(() => [...new Set(poles.map(substationName))].sort((a, b) => a.localeCompare(b)), [poles]);
    const activeFeeder = selectedFeeder !== null && substations.includes(selectedFeeder) ? selectedFeeder : null;
    const mapPoles = useMemo(() => poles
        .filter(hasCoordinates)
        .filter((pole) => activeFeeder === null || substationName(pole) === activeFeeder)
        .filter((pole) => riskFilter.includes(riskLevel(pole))), [poles, riskFilter, activeFeeder]);
    const urgentFeederPoles = useMemo(() => activeFeeder === null ? [] : poles
        .filter((pole) => substationName(pole) === activeFeeder)
        .filter((pole) => riskLevel(pole) === "CRITICAL")
        .sort((first, second) => riskScore(second) - riskScore(first))
        .slice(0, 5), [poles, activeFeeder]);



    return <section className={`geospatial-section${showFeederRanking ? "" : " map-only"}`} aria-label="Engineer geospatial analysis">
        <article ref={cardRef} className={`map-card${isFullscreen ? " is-fullscreen" : ""}`}>
            <div className="map-card-heading">
                <div><h3>Geospatial Analysis</h3><p>Poles coloured by final risk category</p></div>
                <div className="map-card-tools"><button ref={fullscreenButtonRef} className="map-fullscreen-button" type="button" onClick={() => void toggleFullscreen()} aria-pressed={isFullscreen} aria-label={isFullscreen ? "Exit fullscreen map" : "View map fullscreen"}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={isFullscreen ? "M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6" : "M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"} /></svg>
                    {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </button><label>Substation<select value={activeFeeder ?? ""} onChange={event => { setSelectedFeeder(event.target.value || null); setSelectedPole(null); }}>
                    <option value="">All substations</option>
                    {substations.map(name => <option key={name} value={name}>{name}</option>)}
                </select></label><MapRiskFilter selected={riskFilter} onChange={setRiskFilter} /><button className="map-info-button" type="button" aria-label="Map interaction help">i<span>Click marker for details.<br />Double-click marker to open Google Maps.</span></button></div>
            </div>
            {activeFeeder !== null && <div className="map-substation-selection">
                <span role="status">Substation: <strong>{activeFeeder}</strong> · {mapPoles.length} mapped poles</span>
                <button className="map-fullscreen-button" type="button" onClick={() => { setSelectedFeeder(null); setSelectedPole(null); }}>Show all substations</button>
            </div>}
            <div className="map-frame">
                {mapPoles.length === 0 ? <p role="status">No poles with coordinates match these filters.</p> : <MapContainer center={[3.273, 101.36]} zoom={13} scrollWheelZoom className="pole-map">
                    <TileLayer attribution='&copy; Esri, Maxar, Earthstar Geographics' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    <FitMapToPoles poles={mapPoles} />
                    {mapPoles.map((pole, index) => <Marker key={`${pole.poleId ?? "pole"}-${index}`} position={[Number(pole.latitude), Number(pole.longitude)]} icon={poleIcon(riskLevel(pole), markerNumber(pole))} eventHandlers={{ click: () => setSelectedPole(pole), dblclick: () => openGoogleMaps(pole) }}>
                        <Tooltip direction="top" offset={[0, -14]}>{pole.poleId ?? "Unnamed pole"}</Tooltip>
                    </Marker>)}
                </MapContainer>}
                <div className="map-legend">{categories.map((category) => <span key={category} className={`map-legend-${category.toLowerCase()}`}><i />{category[0]}{category.slice(1).toLowerCase()}</span>)}</div>
                {selectedPole && mapPoles.includes(selectedPole) && <PoleDetails pole={selectedPole} onClose={() => setSelectedPole(null)} onViewDetails={onViewDetails} />}
            </div>
        </article>
        {showFeederRanking && <article className="feeder-ranking-card">
            <p>Analysis</p><h3>Priority Ranking</h3><span>Ranked by critical-pole count, then highest risk score.</span>
            <ol>{feederRanking.map((feeder, index) => <li key={feeder.id}>
                <button className={`feeder-rank-button${activeFeeder === feeder.id ? " is-selected" : ""}`} type="button" aria-pressed={activeFeeder === feeder.id} onClick={() => { setSelectedFeeder(activeFeeder === feeder.id ? null : feeder.id); setSelectedPole(null); }}>
                    <span>
                        <b>{index + 1}. {feeder.id}</b>
                        <small>{feeder.poleCount} poles · {feeder.criticalCount} critical</small>
                        </span><strong title="Highest pole risk score in this feeder">{feeder.maxScore >= 0 ? feeder.maxScore : "—"}</strong>
                        </button>
                        </li>)}</ol>
            {activeFeeder !== null && <section className="feeder-urgent-list" aria-live="polite">
                <div>
                    <p>Urgent poles</p>
                    <h4>{activeFeeder}</h4>
                    </div>{urgentFeederPoles.length === 0 ? <span className="no-critical-poles">No Critical poles in this feeder.</span> : <ol>{urgentFeederPoles.map((pole, index) => <li key={`${pole.poleId ?? "pole"}-${index}`}>
                        <button className="urgent-pole-button" type="button" onClick={() => onSelectPole?.(pole)} disabled={!onSelectPole}>
                            <span>
                                <b>{pole.poleId ?? "Unnamed pole"}</b>
                                <small>{pole.landCoverType ?? "Unknown land cover"}</small>
                                </span>
                                <strong>{pole.finalAiRiskScore ?? "—"}</strong>
                                </button></li>)}</ol>}</section>}
        </article>}
    </section>;
}

function FitMapToPoles({ poles }: { poles: Pole[] }) {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    useEffect(() => {
        const bounds = latLngBounds(poles.map((pole) => [Number(pole.latitude), Number(pole.longitude)] as [number, number]));
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16, animate: false });
    }, [map, poles]);
    return null;
}

function hasCoordinates(pole: Pole) { return pole.latitude != null && pole.longitude != null && Number.isFinite(Number(pole.latitude)) && Number.isFinite(Number(pole.longitude)) && Math.abs(Number(pole.latitude)) <= 90 && Math.abs(Number(pole.longitude)) <= 180; }
function riskLevel(pole: Pole): RiskCategory {
    const category = pole.finalAiRiskCategory?.trim().toUpperCase();
    if (categories.includes(category as RiskCategory)) return category as RiskCategory;
    const score = Number(pole.finalAiRiskScore ?? -1);
    return score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
}

function riskScore(pole: Pole) { return Number(pole.finalAiRiskScore ?? -1); }

function poleIcon(category: RiskCategory, label: string) {
    const width = Math.max(28, 12 + label.length * 6);
    return divIcon({ className: "", iconSize: [width, 28], iconAnchor: [width / 2, 14], html: `<span class="pole-marker pole-marker-${category.toLowerCase()}" style="--marker-width:${width}px"><b>${label}</b></span>` });
}

function markerNumber(pole: Pole) {
    // Remove the letter prefix while retaining the complete numeric path.
    return pole.poleId?.trim().match(/\d[0-9a-zA-Z/_-]*$/)?.[0] || "•";
}
function openGoogleMaps(pole: Pole) { window.open(`https://www.google.com/maps?q=${pole.latitude},${pole.longitude}`, "_blank", "noopener,noreferrer"); }

function PoleDetails({ pole, onClose, onViewDetails }: { pole: Pole; onClose: () => void; onViewDetails?: (pole: Pole) => void }) {
    const category = riskLevel(pole);
    return <aside className="pole-details-panel" aria-label={`Details for ${pole.poleId ?? "pole"}`}>
        <button className="pole-details-close" type="button" onClick={onClose} aria-label="Close pole details">×</button>
        <h4>{pole.poleId ?? "Unnamed pole"}</h4>
        <p>Pole marker no: <b>{markerNumber(pole)}</b></p>
        <p>{pole.streetName ?? "Street not recorded"}</p>
        <p>Feeder: <b>{pole.feederId ?? "Not recorded"}</b></p>
        <p>Risk Score: <b>{pole.finalAiRiskScore ?? "Not assessed"} ({category[0]}{category.slice(1).toLowerCase()})</b></p>
        <p>Land cover: <b>{pole.landCoverType ?? "Not recorded"}</b></p>
        <p>Coordinates: {pole.latitude ?? "—"}, {pole.longitude ?? "—"}</p>
        <p>Source: Dataverse AI output</p>
        <div className="pole-detail-actions">{onViewDetails ?
            <button className="view-pole-details" type="button" onClick={() => onViewDetails(pole)}>View Details</button>
             : <a className="view-pole-details" href="#pole-risk-records">View Details</a>}
             <button className="open-maps-button" type="button" onClick={() => openGoogleMaps(pole)}>Google Map</button>
             </div>
    </aside>;
}

function substationName(pole: Pole) { return pole.substation?.trim() || pole.feederId?.trim() || "Unassigned feeder"; }

function rankFeeders(poles: Pole[]) {
    const totals = new Map<string, { total: number; poleCount: number; criticalCount: number; maxScore: number }>();
    poles.forEach((pole) => {
        const id = substationName(pole);
        const current = totals.get(id) ?? { total: 0, poleCount: 0, criticalCount: 0, maxScore: -1 };
        const score = Number(pole.finalAiRiskScore);
        if (pole.finalAiRiskScore !== null && Number.isFinite(score)) {
            current.total += Math.max(0, score);
            current.maxScore = Math.max(current.maxScore, score);
        }
        current.poleCount += 1;
        current.criticalCount += riskLevel(pole) === "CRITICAL" ? 1 : 0;
        totals.set(id, current);
    });
    return [...totals.entries()].map(([id, total]) => ({ id, ...total, averageScore: total.poleCount ? total.total / total.poleCount : 0 }))
        .sort((first, second) => second.criticalCount - first.criticalCount || second.averageScore - first.averageScore).slice(0, 5);
}


function MapRiskFilter({ selected, onChange }: { selected: RiskCategory[]; onChange: (value: RiskCategory[]) => void }) {
    const dropdownRef = useRef<HTMLDetailsElement>(null);
    const allSelected = selected.length === categories.length;
    useEffect(() => {
        const closeOutside = (event: PointerEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) dropdownRef.current.open = false;
        };
        document.addEventListener("pointerdown", closeOutside);
        return () => document.removeEventListener("pointerdown", closeOutside);
    }, []);
    return <div className="map-risk-filter">
        <span className="map-risk-filter-label">Risk filter</span>
        <details ref={dropdownRef} onKeyDown={event => {
            if (event.key === "Escape" && event.currentTarget.open) {
                event.stopPropagation();
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
            }
        }} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
        }}>
            <summary aria-label={`Risk filter: ${allSelected ? "All risk" : selected.length ? selected.join(", ") : "No risk selected"}`}>
                {allSelected ? "All risk" : selected.length === 0 ? "No risk selected" : selected.length === 1 ? selected[0] : `${selected.length} risks selected`}
            </summary>
            <div className="map-risk-options" role="group" aria-label="Select risk categories">
                <label><input type="checkbox" checked={allSelected} onChange={() => onChange(allSelected ? [] : [...categories])} />All risk</label>
                {categories.map(category => <label key={category}>
                    <input type="checkbox" checked={selected.includes(category)} onChange={event => onChange(event.target.checked ? [...selected, category] : selected.filter(value => value !== category))} />
                    {category}
                </label>)}
            </div>
        </details>
    </div>;
}

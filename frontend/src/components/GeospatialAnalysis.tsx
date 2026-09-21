import { useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Pole } from "../services/api";

const categories = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type RiskCategory = typeof categories[number];

export function GeospatialAnalysis({ poles, showFeederRanking = true, onSelectPole, onViewDetails }: { poles: Pole[]; showFeederRanking?: boolean; onSelectPole?: (pole: Pole) => void; onViewDetails?: (pole: Pole) => void }) {
    const [riskFilter, setRiskFilter] = useState<"ALL" | RiskCategory>("ALL");
    const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
    const [selectedFeeder, setSelectedFeeder] = useState<string | null>(null);
    const mapPoles = useMemo(() => poles
        .filter(hasCoordinates)
        .filter((pole) => riskFilter === "ALL" || riskLevel(pole) === riskFilter), [poles, riskFilter]);
    const feederRanking = useMemo(() => rankFeeders(poles), [poles]);
    const urgentFeederPoles = useMemo(() => selectedFeeder === null ? [] : poles
        .filter((pole) => (pole.feederId?.trim() || "Unassigned feeder") === selectedFeeder)
        .filter((pole) => riskLevel(pole) === "CRITICAL")
        .sort((first, second) => riskScore(second) - riskScore(first))
        .slice(0, 5), [poles, selectedFeeder]);

    if (mapPoles.length === 0) return null;

    return <section className={`geospatial-section${showFeederRanking ? "" : " map-only"}`} aria-label="Engineer geospatial analysis">
        <article className="map-card">
            <div className="map-card-heading">
                <div><h3>Geospatial Analysis</h3><p>Poles coloured by final risk category</p></div>
                <div className="map-card-tools"><label>Risk filter<select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as "ALL" | RiskCategory)}><option value="ALL">All risk</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><button className="map-info-button" type="button" aria-label="Map interaction help">i<span>Click marker for details.<br />Double-click marker to open Google Maps.</span></button></div>
            </div>
            <div className="map-frame">
                <MapContainer center={[3.273, 101.36]} zoom={13} scrollWheelZoom className="pole-map">
                    <TileLayer attribution='&copy; Esri, Maxar, Earthstar Geographics' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    <FitMapToPoles poles={mapPoles} />
                    {mapPoles.map((pole, index) => <Marker key={`${pole.poleId ?? "pole"}-${index}`} position={[Number(pole.latitude), Number(pole.longitude)]} icon={poleIcon(riskLevel(pole), markerNumber(pole))} eventHandlers={{ click: () => setSelectedPole(pole), dblclick: () => openGoogleMaps(pole) }}>
                        <Tooltip direction="top" offset={[0, -14]}>{pole.poleId ?? "Unnamed pole"}</Tooltip>
                    </Marker>)}
                </MapContainer>
                <div className="map-legend">{categories.map((category) => <span key={category} className={`map-legend-${category.toLowerCase()}`}><i />{category[0]}{category.slice(1).toLowerCase()}</span>)}</div>
                {selectedPole && <PoleDetails pole={selectedPole} onClose={() => setSelectedPole(null)} onViewDetails={onViewDetails} />}
            </div>
        </article>
        {showFeederRanking && <article className="feeder-ranking-card">
            <p>Feeder analysis</p><h3>Feeder Priority Ranking</h3><span>Ranked by critical-pole count, then highest risk score.</span>
            <ol>{feederRanking.map((feeder, index) => <li key={feeder.id}><button className={`feeder-rank-button${selectedFeeder === feeder.id ? " is-selected" : ""}`} type="button" onClick={() => setSelectedFeeder((current) => current === feeder.id ? null : feeder.id)}><span><b>{index + 1}. {feeder.id}</b><small>{feeder.poleCount} poles · {feeder.criticalCount} critical</small></span><strong title="Highest pole risk score in this feeder">{feeder.maxScore >= 0 ? feeder.maxScore : "—"}</strong></button></li>)}</ol>
            {selectedFeeder !== null && <section className="feeder-urgent-list" aria-live="polite"><div><p>Urgent poles</p><h4>{selectedFeeder}</h4></div>{urgentFeederPoles.length === 0 ? <span className="no-critical-poles">No Critical poles in this feeder.</span> : <ol>{urgentFeederPoles.map((pole, index) => <li key={`${pole.poleId ?? "pole"}-${index}`}><button className="urgent-pole-button" type="button" onClick={() => onSelectPole?.(pole)} disabled={!onSelectPole}><span><b>{pole.poleId ?? "Unnamed pole"}</b><small>{pole.landCoverType ?? "Unknown land cover"}</small></span><strong>{pole.finalAiRiskScore ?? "—"}</strong></button></li>)}</ol>}</section>}
        </article>}
    </section>;
}

function FitMapToPoles({ poles }: { poles: Pole[] }) {
    const map = useMap();
    useEffect(() => {
        const bounds = latLngBounds(poles.map((pole) => [Number(pole.latitude), Number(pole.longitude)] as [number, number]));
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    }, [map, poles]);
    return null;
}

function hasCoordinates(pole: Pole) { return Number.isFinite(Number(pole.latitude)) && Number.isFinite(Number(pole.longitude)); }
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
        <div className="pole-detail-actions">{onViewDetails ? <button className="view-pole-details" type="button" onClick={() => onViewDetails(pole)}>View Details</button> : <a className="view-pole-details" href="#pole-risk-records">View Details</a>}<button className="open-maps-button" type="button" onClick={() => openGoogleMaps(pole)}>Google Map</button></div>
    </aside>;
}

function rankFeeders(poles: Pole[]) {
    const totals = new Map<string, { total: number; poleCount: number; criticalCount: number; maxScore: number }>();
    poles.forEach((pole) => {
        const id = pole.feederId?.trim() || "Unassigned feeder";
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

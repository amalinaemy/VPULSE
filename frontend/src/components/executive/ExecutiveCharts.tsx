import { useId, useState } from "react";

interface ChartItem {
    label: string;
    count: number;
    color: string;
}

interface MetricProps {
    label: string;
    value: string | number;
    note: string;
}

export function Metric({ label, value, note }: MetricProps) {
    return (
        <article className="metric">
            <span>{label}</span>
            <strong className="blue">
                {typeof value === "number" ? value.toLocaleString() : value}
            </strong>
            <p>{note}</p>
        </article>
    );
}

export function Bars({ items }: { items: ChartItem[] }) {
    const max = Math.max(1, ...items.map(item => item.count));

    return (
        <ul className="executive-bars">
            {items.map(item => (
                <li key={item.label}>
                    <div>
                        <span>{item.label}</span>
                        <strong>{item.count.toLocaleString()}</strong>
                    </div>
                    <div className="executive-bar-track" aria-hidden="true">
                        <span style={{ width: `${item.count / max * 100}%`, background: item.color }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function CriticalityPie({ items }: { items: ChartItem[] }) {
    const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
    const [focusedLabel, setFocusedLabel] = useState<string | null>(null);
    const tooltipId = useId();
    const total = items.reduce((sum, item) => sum + item.count, 0);
    const active = items.find(item => item.label === (hoveredLabel ?? focusedLabel) && item.count > 0);
    const segments = createPieSegments(items, total);

    function dismissTooltip() {
        setHoveredLabel(null);
        setFocusedLabel(null);
    }

    return (
        <div className="executive-pie-layout" onKeyDown={event => {
            if (event.key === "Escape") dismissTooltip();
        }}>
            <div className="executive-pie-container">
                <svg
                    className="executive-pie"
                    viewBox="0 0 220 220"
                    role="group"
                    aria-label="Candidate criticality pie chart"
                >
                    {segments.map(item => (
                        <path
                            key={item.label}
                            d={item.path}
                            fill={item.color}
                            className={`executive-pie-slice${active?.label === item.label ? " is-active" : ""}`}
                            style={{ opacity: active && active.label !== item.label ? 0.45 : 1 }}
                            tabIndex={0}
                            role="img"
                            aria-label={`${item.label}: ${item.count.toLocaleString()} poles, ${(item.count / total * 100).toFixed(1)}%`}
                            aria-describedby={active?.label === item.label ? tooltipId : undefined}
                            onPointerEnter={() => setHoveredLabel(item.label)}
                            onPointerLeave={() => setHoveredLabel(null)}
                            onFocus={() => setFocusedLabel(item.label)}
                            onBlur={() => setFocusedLabel(null)}
                            onClick={() => setFocusedLabel(item.label)}
                        />
                    ))}
                </svg>
                {active && (
                    <div className="executive-pie-tooltip" id={tooltipId} role="tooltip">
                        <strong>{active.label}</strong>
                        <span>{active.count.toLocaleString()} poles · {(active.count / total * 100).toFixed(1)}%</span>
                    </div>
                )}
            </div>
            <ul className="executive-pie-legend">
                {items.map(item => (
                    <li
                        key={item.label}
                        onPointerEnter={() => setHoveredLabel(item.label)}
                        onPointerLeave={() => setHoveredLabel(null)}
                    >
                        <span className="executive-pie-key" style={{ background: item.color }} aria-hidden="true" />
                        <span>{item.label}</span>
                        <strong>{item.count.toLocaleString()}</strong>
                        <span className="executive-pie-percent">
                            {total ? (item.count / total * 100).toFixed(1) : "0.0"}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function createPieSegments(items: ChartItem[], total: number) {
    let cumulative = 0;
    return items.filter(item => item.count > 0).map(item => {
        const start = cumulative;
        cumulative += item.count / total;
        const middle = (start + cumulative) / 2;
        // Two arcs also cover a single category occupying the entire circle.
        const path = `M110,110 L${piePoint(start)} A100,100 0 0,1 ${piePoint(middle)} A100,100 0 0,1 ${piePoint(cumulative)} Z`;
        return { ...item, path };
    });
}

function piePoint(fraction: number) {
    const angle = fraction * Math.PI * 2 - Math.PI / 2;
    return `${110 + 100 * Math.cos(angle)},${110 + 100 * Math.sin(angle)}`;
}

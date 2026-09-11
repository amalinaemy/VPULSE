import type { ReactNode } from "react";
import logoTnb from "../assets/logoTNB.png";
import type { View } from "../types/view";

const workFormView: View = "work-form";

interface SidebarProps {
    activeView: View;
    isOpen: boolean;
    onClose: () => void;
    onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, isOpen, onClose, onViewChange }: SidebarProps) {
    return (
        <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
            <div className="sidebar-top">
                <div className="brand">
                    <div className="brand-logo-row"><img src={logoTnb} alt="TNB" /><span className="brand-kicker">Prototype model</span></div>
                    <strong>LV Lines<br />Vegetation<br />Risk Engine</strong>
                </div>
                <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close menu">×</button>
            </div>
            <nav aria-label="Application views">
                <NavButton active={activeView === "home"} onClick={() => onViewChange("home")}>Home</NavButton>
                <span className="nav-label">Operational Command Centre View</span>
                <div className="subnav">
                    <NavButton active={activeView === "executive"} onClick={() => onViewChange("executive")}>Executive </NavButton>
                    <NavButton active={activeView === "engineer"} onClick={() => onViewChange("engineer")}>Engineer </NavButton>
                    <NavButton active={activeView === "engineer-2"} onClick={() => onViewChange("engineer-2")}>Engineer 2</NavButton>
                    <NavButton active={activeView === "field"} onClick={() => onViewChange("field")}>Field Team </NavButton>
                </div>
                <br />
                <NavButton active={activeView === "information"} onClick={() => onViewChange("information")}>Information</NavButton>
                <span className="nav-label secondary">Data source &amp; AI run</span>
                <NavButton active={activeView === workFormView} onClick={() => onViewChange(workFormView)}>Work Digital Form</NavButton>
                <button className="nav-item muted-nav" type="button">AI Model Architecture</button>
            </nav>
        </aside>
    );
}

function NavButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
    return <button className={`nav-item ${active ? "active" : ""}`} type="button" onClick={onClick}>{children}</button>;
}

import { useEffect, useState } from "react";

import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";

import { EngineerPage } from "./pages/EngineerPage";
import { FieldTeamPage } from "./pages/FieldTeamPage";
import { HomePage } from "./pages/HomePage";
import { OverviewPage } from "./pages/OverviewPage";
import { WorkForm } from "./pages/WorkForm";

import {
    getHealth,
    getPoles,
    getWorkFeedback,
    type HealthResponse,
    type Pole,
    type WorkFeedback,
} from "./services/api";

import type { View } from "./types/view";

import "./App.css";

const workFormView = "work-form" as const;

function App() {

    const [activeView, setActiveView] = useState<View>("home");

    const [theme, setTheme] = useState<"dark" | "light">(
        () =>
            localStorage.getItem("vpulse-theme") === "light"
                ? "light"
                : "dark"
    );

    /*Sideba*/

    const [isSidebarOpen, setIsSidebarOpen] = useState(
        () => window.innerWidth > 1050
    );

    /* Backend health
    */

    const [health, setHealth] =
        useState<HealthResponse | null>(null);

    /*
    Dataverse pole data
    */

    const [poles, setPoles] = useState<Pole[]>([]);

    const [isLoadingPoles, setIsLoadingPoles] =
        useState(true);

    const [polesError, setPolesError] =
        useState<string | null>(null);

    const [workFeedback, setWorkFeedback] =
        useState<WorkFeedback[]>([]);

    /*
    |--------------------------------------------------------------------------
    | Load backend + Dataverse data
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const loadInitialData = async () => {
            /*
            |--------------------------------------------------------------
            | Backend health
            |--------------------------------------------------------------
            */

            try {
                const healthResponse = await getHealth();
                setHealth(healthResponse);
            } catch (error) {
                console.error(
                    "Unable to connect to V-PULSE API:",
                    error
                );

                setHealth(null);
            }

            /*
            |--------------------------------------------------------------
            | Pole data
            |--------------------------------------------------------------
            */

            try {
                setIsLoadingPoles(true);

                const poleData = await getPoles();

                setPoles(poleData);
                setPolesError(null);
            } catch (error: unknown) {
                console.error(
                    "Unable to retrieve Dataverse pole records:",
                    error
                );

                setPoles([]);

                setPolesError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load Dataverse records."
                );
            } finally {
                setIsLoadingPoles(false);
            }

            try {
                setWorkFeedback(await getWorkFeedback());
            } catch (error) {
                console.error(
                    "Unable to retrieve LV VM Model work feedback:",
                    error
                );
                setWorkFeedback([]);
            }

        };

        loadInitialData();
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Theme persistence
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        document.documentElement.style.colorScheme = theme;

        localStorage.setItem(
            "vpulse-theme",
            theme
        );
    }, [theme]);

    /*
    |--------------------------------------------------------------------------
    | Responsive sidebar
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        const mediaQuery = window.matchMedia(
            "(max-width: 1050px)"
        );

        const handleViewportChange = (
            event: MediaQueryListEvent
        ) => {
            setIsSidebarOpen(!event.matches);
        };

        mediaQuery.addEventListener(
            "change",
            handleViewportChange
        );

        return () => {
            mediaQuery.removeEventListener(
                "change",
                handleViewportChange
            );
        };
    }, []);

    /*
    |--------------------------------------------------------------------------
    | Page renderer
    |--------------------------------------------------------------------------
    */

    const renderActivePage = () => {
        switch (activeView) {
            /*
            |--------------------------------------------------------------
            | Home
            |--------------------------------------------------------------
            */

            case "home":
                return (
                    <HomePage
                        onNavigate={setActiveView}
                        poles={poles}
                        isLoading={isLoadingPoles}
                        error={polesError}
                    />
                );

            /*
            |--------------------------------------------------------------
            | Engineer / Dataverse pole records
            |--------------------------------------------------------------
            */

            case "engineer":
                return (
                    <EngineerPage
                        key="engineer"
                        poles={poles}
                        isLoading={isLoadingPoles}
                        error={polesError}
                    />
                );

            case "engineer-2":
                return (
                    <EngineerPage
                        key="engineer-2"
                        viewLabel="Engineer 2 View"
                        hierarchyMode
                        poles={poles}
                        isLoading={isLoadingPoles}
                        error={polesError}
                    />
                );

            /*
            |--------------------------------------------------------------
            | Embedded Power App
            |--------------------------------------------------------------
            */

            case workFormView:
                return (
                    <WorkForm />
                );

            case "field":
                return (
                    <FieldTeamPage
                        poles={poles}
                        workFeedback={workFeedback}
                        isLoading={isLoadingPoles}
                        error={polesError}
                        onOpenWorkForm={() => setActiveView(workFormView)}
                    />
                );

            /*
            |--------------------------------------------------------------
            | Other overview pages
            |--------------------------------------------------------------
            */

            default:
                return (
                    <OverviewPage
                        view={activeView}
                        poleCount={poles.length}
                    />
                );
        }
    };

    /*
    |--------------------------------------------------------------------------
    | Render application shell
    |--------------------------------------------------------------------------
    */

    return (
        <div
            className={`
                workspace
                ${theme}-theme
                ${
                    isSidebarOpen
                        ? "sidebar-open"
                        : "sidebar-closed"
                }
            `}
        >
            <Sidebar
                activeView={activeView}
                isOpen={isSidebarOpen}
                onClose={() =>
                    setIsSidebarOpen(false)
                }
                onViewChange={setActiveView}
            />

            <main className="content">
                <div className="header-layout">
                    <button
                        className="sidebar-menu-button"
                        type="button"
                        onClick={() =>
                            setIsSidebarOpen(
                                (open) => !open
                            )
                        }
                        aria-label="Toggle menu"
                    >
                        ☰
                    </button>

                    <div className="header-area">
                        <AppHeader
                            activeView={activeView}
                            health={health}
                            recordCount={poles.length}
                            lastModifiedOn={
                                getLatestModifiedOn(
                                    poles
                                )
                            }
                            theme={theme}
                            onThemeToggle={() =>
                                setTheme(
                                    (current) =>
                                        current ===
                                        "dark"
                                            ? "light"
                                            : "dark"
                                )
                            }
                        />
                    </div>
                </div>

                <div className="page-content">
                    {renderActivePage()}
                </div>
            </main>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Find latest Dataverse modified date
|--------------------------------------------------------------------------
*/

function getLatestModifiedOn(
    poles: Pole[]
): string | null {
    let latestTimestamp =
        Number.NEGATIVE_INFINITY;

    for (const pole of poles) {
        if (!pole.modifiedOn) {
            continue;
        }

        const timestamp =
            Date.parse(pole.modifiedOn);

        if (
            !Number.isNaN(timestamp) &&
            timestamp > latestTimestamp
        ) {
            latestTimestamp = timestamp;
        }
    }

    return Number.isFinite(latestTimestamp)
        ? new Date(
              latestTimestamp
          ).toISOString()
        : null;
}

export default App;

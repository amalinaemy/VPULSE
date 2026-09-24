import { useEffect, useState } from "react";

import { AppHeader } from "./components/AppHeader";
import { Sidebar } from "./components/Sidebar";

import { EngineerPage } from "./pages/EngineerPage";
import { FieldTeamPage } from "./pages/FieldTeamPage";
import { HomePage } from "./pages/HomePage";
import { ExecutivePage } from "./pages/ExecutivePage";
import { OverviewPage } from "./pages/OverviewPage";
import { WorkForm } from "./pages/WorkForm";

import {
    getPoles,
    getWorkFeedback,
    invalidateWorkFeedback,
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

    /*
    Dataverse pole data
    */

    const [poles, setPoles] = useState<Pole[]>([]);

    const [isLoadingPoles, setIsLoadingPoles] =
        useState(true);

    const [polesError, setPolesError] =
        useState<string | null>(null);

    const [feedbackRefresh, setFeedbackRefresh] = useState(0);
    const [feedbackLoading, setFeedbackLoading] = useState(true);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
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



        };

        loadInitialData();
    }, []);

    // Load feedback for the active view; form access is independent of this request.
    useEffect(() => {
        if (isLoadingPoles || polesError || !["field", "executive", "engineer"].includes(activeView)) return;
        const controller = new AbortController();
        let active = true;
        setFeedbackLoading(true);
        setFeedbackError(null);
        const feedbackPoles = activeView === "field" ? poles.filter(pole => {
            const category = pole.finalAiRiskCategory?.trim().toUpperCase();
            if (category && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(category)) return ["CRITICAL", "HIGH"].includes(category);
            return Number(pole.finalAiRiskScore ?? -1) >= 60;
        }) : poles;
        getWorkFeedback(feedbackPoles.flatMap(pole => pole.poleId ? [pole.poleId] : []), controller.signal)
            .then(feedback => {
                if (active) setWorkFeedback(feedback);
            })
            .catch(error => {
                if (active) setFeedbackError(error instanceof Error ? error.message : "Unable to load work feedback.");
            })
            .finally(() => {
                if (active) setFeedbackLoading(false);
            });
        return () => { active = false; controller.abort(); };
    }, [activeView, poles, isLoadingPoles, polesError, feedbackRefresh]);

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

            case "executive":
                return <ExecutivePage poles={poles} workFeedback={workFeedback} isLoading={isLoadingPoles} error={polesError} feedbackLoading={feedbackLoading} feedbackError={feedbackError} />;

            case "engineer":
                return (
                    <EngineerPage
                        workFeedback={workFeedback}
                        key="engineer"
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
                        feedbackLoading={feedbackLoading}
                        feedbackError={feedbackError}
                        onRefreshFeedback={() => { invalidateWorkFeedback(); setFeedbackRefresh(value => value + 1); }}
                        poles={poles}
                        workFeedback={workFeedback}
                        isLoading={isLoadingPoles}
                        error={polesError}
                        onWorkFormSaved={async () => { invalidateWorkFeedback(); setFeedbackRefresh(value => value + 1); }}
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
                            dataStatus={isLoadingPoles ? "loading" : polesError ? "error" : "connected"}
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

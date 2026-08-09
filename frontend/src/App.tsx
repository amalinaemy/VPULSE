import { useEffect, useState } from "react";
import { getHealth } from "./services/api";

interface HealthResponse {
    status: string;
    application: string;
    message: string;
}

function App() {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getHealth()
            .then((data) => {
                setHealth(data);
            })
            .catch((err) => {
                setError(err.message);
            });
    }, []);

    return (
        <div>
            <h1>V-PULSE</h1>

            <h2>System Status</h2>

            {health && (
                <div>
                    <p>Status: {health.status}</p>
                    <p>Application: {health.application}</p>
                    <p>{health.message}</p>
                </div>
            )}

            {error && (
                <p>
                    Backend connection failed: {error}
                </p>
            )}
        </div>
    );
}

export default App;
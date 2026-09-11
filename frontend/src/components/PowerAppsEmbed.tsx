import "./PowerAppsEmbed.css";

interface PowerAppsEmbedProps {
    poleId?: string;
}

export function PowerAppsEmbed({
    poleId,
}: PowerAppsEmbedProps) {
    const baseUrl =
        import.meta.env.VITE_POWER_APPS_URL;

    if (!baseUrl) {
        return (
            <div className="power-app-error">
                <strong>
                    Power Apps URL is not configured.
                </strong>

                <p>
                    Add VITE_POWER_APPS_URL to
                    .env.development and restart Vite.
                </p>
            </div>
        );
    }

    let powerAppsUrl = baseUrl;

    try {
        const url = new URL(baseUrl);

        /*
         * Allows us to integrate a selected
         * Dataverse Pole ID later.
         */
        if (poleId) {
            url.searchParams.set(
                "poleId",
                poleId
            );
        }

        powerAppsUrl = url.toString();
    } catch {
        console.error(
            "Invalid Power Apps URL:",
            baseUrl
        );
    }

    return (
        <div className="power-app-wrapper">
            <iframe
                className="power-app-frame"
                src={powerAppsUrl}
                title="V-PULSE Vegetation Field Inspection"
                allow="camera; microphone; geolocation; fullscreen"
                allowFullScreen
            />
        </div>
    );
}
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Keep dialogs inside the fullscreen element. Retain the host until close so
// exiting fullscreen does not remount a form or discard unsaved input.
export function MapModalPortal({ children }: { children: ReactNode }) {
    const [host] = useState(() => document.fullscreenElement
        ?? document.querySelector(".map-card.is-fullscreen") ?? document.body);
    return createPortal(children, host);
}

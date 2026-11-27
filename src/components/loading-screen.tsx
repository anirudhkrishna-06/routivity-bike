"use client";

import { BikeLoader } from "./bike-loader";

export function LoadingScreen({ label, inline = false }: { label?: string; inline?: boolean }) {
  return <div className={`loading-screen${inline ? " loading-screen-inline" : ""}`} role="status" aria-live="polite" aria-label={label || "Loading"}>
    <BikeLoader />
    {label && <p>{label}</p>}
  </div>;
}

"use client";

export function LoadingScreen({ label = "Opening your trip" }: { label?: string }) {
  return <div className="loading-screen" role="status" aria-live="polite"><div className="konark-wheel" aria-hidden="true"><span>☼</span></div><p>{label}</p><small>Routivity is getting everything in place</small></div>;
}

"use client";

import { useOffline } from "next/offline";

export function OfflineBanner() {
  const offline = useOffline();
  return offline ? <div className="offline-banner" role="status">Offline — your changes are saved on this device and will retry automatically.</div> : null;
}

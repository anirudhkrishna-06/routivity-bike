import type { Metadata, Viewport } from "next";
import { TripWatchPage } from "@/components/trip-watch/trip-watch-page";

export const metadata: Metadata = { title: "Trip Watch · Routivity", robots: { index: false, follow: false, nocache: true } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const instant = false;

export default async function TripWatchRoute({ params }: { params: Promise<{ shareToken: string }> }) {
  return <TripWatchPage shareToken={(await params).shareToken} />;
}

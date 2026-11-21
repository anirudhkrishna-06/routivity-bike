import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../components/app-shell.css";
import "../components/itinerary-workspace.css";
import "./phase2-overrides.css";
import "./auth.css";
import "./real-dashboard.css";
import "./import-trip.css";
import { OfflineBanner } from "../components/offline-banner";

export const metadata: Metadata = {
  title: "Routivity — trips that stay together",
  description: "Plan the ride, share the spend, keep the memories.",
  applicationName: "Routivity",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><OfflineBanner />{children}</body></html>;
}

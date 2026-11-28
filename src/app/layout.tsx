import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../components/app-shell.css";
import "../components/settings-panel.css";
import "../components/lively-container.css";
import "../components/itinerary-workspace.css";
import "./phase2-overrides.css";
import "./auth.css";
import "./real-dashboard.css";
import "./trip-now-redesign.css";
import "./trip-now-polish.css";
import "./trip-now-actions.css";
import "./import-trip.css";
import "../components/money-workspace.css";
import "../components/settlement-workspace.css";
import "../components/money-hub.css";
import "./budget.css";
import "./danger.css";
import "./trip-settings.css";
import "./dashboard.css";
import "./money-actions.css";
import "./fuel-fields.css";
import "./payer-fields.css";
import "./fuel-intelligence.css";
import "./activity-editor.css";
import "./itinerary-redesign.css";
import "./layout-polish.css";
import "../components/trip-watch/trip-watch.css";
import { OfflineBanner } from "../components/offline-banner";

import { Patrick_Hand, Space_Grotesk } from "next/font/google";

const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-journal",
});

const spaceGrotesk = Space_Grotesk({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/sf-pro-display"
        />
      </head>
      <body>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}

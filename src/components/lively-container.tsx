"use client";

import { useEffect, useState } from "react";
import { Check, Compass, House, MapPin, Sparkles, Clock } from "lucide-react";
import type { NowActivity, TripNowState } from "@/lib/trip-now";
import { getLiveDirectionsUrl } from "@/lib/maps";

type LivelyActivity = NowActivity & { notes?: string | null; stayNights?: number | null };

type Props = {
  state: TripNowState;
  stay?: LivelyActivity;
  isStay: boolean;
  overnight: boolean;
  title: string;
  description: string;
  mapUrl?: string;
  mutation?: string;
  completing?: string;
  onDone: () => void;
  onStayDone: (activityId: string, label: string) => void;
  readOnly?: boolean;
};

function Lottie({ file, className = "" }: { file: string; className?: string }) {
  const [data, setData] = useState<unknown>();
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    void fetch(`/${file}`)
      .then((response) => response.json())
      .then((value) => live && setData(value))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [file]);

  useEffect(() => {
    if (!node || !data) return;
    let animation: { destroy: () => void } | undefined;
    let live = true;
    void import("lottie-web").then(({ default: lottie }) => {
      if (live) {
        animation = lottie.loadAnimation({
          container: node,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
      }
    });
    return () => {
      live = false;
      animation?.destroy();
    };
  }, [node, data]);

  return <div ref={setNode} className={`lively-lottie ${className}`} aria-hidden="true" />;
}


function GreenMountainFar() {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="lively-ridge-svg">
      <path
        d="M0,120 L0,68 L50,24 L105,72 L165,16 L225,68 L285,28 L345,64 L400,68 L400,120 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GreenMountainNear() {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="lively-ridge-svg">
      <path
        d="M0,120 L0,76 C45,46 80,54 120,82 C160,40 200,46 240,78 C280,44 335,44 400,76 L400,120 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TripPrepScene() {
  return (
    <div className="lively-prep-backdrop" aria-hidden="true">
      <svg viewBox="35 52 330 118" preserveAspectRatio="xMidYMax meet" className="lively-prep-svg">
        {/* Soft Rolling Horizon */}
        <path
          d="M0,175 L0,126 Q110,110 210,124 T400,118 L400,175 Z"
          fill="#214e3b"
          opacity="0.12"
        />
        <line x1="45" y1="156" x2="355" y2="156" stroke="#214e3b" strokeWidth="3" strokeLinecap="round" opacity="0.24" />

        {/* 1. LEFT: Larger Ticking Countdown Clock */}
        <g className="prep-clock" transform="translate(112, 92)">
          <circle cx="0" cy="0" r="30" fill="#ffffff" fillOpacity="0.78" stroke="#19372d" strokeWidth="3" />
          <path d="M-19,-24 L-26,-31 M19,-24 L26,-31" stroke="#19372d" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="2.8" fill="#19372d" />
          <line x1="0" y1="0" x2="0" y2="-14" stroke="#19372d" strokeWidth="3" strokeLinecap="round" className="prep-clock-hour" />
          <line x1="0" y1="0" x2="17" y2="0" stroke="#e8794a" strokeWidth="2.5" strokeLinecap="round" className="prep-clock-min" />
        </g>

        {/* 2. CENTER: Larger Packing Duffel Bag + Floating Gear Items */}
        <g className="prep-bag-group" transform="translate(200, 128)">
          <g className="prep-gear-item item-1">
            <rect x="-10" y="-10" width="20" height="15" rx="3.5" fill="#e8794a" />
            <circle cx="0" cy="-2.5" r="3.8" fill="#fff" />
          </g>
          <g className="prep-gear-item item-2">
            <path d="M-9,6 L0,-10 L9,6 Z" fill="#2c6e54" />
          </g>
          <g className="prep-gear-item item-3">
            <circle cx="0" cy="0" r="7.5" fill="#3b7a9e" />
          </g>

          <g className="prep-bag-body">
            <path d="M-21,-30 C-21,-45 21,-45 21,-30" fill="none" stroke="#19372d" strokeWidth="3.8" strokeLinecap="round" />
            <rect x="-44" y="-30" width="88" height="58" rx="17" fill="#234d3e" />
            <rect x="-28" y="-7" width="56" height="27" rx="8" fill="#2f6350" />
            <rect x="-26" y="-30" width="6.5" height="58" fill="#163329" />
            <rect x="19.5" y="-30" width="6.5" height="58" fill="#163329" />
            <line x1="-32" y1="-18" x2="32" y2="-18" stroke="#a6cbb9" strokeWidth="2.5" strokeDasharray="3.5 3.5" />
            <rect x="-32" y="-21.5" width="7.5" height="7.5" rx="1.8" fill="#f4b860" className="prep-zipper" />
          </g>
        </g>

        {/* 3. RIGHT: Larger Fueling Pump + Rising Gauge */}
        <g className="prep-fuel-group" transform="translate(284, 110)">
          <path
            d="M20,-5 C34,-5 36,22 26,31 C20,38 17,19 24,12"
            fill="none"
            stroke="#19372d"
            strokeWidth="3"
            strokeLinecap="round"
            className="prep-hose"
          />
          <rect x="-23" y="-32" width="44" height="78" rx="9" fill="#19372d" />
          <rect x="-15" y="-23" width="28" height="20" rx="3.5" fill="#d7ece2" />
          <rect x="-13" y="-21" width="24" height="16" rx="2.5" fill="#e8794a" className="prep-fuel-level" />
          <path d="M0,10 C0,10 -6.5,17 -6.5,21 A6.5,6.5 0 0,0 6.5,21 C6.5,17 0,10 0,10 Z" fill="#74b496" className="prep-drop" />
        </g>

        {/* Subtle Sparkles */}
        <circle cx="152" cy="64" r="3" fill="#ffffff" className="prep-sparkle s1" />
        <circle cx="248" cy="68" r="2.5" fill="#ffffff" className="prep-sparkle s2" />
      </svg>
    </div>
  );
}


export function LivelyContainer({
  state,
  stay,
  isStay,
  overnight,
  title,
  description,
  mapUrl,
  mutation,
  completing,
  onDone,
  onStayDone,
  readOnly = false,
}: Props) {
  const showOvernight = overnight || isStay;
  const isTravel = !showOvernight && state.activity?.type === "TRAVEL";
  const isBefore = !showOvernight && state.kind === "before";

  return (
    <article
      className={`lively-container ${state.kind} ${readOnly ? "read-only" : ""} ${showOvernight ? "stay-context" : ""} ${
        isTravel ? "is-travel" : ""
      } ${isBefore ? "is-before" : ""} ${completing ? "is-completing" : ""}`}
    >
      {/* Top Header Bar */}
      <header className="lively-header">
        <span className="lively-badge">
          {showOvernight ? "OVERNIGHT" : state.label}
        </span>
        {state.minutesRemaining !== undefined && !showOvernight && (
          <span className="lively-timer">
            <Clock size={12} /> {state.minutesRemaining} min left
          </span>
        )}
      </header>

      {/* Main Content Body */}
      <div className="lively-body">
        <div className="lively-copy">
          <h2>{title}</h2>

          {/* Route Visualization for Travel */}
          {isTravel && state.activity && (
            <div className="lively-route-card">
              <div className="lively-route-point">
                <span className="lively-dot origin" />
                <div>
                  <small>FROM</small>
                  <strong>{state.activity.origin}</strong>
                </div>
              </div>

              <div className="lively-route-track">
                <div className="lively-route-line-dashed" />
                {state.activity.distanceKmMilli && (
                  <span className="lively-distance-pill">
                    {(state.activity.distanceKmMilli / 1000).toFixed(0)} km
                  </span>
                )}
              </div>

              <div className="lively-route-point right">
                <span className="lively-dot dest" />
                <div>
                  <small>TO</small>
                  <strong>{state.activity.destination}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Stay Meta Pill */}
          {showOvernight && stay && (
            <div className="lively-meta-pill">
              <span className="lively-meta-item">
                <House size={14} /> {stay.location || "Accommodation"}
              </span>
              
            </div>
          )}

          {/* Up Next Chip */}
          {state.nextActivity && (
            <div className="lively-next-chip">
              <span>↓ Up next</span>
              <strong>{state.nextActivity.title}</strong>
            </div>
          )}
        </div>

        {/* Non-Travel Visual Stage (House / Compass / Sparkles) */}
        {!isTravel && !isBefore && (
          <div className="lively-stage">
            {showOvernight ? (
              <div className="lively-house-stage">
                <Lottie file="Blue House.json" className="lively-house" />
              </div>
            ) : state.kind === "after" ? (
              <div className="lively-icon-stage">
                <Sparkles size={64} strokeWidth={1.2} />
              </div>
            ) : (
              <div className="lively-icon-stage">
                <Compass size={76} strokeWidth={1} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Bleed Bottom Half Scenic Stage for Travel (Goes behind buttons) */}
      {isTravel && (
        <div className="lively-scenic-backdrop" aria-hidden="true">
          <div className="lively-sun" />

          {/* Far Green Mountains */}
          <div className="lively-parallax-layer mountains-far">
            <GreenMountainFar />
            <GreenMountainFar />
          </div>

          {/* Near Lush Green Hills */}
          <div className="lively-parallax-layer hills-near">
            <GreenMountainNear />
            <GreenMountainNear />
          </div>

          {/* Wind Speed Streaks (Moving Left as Bike Rides Right) */}
          <div className="lively-wind-streaks">
            <span />
            <span />
            <span />
          </div>

          {/* Bike Sitting Right on Top of the Road, Inverted Horizontally */}
          <div className="lively-bike-wrapper">
            <Lottie file="Bike.json" className="lively-bike" />
          </div>

          {/* Full-Width Highway Road Under the Buttons */}
          <div className="lively-highway-road">
            <div className="lively-road-dashes" />
          </div>
        </div>
      )}

      {isBefore && <TripPrepScene />}

      {/* Floating Bottom Action Footer (Sits cleanly above scenery) */}
      {!readOnly && <footer className="lively-actions">
        {mapUrl && (
          <a
            className="lively-map-pin"
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in Maps"
            onClick={(event) => {
              const destination = state.activity?.type === "TRAVEL"
                ? state.activity.destination
                : state.activity?.location || stay?.location;
              if (!destination) return;
              event.preventDefault();
              void getLiveDirectionsUrl(destination).then((url) => window.open(url, "_blank", "noopener,noreferrer"));
            }}
          >
            <MapPin size={17} />
          </a>
        )}

        {isTravel && state.activity && (
          <button
            className="lively-primary-action"
            disabled={mutation === state.activity.id}
            onClick={onDone}
          >
            <Check size={16} />
            <span>{mutation === state.activity.id ? "Saving…" : "Reached?"}</span>
          </button>
        )}

        {state.activity && state.activity.type !== "TRAVEL" && state.activity.type !== "STAY" && (
          <button
            className="lively-primary-action"
            disabled={mutation === state.activity.id}
            onClick={onDone}
          >
            <Check size={16} />
            <span>{mutation === state.activity.id ? "Saving…" : "Done?"}</span>
          </button>
        )}

        {isStay && stay && (
          <button
            className="lively-primary-action lively-stay-action"
            disabled={mutation === stay.id || stay.status === "done"}
            onClick={() => onStayDone(stay.id, "Settled in")}
          >
            <Check size={16} />
            <span>
              {stay.status === "done"
                ? "Settled in"
                : mutation === stay.id
                ? "Saving…"
                : "Settled in"}
            </span>
          </button>
        )}
      </footer>}
    </article>
  );
}

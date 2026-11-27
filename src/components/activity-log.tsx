"use client";

import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const CSS = `
/* ───────────── Page shell ───────────── */

.al-page {
  --bg: #f4f5f0;
  --surface: #fdfdf9;
  --panel: #ffffff;
  --ink: #14201c;
  --muted: #6a746f;
  --line: #e7e9e2;
  --soft: #f3f4ee;
  --accent: #1f7a66;
  --red: #7a1f1f;
  --pad: 20px;

  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: var(--bg);
  color: var(--ink);
  padding: max(10px, env(safe-area-inset-top)) 10px max(24px, env(safe-area-inset-bottom));
  -webkit-tap-highlight-color: transparent;
}

.al-card {
  width: 100%;
  max-width: 720px;
  background: var(--surface);
  border-radius: 28px;
  border: 1px solid rgba(20, 32, 28, 0.05);
  box-shadow: 0 1px 2px rgba(20, 32, 28, 0.04), 0 18px 48px -24px rgba(20, 32, 28, 0.18);
  padding: 22px var(--pad) 28px;
  animation: al-cardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes al-cardIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}

@media (min-width: 768px) {
  .al-page { --pad: 36px; padding: 40px 24px 56px; }
  .al-card { padding-top: 32px; border-radius: 32px; }
}

/* ───────────── Header ───────────── */

.al-header {
  position: relative;
  padding: 4px 4px 18px;
  text-align: center;
}

.al-logo {
  display: block;
  margin: 0 auto;
}

.al-back {
  position: absolute;
  top: 4px;
  left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--red);
  color: var(--bg);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.al-back:hover { background: var(--soft); }
.al-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.al-eyebrow {
  display: block;
  margin-top: 26px;
  font-size: 11.5px;
  letter-spacing: 0.14em;
  font-weight: 700;
  color: var(--muted);
}

.al-title {
  margin: 8px 0 0;
  font-size: clamp(30px, 8vw, 44px);
  line-height: 1.04;
  letter-spacing: -0.035em;
  font-weight: 600;
}

.al-subtitle {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.5;
}

/* ───────────── Filters ───────────── */

.al-filters {
  position: sticky;
  top: 0;
  z-index: 10;
  margin: 0 calc(var(--pad) * -1) 8px;
  padding: 10px 0;
  background: rgba(253, 253, 249, 0.82);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  backdrop-filter: blur(14px) saturate(1.4);
  border-bottom: 1px solid transparent;
}

.al-chipRow {
  display: flex;
  gap: 6px;
  padding: 0 var(--pad);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.al-chipRow::-webkit-scrollbar { display: none; }

.al-filterChip {
  position: relative;
  flex: 0 0 auto;
  scroll-snap-align: center;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
  border-radius: 999px;
  padding: 0;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.25s ease, border-color 0.25s ease, transform 0.15s ease;
}
.al-filterChip:active { transform: scale(0.96); }
.al-filterChip[data-active="true"] { color: #fff; border-color: var(--ink); }
.al-filterChip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.al-filterPill {
  position: absolute;
  inset: -1px;
  border-radius: 999px;
  background: var(--ink);
}

.al-filterLabel {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
}

.al-filterLabel em {
  font-style: normal;
  font-size: 11.5px;
  min-width: 20px;
  text-align: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(20, 32, 28, 0.07);
  transition: background 0.25s ease;
}
.al-filterChip[data-active="true"] .al-filterLabel em { background: rgba(255, 255, 255, 0.2); }

/* ───────────── Timeline ───────────── */

.al-timeline { padding-top: 6px; }

.al-day { margin-top: 20px; }
.al-day:first-child { margin-top: 8px; }

.al-dayLabel {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 4px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.al-dayLabel span {
  font-size: 11px;
  letter-spacing: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--soft);
}

.al-list { display: flex; flex-direction: column; }

.al-item {
  --tone: #5b6560;
  --tone-bg: #eceee8;
  position: relative;
  padding-left: 50px;
  padding-bottom: 12px;
}

.al-item[data-tone="created"] { --tone: #1f7a66; --tone-bg: #dff0ea; }
.al-item[data-tone="updated"] { --tone: #2f5fd0; --tone-bg: #e4ebfb; }
.al-item[data-tone="deleted"] { --tone: #c0392b; --tone-bg: #fbe6e3; }
.al-item[data-tone="joined"] { --tone: #7a4fc4; --tone-bg: #eee6fa; }
.al-item[data-tone="imported"] { --tone: #a86a00; --tone-bg: #fbefd5; }
.al-item[data-tone="restructured"] { --tone: #0e7490; --tone-bg: #dcf1f6; }

.al-item::before {
  content: "";
  position: absolute;
  left: 17px;
  top: 48px;
  bottom: -2px;
  width: 2px;
  border-radius: 32px;
  background: linear-gradient(var(--line), var(--line));
}
.al-item:last-child { padding-bottom: 0; }
.al-item:last-child::before { display: none; }

.al-node {
  position: absolute;
  left: 0;
  top: 9px;
  width: 36px;
  height: 36px;
  border-radius: 32px;
  display: grid;
  place-items: center;
  color: var(--tone);
  background: var(--tone-bg);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
}
.al-item[data-open="true"] .al-node {
  transform: scale(1.1) rotate(-4deg);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--tone) 14%, transparent);
}

.al-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease;
}
.al-item[data-open="true"] .al-panel {
  border-color: color-mix(in srgb, var(--tone) 35%, var(--line));
  box-shadow: 0 12px 28px -18px color-mix(in srgb, var(--tone) 55%, transparent);
}
@media (hover: hover) {
  .al-panel:hover { transform: translateY(-1px); box-shadow: 0 10px 24px -18px rgba(20, 32, 28, 0.35); }
}

.al-head {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease;
}
.al-head:active { background: var(--soft); }
.al-head:focus-visible { outline: 2px solid var(--tone); outline-offset: -2px; border-radius: 18px; }

.al-headText { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

.al-kicker {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--tone);
}

.al-headline {
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.al-sub {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.al-headSide {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding-top: 1px;
}

.al-time {
  font-size: 9px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.al-chevron {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 39px;
  color: var(--muted);
  background: var(--soft);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease, color 0.25s ease;
}
.al-item[data-open="true"] .al-chevron {
  transform: rotate(180deg);
  background: var(--tone-bg);
  color: var(--tone);
}

/* ───────────── Expanded body ───────────── */

.al-bodyInner {
  padding: 14px 14px 16px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.al-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.al-metaChip {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 4px 10px;
  border-radius: 999px;
  color: var(--tone);
  background: var(--tone-bg);
}

.al-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
@media (min-width: 420px) {
  .al-facts { grid-template-columns: 1fr 1fr; }
  .al-wide { grid-column: 1 / -1; }
}

.al-fact {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--soft);
  min-width: 0;
}
.al-factIcon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: var(--panel);
  color: var(--tone);
}
.al-factLabel {
  display: block;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.al-factValue {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

/* notes */

.al-notes { display: flex; flex-direction: column; gap: 10px; }

.al-lead {
  margin: 0;
  padding: 11px 13px;
  border-radius: 14px;
  background: var(--tone-bg);
  color: color-mix(in srgb, var(--tone) 70%, var(--ink));
  font-size: 11.5px;
  font-weight: 550;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.al-noteBlock { display: flex; flex-direction: column; gap: 5px; }
.al-noteBlock p {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.55;
  color: #3a4642;
  overflow-wrap: anywhere;
}
.al-noteLabel {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.al-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.al-tag {
  font-size: 10.5px;
  font-weight: 550;
  padding: 5px 10px;
  border-radius: 10px;
  background: var(--soft);
  border: 1px solid var(--line);
}

/* generic rows */

.al-rows { margin: 0; display: flex; flex-direction: column; }
.al-rowLine {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
  font-size: 11.5px;
}
.al-rowLine:last-child { border-bottom: 0; }
.al-rowLine dt { color: var(--muted); flex: 0 0 auto; }
.al-rowLine dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }

/* restructure callout */

.al-callout {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 16px;
  background: var(--soft);
}
.al-calloutBig {
  flex: 0 0 auto;
  width: 62px;
  height: 62px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  align-content: center;
  background: var(--tone);
  color: #fff;
}
.al-calloutBig small { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.8; }
.al-calloutBig b { font-size: 24px; line-height: 1; letter-spacing: -0.02em; }
.al-calloutText { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.al-calloutText b { font-size: 16px; font-weight: 650; overflow-wrap: anywhere; }
.al-calloutText small { color: var(--muted); font-size: 13px; }

/* stats */

.al-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.al-stat {
  padding: 14px;
  border-radius: 16px;
  background: var(--soft);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.al-stat b { font-size: 28px; line-height: 1.05; letter-spacing: -0.03em; color: var(--tone); }
.al-stat small { font-size: 12.5px; color: var(--muted); font-weight: 550; }

/* info note */

.al-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 13px;
  border-radius: 14px;
  background: var(--soft);
  color: var(--muted);
}
.al-note svg { flex: 0 0 auto; margin-top: 2px; color: var(--tone); }
.al-note p { margin: 0; font-size: 13.5px; line-height: 1.5; }

/* member */

.al-person { display: flex; align-items: center; gap: 12px; }
.al-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 17px;
  color: #fff;
  background: var(--tone);
}
.al-person b { display: block; font-size: 15px; }
.al-person small { color: var(--muted); font-size: 13px; }

.al-rawText { margin: 0; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }

/* raw disclosure */

.al-raw summary {
  cursor: pointer;
  list-style: none;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.al-raw summary::-webkit-details-marker { display: none; }
.al-raw summary::before {
  content: "›";
  display: inline-block;
  transition: transform 0.2s ease;
}
.al-raw[open] summary::before { transform: rotate(90deg); }
.al-raw pre {
  margin: 8px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: #101a17;
  color: #cfe9df;
  font-size: 11.5px;
  line-height: 1.55;
  overflow-x: auto;
  max-height: 220px;
}

/* ───────────── States ───────────── */

.al-skeletons { display: flex; flex-direction: column; gap: 12px; padding-top: 12px; }
.al-skeleton {
  height: 74px;
  border-radius: 18px;
  background: linear-gradient(100deg, var(--soft) 30%, #fafbf7 50%, var(--soft) 70%);
  background-size: 220% 100%;
  animation: al-shimmer 1.3s ease-in-out infinite;
}
@keyframes al-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}

.al-error {
  margin-top: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #fbe6e3;
  color: #8f2418;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.al-error p { margin: 0; font-size: 14px; font-weight: 550; }
.al-error button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  padding: 8px 14px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: #c0392b;
  cursor: pointer;
}
.al-error button:active { transform: scale(0.96); }

.al-empty {
  margin-top: 18px;
  padding: 36px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 1px dashed var(--line);
  border-radius: 22px;
}
.al-emptyIcon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--soft);
  color: var(--accent);
  margin-bottom: 6px;
}
.al-empty b { font-size: 16px; }
.al-empty p { margin: 0; color: var(--muted); font-size: 14px; }

/* ───────────── Reduced motion ───────────── */

@media (prefers-reduced-motion: reduce) {
  .al-card,
  .al-skeleton { animation: none; }
  .al-node,
  .al-chevron,
  .al-panel,
  .al-filterChip { transition: none; }
}
`;

/* ────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────── */

type ActivityEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
};

type Data = Record<string, unknown>;
type Category = "created" | "updated" | "deleted" | "restructured" | "imported" | "joined" | "other";
type FilterKey = "all" | Category;

type Row = {
  ev: ActivityEvent;
  date: Date;
  category: Category;
  data: Data | null;
  headline: string;
  sub?: string;
  index: number;
};

/* ────────────────────────────────────────────────────────────
   Category config
──────────────────────────────────────────────────────────── */

const CATEGORY_ORDER: Category[] = ["created", "updated", "deleted", "restructured", "imported", "joined", "other"];

const CATEGORY_META: Record<Category, { label: string; filter: string; icon: IconName }> = {
  created: { label: "Created", filter: "Created", icon: "plus" },
  updated: { label: "Updated", filter: "Updated", icon: "pencil" },
  deleted: { label: "Deleted", filter: "Deleted", icon: "trash" },
  restructured: { label: "Restructured", filter: "Restructured", icon: "shuffle" },
  imported: { label: "Imported", filter: "Imported", icon: "download" },
  joined: { label: "Joined", filter: "Members", icon: "userPlus" },
  other: { label: "Activity", filter: "Other", icon: "activity" },
};

function categorize(action: string): Category {
  const a = action.toLowerCase();
  if (a.includes("restructur")) return "restructured";
  if (a.includes("join")) return "joined";
  if (a.includes("import")) return "imported";
  if (a.includes("delet") || a.includes("remov")) return "deleted";
  if (a.includes("creat") || a.includes("add")) return "created";
  if (a.includes("updat") || a.includes("edit") || a.includes("chang")) return "updated";
  return "other";
}

/* ────────────────────────────────────────────────────────────
   Small helpers
──────────────────────────────────────────────────────────── */

const isObj = (v: unknown): v is Data => typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown): string | undefined => {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  return undefined;
};

function humanize(key: string) {
  const spaced = key
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function sentenceCase(v: string) {
  if (v === v.toUpperCase()) return v.charAt(0) + v.slice(1).toLowerCase();
  return v;
}

function cleanLocation(v?: string) {
  return v ? v.replace(/^in\s+/i, "") : undefined;
}

function parseDetails(raw: string): Data | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (isObj(v)) return v;
  } catch {
    /* not JSON — handled by caller */
  }
  return null;
}

function formatDate(v: string, short = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-IN", short ? { day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(v: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return v;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

function timeRange(start?: string, end?: string) {
  return [start && formatTime(start), end && formatTime(end)].filter(Boolean).join(" – ");
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function flatten(value: unknown, prefix = ""): { label: string; value: string }[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [{ label: prefix, value: value.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") }];
  }
  if (isObj(value)) {
    return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix} › ${humanize(k)}` : humanize(k)));
  }
  const str = String(value).trim();
  if (!str) return [];
  return [{ label: prefix, value: /^\d{4}-\d{2}-\d{2}$/.test(str) ? formatDate(str) : str }];
}

function splitNotes(notes: string): { label?: string; text: string }[] {
  const re = /(?:^|\.\s+)([A-Z][A-Za-z/ ]{1,24}):\s/g;
  const marks: { label: string; start: number; textStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(notes))) {
    marks.push({ label: m[1], start: m.index + (m[0].startsWith(".") ? 1 : 0), textStart: m.index + m[0].length });
  }
  if (!marks.length) return [{ text: notes }];
  const out: { label?: string; text: string }[] = [];
  const lead = notes.slice(0, marks[0].start).trim();
  if (lead) out.push({ text: lead });
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : notes.length;
    out.push({ label: mk.label, text: notes.slice(mk.textStart, end).trim() });
  });
  return out;
}

/* ────────────────────────────────────────────────────────────
   Row description (headline + subtitle by activity type)
──────────────────────────────────────────────────────────── */

function describe(ev: ActivityEvent, category: Category, d: Data | null): { headline: string; sub?: string } {
  const title = d ? text(d.title) : undefined;

  switch (category) {
    case "created":
    case "updated": {
      const sub = d
        ? [text(d.date) && formatDate(text(d.date)!, true), timeRange(text(d.startTime), text(d.endTime)), cleanLocation(text(d.location))]
            .filter(Boolean)
            .join(" · ")
        : "";
      return { headline: title ?? `Itinerary ${category === "created" ? "item created" : "item updated"}`, sub: sub || undefined };
    }
    case "deleted":
      return { headline: title ?? "Itinerary item removed", sub: title ? "Removed from the plan" : "Removed from the plan" };
    case "joined": {
      const name = d ? text(d.memberName) : undefined;
      return { headline: name ? `${name} joined the trip` : "A member joined", sub: "Via invite code" };
    }
    case "imported": {
      const parts = d
        ? Object.entries(d)
            .filter(([, v]) => typeof v === "number")
            .map(([k, v]) => `${v} ${humanize(k).toLowerCase()}`)
        : [];
      return { headline: "Itinerary imported", sub: parts.join(" · ") || undefined };
    }
    case "restructured": {
      const kind = d ? text(d.kind) : undefined;
      const added = d && isObj(d.added) ? d.added : null;
      const label = kind === "add-day" ? "Day added" : kind ? humanize(kind) : "Itinerary restructured";
      const loc = added ? text(added.location) : undefined;
      const dayNo = added ? text(added.dayNumber) : undefined;
      return { headline: loc ? `${label} · ${loc}` : label, sub: dayNo ? `Now Day ${dayNo}` : undefined };
    }
    default:
      return { headline: `${humanize(ev.action)} ${ev.entityType}`.trim() };
  }
}

/* ────────────────────────────────────────────────────────────
   Icons (inline, zero dependencies)
──────────────────────────────────────────────────────────── */

type IconName =
  | "plus" | "pencil" | "trash" | "shuffle" | "download" | "userPlus" | "activity"
  | "chevron" | "pin" | "clock" | "calendar" | "route" | "info" | "refresh" | "wallet";

const ICON_PATHS: Record<IconName, string[]> = {
  plus: ["M12 5v14", "M5 12h14"],
  pencil: ["M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"],
  trash: ["M3 6h18", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", "M10 11v6", "M14 11v6", "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"],
  shuffle: ["M16 3h5v5", "M4 20 21 3", "M21 16v5h-5", "M15 15l6 6", "M4 4l5 5"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  userPlus: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M19 8v6", "M22 11h-6"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  chevron: ["M6 9l6 6 6-6"],
  pin: ["M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  calendar: ["M8 2v4", "M16 2v4", "M3 8h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  route: ["M5 12h14", "M13 6l6 6-6 6"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
  refresh: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
  wallet: ["M20 7H5a2 2 0 0 1 0-4h13v4", "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1", "M16 14h.01"],
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────
   Detail blocks
──────────────────────────────────────────────────────────── */

function Fact({ icon, label, value, wide }: { icon: IconName; label: string; value: string; wide?: boolean }) {
  return (
    <div className={`al-fact ${wide ? "al-wide" : ""}`}>
      <span className="al-factIcon"><Icon name={icon} size={15} /></span>
      <div>
        <small className="al-factLabel">{label}</small>
        <b className="al-factValue">{value}</b>
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return (
    <dl className="al-rows">
      {rows.map((r, i) => (
        <div className="al-rowLine" key={`${r.label}-${i}`}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Notes({ notes }: { notes: string }) {
  const sections = splitNotes(notes);
  return (
    <div className="al-notes">
      {sections.map((s, i) => {
        if (!s.label) {
          return <p className="al-lead" key={i}>{s.text}</p>;
        }
        const asTags = /stops?|highlights?|places?/i.test(s.label) && s.text.includes(";");
        return (
          <div className="al-noteBlock" key={i}>
            <span className="al-noteLabel">{s.label}</span>
            {asTags ? (
              <div className="al-tags">
                {s.text.replace(/\.$/, "").split(";").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <span className="al-tag" key={t}>{t}</span>
                ))}
              </div>
            ) : (
              <p>{s.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ACTIVITY_KEYS = ["id", "title", "type", "commitment", "travelMode", "status", "date", "startTime", "endTime", "location", "origin", "destination", "notes"];

function ActivityDetails({ d }: { d: Data }) {
  const chips = ["type", "commitment", "travelMode", "status"].map((k) => text(d[k])).filter(Boolean) as string[];
  const date = text(d.date);
  const time = timeRange(text(d.startTime), text(d.endTime));
  const location = cleanLocation(text(d.location));
  const origin = text(d.origin);
  const destination = text(d.destination);
  const notes = text(d.notes);
  const rest = flatten(Object.fromEntries(Object.entries(d).filter(([k]) => !ACTIVITY_KEYS.includes(k))));

  return (
    <>
      {chips.length > 0 && (
        <div className="al-chips">
          {chips.map((c) => (
            <span className="al-metaChip" key={c}>{sentenceCase(c)}</span>
          ))}
        </div>
      )}
      <div className="al-facts">
        {date && <Fact icon="calendar" label="Date" value={formatDate(date)} />}
        {time && <Fact icon="clock" label="Time" value={time} />}
        {location && <Fact icon="pin" label="Location" value={location} />}
        {(origin || destination) && <Fact wide icon="route" label="Route" value={`${origin ?? "—"}  →  ${destination ?? "—"}`} />}
      </div>
      {notes && <Notes notes={notes} />}
      <Rows rows={rest} />
    </>
  );
}

function RestructureDetails({ d }: { d: Data }) {
  const kind = text(d.kind);
  const added = isObj(d.added) ? d.added : null;
  const shifted = text(d.shiftedDays);
  const budget = text(d.budgetImpact);
  const kindLabel = kind === "add-day" ? "Day added" : kind ? humanize(kind) : "Restructured";
  const used = ["kind", "added", "shiftedDays", "budgetImpact"];
  const rest = flatten(Object.fromEntries(Object.entries(d).filter(([k]) => !used.includes(k))));

  return (
    <>
      {added && (
        <div className="al-callout">
          <div className="al-calloutBig">
            <small>Day</small>
            <b>{text(added.dayNumber) ?? "–"}</b>
          </div>
          <div className="al-calloutText">
            <span className="al-metaChip">{kindLabel}</span>
            <b>{text(added.location) ?? "New day"}</b>
            {text(added.date) && <small>{formatDate(text(added.date)!)}</small>}
          </div>
        </div>
      )}
      {!added && <div className="al-chips"><span className="al-metaChip">{kindLabel}</span></div>}
      {shifted && (
        <div className="al-stats">
          <div className="al-stat">
            <b>{shifted}</b>
            <small>days shifted later</small>
          </div>
        </div>
      )}
      {budget && (
        <div className="al-note">
          <Icon name="wallet" size={16} />
          <p>{budget}</p>
        </div>
      )}
      <Rows rows={rest} />
    </>
  );
}

function ImportedDetails({ d }: { d: Data }) {
  const nums = Object.entries(d).filter(([, v]) => typeof v === "number") as [string, number][];
  const rest = flatten(Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v !== "number")));
  return (
    <>
      <div className="al-stats">
        {nums.map(([k, v]) => (
          <div className="al-stat" key={k}>
            <b>{v}</b>
            <small>{humanize(k)}</small>
          </div>
        ))}
      </div>
      <Rows rows={rest} />
    </>
  );
}

function JoinedDetails({ d }: { d: Data }) {
  const name = text(d.memberName) ?? "Someone";
  const rest = flatten(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "memberName")));
  return (
    <>
      <div className="al-person">
        <span className="al-avatar">{name.charAt(0).toUpperCase()}</span>
        <div>
          <b>{name}</b>
          <small>Joined the trip using an invite code</small>
        </div>
      </div>
      <Rows rows={rest} />
    </>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="al-note">
      <Icon name="info" size={16} />
      <p>{children}</p>
    </div>
  );
}

function Details({ row }: { row: Row }) {
  const { data, category, ev } = row;
  const empty = !data || Object.keys(data).length === 0;

  let body: ReactNode;
  if (!data) {
    body = ev.details?.trim() ? <p className="al-rawText">{ev.details}</p> : <EmptyNote>No additional details were recorded.</EmptyNote>;
  } else if (category === "deleted" && empty) {
    body = <EmptyNote>This item was removed from the itinerary. No further details were recorded.</EmptyNote>;
  } else if (empty) {
    body = <EmptyNote>No additional details were recorded.</EmptyNote>;
  } else if (category === "restructured") {
    body = <RestructureDetails d={data} />;
  } else if (category === "imported") {
    body = <ImportedDetails d={data} />;
  } else if (category === "joined") {
    body = <JoinedDetails d={data} />;
  } else if (category === "created" || category === "updated" || category === "deleted" || text(data.title) || text(data.date)) {
    body = <ActivityDetails d={data} />;
  } else {
    body = <Rows rows={flatten(data)} />;
  }

  return (
    <div className="al-bodyInner">
      {body}
      {data && !empty && (
        <details className="al-raw">
          <summary>Raw data</summary>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Timeline item
──────────────────────────────────────────────────────────── */

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 28, delay: Math.min(i, 10) * 0.045 },
  }),
};

function TimelineItem({ row, open, onToggle, reduce }: { row: Row; open: boolean; onToggle: () => void; reduce: boolean }) {
  const meta = CATEGORY_META[row.category];
  const time = row.date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const panelId = `activity-panel-${row.ev.id}`;

  return (
    <motion.div
      className="al-item"
      data-tone={row.category}
      data-open={open}
      variants={itemVariants}
      custom={row.index}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      <span className="al-node"><Icon name={meta.icon} size={17} /></span>
      <div className="al-panel">
        <button type="button" className="al-head" onClick={onToggle} aria-expanded={open} aria-controls={panelId}>
          <span className="al-headText">
            <span className="al-kicker">{meta.label}</span>
            <span className="al-headline">{row.headline}</span>
            {row.sub && <span className="al-sub">{row.sub}</span>}
          </span>
          <span className="al-headSide">
            <time className="al-time" dateTime={row.ev.createdAt}>{time}</time>
            <span className="al-chevron"><Icon name="chevron" size={18} /></span>
          </span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              id={panelId}
              style={{ overflow: "hidden" }}
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ height: { type: "spring", stiffness: 320, damping: 36 }, opacity: { duration: 0.22 } }}
            >
              <Details row={row} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────── */

export function ActivityLog({ tripId }: { tripId: string }) {
  const reduce = !!useReducedMotion();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    fetch("/api/trips/" + tripId + "/activity")
      .then(async (response) => {
        const body = (await response.json()) as { events?: ActivityEvent[]; error?: string };
        if (cancelled) return;
        if (response.ok) {
          setEvents(body.events || []);
          setStatus("ready");
        } else {
          setError(body.error || "Unable to load the activity log.");
          setStatus("error");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load the activity log.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, reloadKey]);

  const rows = useMemo<Omit<Row, "index">[]>(() => {
    return [...events]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((ev) => {
        const data = parseDetails(ev.details);
        const category = categorize(ev.action);
        return { ev, date: new Date(ev.createdAt), category, data, ...describe(ev, category, data) };
      });
  }, [events]);

  const filters = useMemo(() => {
    const counts = new Map<Category, number>();
    rows.forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));
    return [
      { key: "all" as FilterKey, label: "All", count: rows.length },
      ...CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({ key: c as FilterKey, label: CATEGORY_META[c].filter, count: counts.get(c) ?? 0 })),
    ];
  }, [rows]);

  const groups = useMemo(() => {
    let index = 0;
    const out: { key: string; label: string; rows: Row[] }[] = [];
    rows
      .filter((r) => filter === "all" || r.category === filter)
      .forEach((r) => {
        const key = dayKey(r.date);
        let g = out[out.length - 1];
        if (!g || g.key !== key) {
          g = { key, label: dayLabel(r.date), rows: [] };
          out.push(g);
        }
        g.rows.push({ ...r, index: index++ });
      });
    return out;
  }, [rows, filter]);

  return (
    <main className="al-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="al-card">
        <header className="al-header">
          <button
            type="button"
            className="al-back"
            onClick={() => window.location.assign(`/?trip=${encodeURIComponent(tripId)}&view=analytics`)}
            aria-label="Back to analytics"
          >
            ←
          </button>
          <Image className="al-logo" src="/logo.png" alt="Routivity" width={150} height={54} priority />
          <span className="al-eyebrow">ACTIVITY LOG</span>
          <h1 className="al-title">Every change, visible.</h1>
        </header>

        {status === "ready" && rows.length > 0 && (
          <div className="al-filters">
            <LayoutGroup id="activity-filters">
              <div className="al-chipRow" role="toolbar" aria-label="Filter activity">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className="al-filterChip"
                    data-active={filter === f.key}
                    aria-pressed={filter === f.key}
                    onClick={(e) => {
                      setFilter(f.key);
                      setOpenId(null);
                      e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
                    }}
                  >
                    {filter === f.key && (
                      <motion.span layoutId="filter-pill" className="al-filterPill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                    <span className="al-filterLabel">
                      {f.label}
                      <em>{f.count}</em>
                    </span>
                  </button>
                ))}
              </div>
            </LayoutGroup>
          </div>
        )}

        {status === "loading" && (
          <div className="al-skeletons" aria-busy="true" aria-label="Loading activity">
            {[0, 1, 2, 3].map((i) => (
              <div className="al-skeleton" key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="al-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)}>
              <Icon name="refresh" size={15} /> Try again
            </button>
          </div>
        )}

        {status === "ready" && rows.length === 0 && (
          <div className="al-empty">
            <span className="al-emptyIcon"><Icon name="activity" size={22} /></span>
            <b>No activity yet</b>
            <p>Changes to the plan will show up here as they happen.</p>
          </div>
        )}

        {status === "ready" && rows.length > 0 && (
          <div key={filter} className="al-timeline">
            {groups.map((g) => (
              <section className="al-day" key={g.key}>
                <h2 className="al-dayLabel">
                  {g.label}
                  <span>{g.rows.length}</span>
                </h2>
                <div className="al-list">
                  {g.rows.map((r) => (
                    <TimelineItem key={r.ev.id} row={r} reduce={reduce} open={openId === r.ev.id} onToggle={() => setOpenId((cur) => (cur === r.ev.id ? null : r.ev.id))} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

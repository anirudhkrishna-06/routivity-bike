# Bike Trip Management Platform: Feature Documentation

**Doc version:** 1.2 · **Date:** November 2026 · **Status:** Source of truth for scope (derived from PRD v1.1, plus the new context-aware dashboard and map-link features)

> **Principle:** Local-first for responsiveness, cloud-authoritative for correctness, conflict-aware for collaboration.
>
> **Financial chain:** Budget → Expense → Payment → Settlement. These are four different concepts and are never conflated.

---

## 0. How to read this document

- Every feature has an ID (`F2.3`) so it can be referenced from issues, PRs and tests.
- **All features listed here are in scope.** Build order is defined in [section 14](#14-build-roadmap); nothing is dropped, only sequenced.
- **Out of scope:** GPS and live location, in-app navigation or route guidance, photos or any media storage (including expense attachments), meal scheduling, social features, UPI integration, AI chatbot, push notifications.
- Opening an **external Google Maps link** is *not* navigation or GPS. The app never reads the device location and never draws routes itself.

### What changed in v1.2

| Change | Where |
| --- | --- |
| Time-aware "Trip Now" dashboard (travel, stay, exploration, rest, pre/post-trip) | F6 |
| Google Maps deep links from CSV (`maps_url`, `via_points`, stay links) with safe fallback generation | F1.4, F6.5 |
| Activity status (planned / in progress / done / skipped) | F1.9 |
| Fuel expense fields (bike, litres, odometer) for real-mileage intelligence | F2.9, F10 |
| Open PRD questions turned into default decisions | [section 15](#15-decisions-and-open-points) |

---

## 1. Global rules (apply to every feature)

| # | Rule |
| --- | --- |
| G1 | All money is stored and computed as **integer paise**. No floating point anywhere in money paths. |
| G2 | Split remainders use the **largest-remainder method**; ties broken by `member_id` ascending. Shares always sum exactly. |
| G3 | A budget is an **expectation, never a restriction**. No expense is ever blocked by a budget. |
| G4 | Financial records are **append-only**. Edits create revisions; deletes are reversals with a mandatory reason. |
| G5 | Every mutation writes an **audit event** with the real actor, in the same database transaction. |
| G6 | Every mutation carries a client-generated **idempotency key** (UUIDv7). Retries never duplicate. |
| G7 | The server is the **financial source of truth**. Redis is disposable. A stale cache never confirms a financial write. |
| G8 | Every protected server operation checks **trip membership**. UI hiding is not authorisation. |
| G9 | Transfers between participants are **never** counted as trip expenses. |
| G10 | Forecasts and projections are always labelled **estimates**, visually distinct from actuals. |
| G11 | Nothing is silently moved, deleted or overwritten. Destructive or restructuring actions are previewed and confirmed. |
| G12 | The app is usable **offline** for everything except first-time sign-in and invitation acceptance. |

---

## 2. Roles and participants (F0)

| ID | Feature |
| --- | --- |
| F0.1 | **Authentication:** sign-in with email magic link or OAuth (decision in M0). Secure session cookies. |
| F0.2 | **Trip creation:** creator becomes owner. Trip is created via CSV import (F1) or an empty trip wizard. |
| F0.3 | **Participant ≠ app user ≠ actor.** A participant can exist with no account or device. Expenses and settlements can be attributed to them. The audit log records the real actor. |
| F0.4 | **Invitations:** secure, expiring, single-use links. Accepting links an authenticated account to an existing participant record, which immediately shows their historical shares and balance. |
| F0.5 | **Membership status:** active / inactive. Removing a participant never deletes their financial history. |
| F0.6 | **Permissions:** all active members have equal editing rights. Owner additionally manages members, trip settings, trip deletion and settlement-reversal approval. |
| F0.7 | **Trip settings:** name, dates, currency, timezone, alert thresholds, rounding rules (fixed), export access. |

**Worked example:** A pays ₹2,000 for a stay shared with B, and A records it. A: paid 2,000, share 1,000, net +1,000. B: paid 0, share 1,000, net −1,000. B never opens the app.

---

## 3. Screen map

### 3.1 Navigation

Five tabs: **Home · Itinerary · Expenses · Settlement · Activity log**. A persistent central **+** opens Add Expense / Add Activity. The trip header and **More** menu hold settings, members, bikes, budgets, thresholds, exports, and sync status.

### 3.2 Screens

| Area | Screens |
| --- | --- |
| Access | Sign-in · Accept invite · **Trip hub (main dashboard)** |
| Import | Template download · Upload · Validation results · Preview and correct · Confirm |
| Home | **Trip Now dashboard** · Day summary · Budget health sheet |
| Itinerary | Day list · Day detail · Activity detail/edit · Add/duplicate activity · Conflict sheet · Add/remove-day wizard · Proposed-changes diff · Undo history |
| Expenses | Ledger · Add/edit expense · Expense detail with revisions · Reverse dialog · Analytics · Chart drill-down |
| Budget | Overview · Category rules · Day/activity allocations · Budget change history · Thresholds |
| Settlement | Live balances · Start round · Review suggestions · Record transfer · Confirm receipt · Close round · Round history · Final summary |
| Activity log | Filterable feed · Event detail (before/after) |
| More | Trip settings · Members and invites · Bikes · Exports · Sync status · Offline queue · Conflict centre |

---

## 4. F1: CSV import and itinerary

### 4.1 Features

| ID | Feature | Details |
| --- | --- | --- |
| F1.1 | **Official CSV template** | Downloadable template plus a worked sample trip. Ships in `/public/templates/`. Also used as a test fixture. |
| F1.2 | **Import wizard** | Upload → parse → validate → preview → correct in-app → confirm → create trip. |
| F1.3 | **Row-level validation** | Every error and warning names the row, column, and a human-readable fix. Import cannot commit while errors remain. Warnings can be accepted. |
| F1.4 | **Map links in CSV** | Optional `maps_url`, `via_points`, `stay_maps_url`. If absent, the app **generates** a Google Maps link from origin/destination/location. See 4.3. |
| F1.5 | **Day-wise itinerary** | Each day: date, day number, start location, destination, planned distance, ordered activities, associated stay, daily planned budget. |
| F1.6 | **Activity CRUD** | Add, edit, delete, duplicate, reorder, move to another day, change times. Required: title, type, date. Everything else optional. |
| F1.7 | **Overlap detection** | Any save that causes a time overlap shows a warning and opens the conflict sheet (F9). Never silently blocks or changes. |
| F1.8 | **Safe deletion** | Deleting an activity with linked expenses preserves the expenses and forces a choice: unlink or reassign. |
| F1.9 | **Activity status** | `PLANNED / IN_PROGRESS / DONE / SKIPPED`. Derived from time by default, user can override. Drives the Now dashboard (F6). Status is app-managed, exported to CSV, not required on import. |
| F1.10 | **Add or remove a day, extend or shorten trip** | Calendar dates and day numbers recompute. Full behaviour in F9. |
| F1.11 | **Bike assignment per activity** | Travel activities reference a bike, which drives fuel budget derivation (F3). |
| F1.12 | **Itinerary CSV export** | Always reflects the latest saved itinerary, budgets and statuses. Round-trippable with import. |

### 4.2 CSV schema

One file, one header row, logical sections identified by `record_type`. Columns not relevant to a record type are blank.

| record_type | Purpose | Columns used |
| --- | --- | --- |
| `TRIP` | Trip configuration | `trip_name, start_date, end_date, creator_name, currency, timezone` |
| `MEMBER` | Participants (creator included) | `member_id, member_name, member_email` |
| `BIKE` | Bike and fuel assumptions | `bike_id, assigned_member_id, bike_model, mileage_kmpl, fuel_price_per_litre` |
| `BUDGET` | Category budget rules | `category, budget_type, planned_amount, applicable_to` |
| `STAY` | Accommodation | `stay_id, stay_name, stay_address, check_in, check_out, stay_maps_url` |
| `ACTIVITY` | Itinerary | `activity_id, day_number, date, activity_type, title, start_time, end_time, origin, destination, distance_km, location, via_points, maps_url, bike_id, stay_id, planned_budget, flexibility, movable, duration_min, depends_on, notes` |

**Enums**

- `activity_type`: `TRAVEL, STAY, EXPLORATION, CUSTOM`
- `budget_type`: `PER_NIGHT, PER_DAY, TOTAL, DERIVED`
- `flexibility`: `FIXED, PREFERRED, FLEXIBLE` (default `FLEXIBLE`)
- `movable`: `YES, NO` (default `YES` unless `FIXED`)
- `category`: `STAY, FOOD, FUEL, EXPLORATION, BIKE_MAINTENANCE, PARKING_TOLLS, MISCELLANEOUS, CUSTOM`

**Formats:** dates `YYYY-MM-DD`; times `HH:mm` (24h, interpreted in the trip timezone); `via_points` pipe-separated (`Bellary|Hospet`); amounts in rupees (decimals allowed, converted to paise on import).

**Validation rules**

| Rule | Severity |
| --- | --- |
| Exactly one `TRIP` row | Error |
| Unique `member_id`, `bike_id`, `stay_id`, `activity_id` | Error |
| Valid dates, times, enums; `end_date ≥ start_date`; activity dates inside trip range | Error |
| `assigned_member_id`, `bike_id`, `stay_id` references exist | Error |
| Travel activity has origin and destination | Error |
| `end_time` after `start_time` (same day) | Warning |
| Travel with `bike_id` and `distance_km` but also `planned_budget` differing from derived fuel cost | Warning (derived value wins; user can accept) |
| `maps_url` not on the allowed Google Maps hosts | Warning (link is dropped, fallback generated) |
| Duplicate overlapping activities on one day | Warning |
| Stay check-in/out inconsistent with activity dates | Warning |
| Unknown columns | Warning (ignored, listed in summary) |
| Anything dropped during import | Never silent. Always listed in the import summary. |

### 4.3 Maps link handling

| Case | Behaviour |
| --- | --- |
| `maps_url` provided and host is allowed (`google.com/maps`, `maps.app.goo.gl`, `goo.gl/maps`) | Use as-is. |
| Travel activity, no `maps_url` | Generate: `https://www.google.com/maps/dir/?api=1&origin=<origin>&destination=<destination>&waypoints=<via_points>&travelmode=two-wheeler` (values URL-encoded). |
| Exploration / custom with `location` | Generate a search link: `https://www.google.com/maps/search/?api=1&query=<location>`. |
| Stay | Use `stay_maps_url`, else generate a search link from `stay_name + stay_address`. |
| Opening | `target="_blank" rel="noopener noreferrer"`. Opens the Maps app on mobile. The PWA never requests location permission. |

---

## 5. F2: Expense tracking, splitting and financial calculations

*The most reliable module in the product.*

| ID | Feature | Details |
| --- | --- | --- |
| F2.1 | **Add expense (fast path)** | Amount-first form, big numeric keypad, recent categories, default payer = current user, default participants = all active members. Targets ≤ 4 taps for the common case. |
| F2.2 | **Fields** | Amount, description (optional), category, paid-by (one or more, each with amount), participants, split method, date, optional activity link, entered-by (system). |
| F2.3 | **Categories** | Stay, Fuel, Bike maintenance, Exploration/Tickets, Food, Parking/Tolls, Shopping, Miscellaneous, plus custom. |
| F2.4 | **Payment scenarios** | One pays for all · one pays for some · multiple contribute · any member can enter on behalf of any payer. |
| F2.5 | **Split methods** | Equal · exact amounts · percentages. Live validation shows "assigned / remaining". Exclude specific participants. |
| F2.6 | **Timing** | Pre-trip, during-trip and post-trip expenses are all supported and tagged automatically by date vs trip dates. |
| F2.7 | **Validation before commit** | `amount = Σ shares` and `amount = Σ payments`, enforced client-side (UX) and server-side (authority). |
| F2.8 | **Atomic write** | One DB transaction: validate → expense → shares → payment contributions → audit event → version bumps → commit. Any failure rolls back everything. |
| F2.9 | **Fuel expense extras** | For category Fuel: optional `bike_id`, `litres`, `odometer_km`. Powers real-mileage intelligence (F10). Never required. |
| F2.10 | **Edit** | Creates a revision: original preserved, changed fields and editor recorded, affected balances recalculated in the same transaction. |
| F2.11 | **Reverse / delete** | Requires a reason. The original remains visible, marked reversed, with the reversal entry linked. |
| F2.12 | **Ledger** | Chronological, server-paginated, filterable by participant, date, category, linked activity, reversed status. Each row shows payers, shares, revisions and settlement references. |
| F2.13 | **Balances** | `B_i = P_i − S_i`, adjusted by confirmed settlements. Computed transactionally and cached as a versioned snapshot. |
| F2.14 | **Duplicate protection** | Idempotency key per submission. Retried identical requests return the original result, never a second expense. |
| F2.15 | **Inactive participants** | Shares can be assigned to people who never use the app. Their balances are fully computed and visible to them on joining. |

---

## 6. F3: Budget engine

The itinerary holds **planned** budgets. The ledger holds **actual** spending. They are maintained independently and compared continuously.

```
Variance = Actual − Planned      (+ over budget · − under budget · 0 on budget)
```

| ID | Feature | Details |
| --- | --- | --- |
| F3.1 | **Budget rules** | Per category: type, amount, scope. Stored as `budget_rules`, with history. |
| F3.2 | **Calculation methods** | Fuel: distance ÷ mileage × fuel price (per bike, summed). Stay: nights × per-night. Food: trip days × daily allowance. Exploration, maintenance, parking/tolls, misc: manual. |
| F3.3 | **Allocations** | Rules materialise into `budget_allocations` assigned to days or activities. Recomputed when the itinerary changes (day insertion, distance edit, mileage change). |
| F3.4 | **Fuel derivation** | Planned fuel for a travel leg is **derived**, never typed. 320 km ÷ 40 km/L × ₹103 = ₹824. Computed in paise with round-half-up per leg. |
| F3.5 | **Planned vs actual** | Overall, per category, per day, per stay, per bike. Shows planned, actual, variance, variance %, utilisation %. |
| F3.6 | **Health status** | Default thresholds: < 80% within, 80–100% approaching, > 100% over. Configurable per trip. |
| F3.7 | **Budget history** | Changing a rule never touches past expenses. Every change is logged with old/new values, actor and effective date. Example: food ₹500 → ₹600/day mid-trip is recorded; earlier days keep ₹500. |
| F3.8 | **Never blocking** | Exceeding budget only produces alerts (G3). |
| F3.9 | **Alerts** | Update after expense sync, evaluated per category, per day and overall. |
| F3.10 | **Budget editing UI** | Rules screen with live preview of the new planned total before saving. |

---

## 7. F4: Settlement, partial payments and rounds

| ID | Feature | Details |
| --- | --- | --- |
| F4.1 | **Live balances** | Per participant: paid, share, net, settled, outstanding. Updates with every committed expense or confirmed payment. |
| F4.2 | **Suggested transfers** | Greedy matching (largest creditor ↔ largest debtor) by default. **Exact minimum-transfer** mode for groups ≤ 10: partition into the maximum number of zero-sum subsets, so transfers = n − zero-sum groups. |
| F4.3 | **Start round** | Takes an immutable **snapshot** of outstanding balances at that instant. |
| F4.4 | **Review suggestions** | Shows who pays whom and how much; overpayment prevented. |
| F4.5 | **Record transfers** | Full or partial. Sender records, receiver confirms. |
| F4.6 | **Confirm** | Only confirmed transfers change outstanding balances. **Pending transfers never reduce confirmed balances.** |
| F4.7 | **On-behalf recording** | Any authorised member can record or confirm a transfer for a participant who has no account. Flagged "recorded/confirmed on behalf of" with the real actor shown. |
| F4.8 | **Close round** | Records outcome and retains the original snapshot. Unsettled remainders carry forward. |
| F4.9 | **Multiple rounds** | Expenses added after a round flow into the next. |
| F4.10 | **Immutability** | Completed settlements can't be silently edited. Reversal requires a reason and approval by the counterparty or the owner. |
| F4.11 | **History** | All rounds viewable with their snapshots and payments. |
| F4.12 | **Final settlement** | Recalculate, account for confirmed payments, generate final transfers, confirm, produce final summary and report (F10). |
| F4.13 | **Reconciliation check** | Σ balances = 0 always. Any violation raises a blocking integrity alert for the owner. |

---

## 8. F5: Local-first sync, idempotency and audit logs

### 8.1 Architecture

```
Device (Next.js PWA + IndexedDB)  ──ops──▶  Sync API (Next.js route handlers)  ──tx──▶  PostgreSQL (truth)
        ▲                                                                                  │
        └──────────── pull by cursor ◀── realtime hint (SSE/polling) ◀── outbox ◀─────────┘
                                   Redis: cache + coordination only
```

### 8.2 Features

| ID | Feature | Details |
| --- | --- | --- |
| F5.1 | **Local write path** | Validate locally → write to IndexedDB → enqueue operation → optimistic UI → attempt sync. |
| F5.2 | **Operation envelope** | `{ opId (UUIDv7), trip_id, actor_id, type, entity, entity_id, base_version, payload, client_ts }`. |
| F5.3 | **Idempotency** | Server keeps `ops(opId unique)`. A replayed op returns the stored result. Required for 100% duplicate prevention. |
| F5.4 | **Versioning** | Every entity has an integer `version`. Updates send `base_version`. |
| F5.5 | **Server cursor** | Per-trip monotonic `seq` for every committed change. Clients pull `since=<seq>` incrementally, resumable. |
| F5.6 | **Transactional outbox** | Change events are written in the same transaction as the data. Delivery to realtime is derived from the outbox, so nothing is lost if a client was offline. |
| F5.7 | **Realtime hint** | Push (SSE or hosted pub/sub) tells clients "new seq available", followed by a pull. Short polling fallback while foregrounded. Redis Pub/Sub is only an accelerator, never the guarantee. |
| F5.8 | **Sync triggers** | App launch, foreground, network regained, after local write, manual refresh, periodic while visible. Never rely only on Background Sync (not reliable on iOS). |
| F5.9 | **Sync states** | Local only · Syncing · Synced · Failed (retry) · Conflict. Failures show reason (validation, permission, blocked by earlier op). |
| F5.10 | **Independent operations** | Separate expense additions never conflict. |
| F5.11 | **Audit log** | Every event stores: event ID, trip ID, actor ID, type, entity ref, timestamp, before/after. Written in the same transaction as the change. |
| F5.12 | **Two logs** | Application activity log (all meaningful changes) and the expense ledger (financial chronology), see F2.12. |
| F5.13 | **Cache invalidation** | Event-driven, version-aware, only affected keys. Redis keys include the trip data version. |
| F5.14 | **Protocol versioning** | `X-Sync-Protocol` header so older cached clients degrade gracefully after deploys. |

### 8.3 Audit events

Trip created · Member added/removed · CSV imported · Activity created/edited/moved/deleted · Itinerary restructured/undone · Budget rule changed · Expense created/edited/reversed · Settlement initiated/closed · Payment recorded/confirmed/reversed · Sync conflict resolved.

---

## 9. F6: Mobile-first dashboards and the "Trip Now" engine

This is the headline experience. The dashboard answers **Where are we? What is happening now? What is next? How are we doing financially?** using the device clock and the itinerary, with no GPS.

### 9.1 Two dashboards

| Dashboard | Purpose |
| --- | --- |
| **Main dashboard (Trip hub)** | Lists the user's trips. The live or next trip appears as a compact **Now card** (same engine, smaller). Shows sync status and pending items. |
| **Trip dashboard (Home tab)** | Full Trip Now experience for one trip. |

### 9.2 The Now engine

A **pure, deterministic function**, testable without a UI:

```
getTripNow(trip, days, activities, stays, nowInstant, overrides) → TripNowState
```

**Clock rules**

- `now` = device clock converted into the **trip timezone** (from CSV). Day boundaries use trip-local dates.
- If the device timezone differs from the trip timezone, a small banner reads "Showing trip time (Asia/Kolkata)".
- Re-evaluated on app open, foreground, every minute while visible, and after any data change.
- Works fully **offline** from IndexedDB.
- A **Preview as…** developer/debug control lets you set a simulated date and time to test every state without waiting for the real trip.

**Current/next selection**

1. Take today's activities, ordered by `start_time` (untimed ones by sequence).
2. **Current** = status `IN_PROGRESS`, or now within `[start, end]` (or `start + duration`), not DONE/SKIPPED.
3. **Next** = earliest upcoming not DONE/SKIPPED.
4. If an activity's end has passed but it's not marked done, it stays current through a grace window (default 30 min, configurable), then the card asks "Did this happen?" with **Done / Skipped / Still going**.
5. If nothing remains today, show the evening/stay state and a **tomorrow preview**.

### 9.3 Trip phases and what each shows

| Phase | Trigger | Primary card | Quick actions |
| --- | --- | --- | --- |
| **Pre-trip** | Before start date | Countdown, trip summary, planned budget, who has joined, itinerary completeness hints (e.g. "3 activities have no time") | Add pre-trip expense, edit itinerary, invite |
| **Day before** | Evening before a day | Tomorrow's plan, first departure time, route link | Edit tomorrow |
| **Morning, before first activity** | Day started, first activity not begun | First activity with start time and countdown | Open map link, edit |
| **Travelling** | Current activity is `TRAVEL` | See 9.4 | Add Fuel, Toll/Parking, Food, Mark done |
| **Exploring** | Current is `EXPLORATION`/`CUSTOM` | Title, location, time window, notes, ticket budget | Open map link, Add Tickets/Food, Mark done |
| **Free time / between** | Gap between activities | "Next at 4:00 PM" plus remaining day plan | Add expense, Add activity |
| **At stay / evening** | Stay activity current, or after last activity | Stay name, address, check-in/out, map link, stay-expense nudge | Add Stay expense, Open map link |
| **Day wrap-up** | After last activity | Day spend vs daily budget, expenses count, tomorrow preview | Review today's ledger |
| **Rest day** | Day with no travel activity | Stay plus optional activities | Add activity |
| **Post-trip** | After end date | Final totals, settlement status | Start/continue settlement, export report |

Nudges (e.g. "No stay expense recorded for tonight") are **soft, dismissible, in-app only**, and never block anything.

### 9.4 Travelling card (example: Chennai → Hampi, 06:00–13:00)

When the phone is opened at, say, 09:40 on that day, the dashboard shows:

| Element | Source |
| --- | --- |
| Route title "Chennai → Hampi", day X of N | Activity origin/destination |
| Window "06:00–13:00 · 3h 20m left" | Start/end vs now |
| **Open in Google Maps** (primary button) | `maps_url` or generated two-wheeler directions link with `via_points` |
| Planned distance and bike/rider | `distance_km`, `bike_id`, assigned member |
| Expected fuel for this leg and estimated cost | distance ÷ mileage × price |
| Destination stay card (name, address, check-in time, **Open stay in Maps**) | `STAY` record |
| Quick actions | Add Fuel (pre-fills bike and category), Add Toll/Parking, Add Food, **Arrived / Mark done** |
| Today's spend so far vs today's planned budget | Ledger and allocations |

Pressing **Arrived** marks the leg DONE and transitions the card to the At-stay or Exploring state.

### 9.5 Trip dashboard components (always available below the Now card)

| Component | Contents |
| --- | --- |
| Trip status | Day X of N, dates, participants, planned budget |
| Today overview | Planned distance, today's timeline strip, accommodation, today's spend |
| Financial snapshot | Total spend, budget remaining, budget health badge, **my** outstanding balance, group settlement status |
| Insights strip | Top 1–2 active insights (F7) |
| Sync indicator | Synced / N pending / N need attention |

### 9.6 Data and performance rules

- Derived from existing records. No duplicated copies of data.
- Dashboard server read ≤ 300 ms from cache; the client renders instantly from IndexedDB, then reconciles.
- No full-ledger fetch for the dashboard. Uses aggregates.

---

## 10. F7: Detailed analytics and insights

### 10.1 Analytics

| Group | Metrics |
| --- | --- |
| Overall | Planned, actual, remaining, utilisation %, total paid, average per day, average per participant, projected final (estimate) |
| Category | Amount and % of total |
| Participant | Paid, share, net, outstanding, settled, expenses contributed, category-wise personal spend |
| Time | Daily, cumulative, weekly, pre-trip vs during-trip, highest/lowest day |
| Planned vs actual | Trip, category, day, stay, fuel, exploration |
| Bike and fuel | Planned distance, recorded distance, expected fuel, estimated vs actual cost, mileage assumptions per bike |

**Requirements:** filters by date, participant and category; charts honour active filters; every chart value drills into its underlying transactions; totals reconcile with the ledger to the paisa; transfers excluded; actual vs projected always visually distinct; server-side aggregated SQL; cached per filter key with versioned invalidation.

### 10.2 Insights engine (rule-based, deterministic, no AI)

| ID | Feature |
| --- | --- |
| F7.1 | Rule templates with parameters, e.g. "Food exceeded the daily allowance by ₹250", "Stay spending is 12% above plan", "Fuel is below estimate", "75% of budget spent", "At the current rate the trip may exceed budget by ₹2,000". |
| F7.2 | Severity levels (info / watch / alert), deduplicated, with cool-downs so the same insight doesn't repeat. |
| F7.3 | Each insight links to the exact transactions or budget rule behind it. |
| F7.4 | Forecast insights labelled **estimate** and suppressed when there is too little data (e.g. before day 2). |
| F7.5 | Dismissible per user. Dismissal doesn't hide underlying alerts in the Budget screen. |
| F7.6 | Recomputed after committed changes arrive via sync. |

---

## 11. F8: Offline queue and conflict centre

| ID | Feature | Details |
| --- | --- | --- |
| F8.1 | **Offline-first reads** | Trip, itinerary, budgets, ledger (recent window), balances and dashboards all come from IndexedDB. |
| F8.2 | **Offline writes** | Expenses, activity edits, status changes, settlement records can be queued while offline. Entered data survives app restarts. |
| F8.3 | **Offline queue screen** | Lists every pending op with type, time, state, and error reason. Actions: retry, retry all, discard (only for ops never accepted by the server). |
| F8.4 | **Dependency-aware replay** | Ops replay in order per entity. If an op fails, dependent ops are marked **blocked** with the reason instead of failing silently. |
| F8.5 | **Conflict detection** | Server rejects stale `base_version` writes into the conflict flow. Non-overlapping field edits on the same entity are **auto-merged** field-by-field. Overlapping edits become conflicts. |
| F8.6 | **Conflict centre** | Per conflict: your version, their version, base, who changed what and when. Actions: **keep mine** (re-applied on latest), **keep theirs**, **merge field by field**. Resolution is itself audited. |
| F8.7 | **Financial conflicts** | Concurrent edits to one expense always surface for review. They are never auto-merged. Concurrent additions never conflict. |
| F8.8 | **Status visibility** | Global sync pill in the header. Per-record badge on anything not yet synced. |
| F8.9 | **Storage safety** | Request persistent storage; warn if the browser may evict data; one-tap "export unsynced changes" as JSON for emergency recovery. |
| F8.10 | **Reconnect reconciliation** | On network return: push queue, pull since cursor, rebuild derived caches, show a summary of what changed. |

---

## 12. F9: Advanced scheduling, diff and undo

### 12.1 Conflict handling when a slot is occupied

On overlap, the engine identifies affected activities, tests feasibility, and offers only feasible options:

1. **Reschedule the existing activity** into another slot that day or a compatible later day.
2. **Move it to another day** suggested by location, free time and travel plans.
3. **Replace** the existing activity.
4. **Choose manually.**

If an activity can't be moved, the sheet says why (e.g. "fixed time", "depends on A004", "no compatible Hampi day") and asks for a manual decision.

### 12.2 Constraint model

| Constraint | Meaning |
| --- | --- |
| Location compatibility | An activity belongs to a location. It can only land on a day whose destination is compatible. Never silently moved to an unrelated city. |
| Time availability | Enough free minutes in the target window, given duration. |
| Travel feasibility | Not placed on a day when the group is mid-transit between towns, unless the activity is on the route. |
| Dependencies | `depends_on` stay, travel leg or preceding activity must remain valid. |
| Priority | `FIXED` never moves. `PREFERRED` moves only with confirmation. `FLEXIBLE` can be proposed to move. |

**Solver priority order:** (1) preserve fixed date/time, (2) preserve travel legs and destination continuity, (3) preserve location-specific activities on compatible days, (4) respect durations and windows, (5) place flexible activities in free slots, (6) minimise changes to the existing plan. A scoring function ranks alternative schedules.

### 12.3 Adding a day or extending the trip

Example: on Day 2 the group adds another halt in Hampi.

1. Insert a new day after Day 2 with destination Hampi.
2. Shift all later dates and renumber days.
3. Re-evaluate activities on affected days.
4. Recompute travel legs, distances and fuel estimates.
5. Recompute stays: check-in/out dates and night counts.
6. Recompute daily and trip planned budgets.
7. Propose Hampi-compatible activities for the new day.
8. Flag activities now infeasible.
9. Show a **proposed itinerary diff** for approval.

It does **not** blindly push everything one day later. Result: Day 2 Hampi, **new Day 3 Hampi**, Day 4 Mysuru, Day 5 Coorg, with dependencies recomputed.

### 12.4 Diff and approval

| ID | Feature |
| --- | --- |
| F9.1 | Proposed-changes screen groups: added, moved, re-timed, couldn't be accommodated, travel/stay changes, **budget impact** (planned total before → after). |
| F9.2 | Per-change accept/reject where changes are independent; atomic apply when they are linked. |
| F9.3 | Activity IDs and expense links are preserved. Rescheduling **never** changes historical expenses. |
| F9.4 | Invalid linked stays or travel legs are explicitly flagged for the user. |
| F9.5 | **Undo** for any restructuring: restores prior dates, order, allocations and links as a single operation. Undo is itself audited. |
| F9.6 | Undo history list with timestamps and actors. |
| F9.7 | If constraints can't all be satisfied, the engine explains the conflicts and offers manual resolution instead of forcing a bad schedule. |
| F9.8 | Concurrency: restructuring is rejected if another participant changed the affected days after the proposal was generated, and the proposal is regenerated. |

---

## 13. F10, F11: Fuel and budget intelligence, exports, visualisations

### 13.1 F10: Fuel and budget intelligence

| ID | Feature | Details |
| --- | --- | --- |
| F10.1 | **Planned fuel per leg and per bike** | Derived from distance, mileage, fuel price. |
| F10.2 | **Actual mileage** | From Fuel expenses with litres and odometer: km between fill-ups ÷ litres. Full-tank method is optional, with a clear label of assumptions. |
| F10.3 | **Mileage drift insight** | "Actual 36 km/L vs 40 assumed." Offers **Update mileage assumption**, which recomputes remaining legs only, audited, history kept. |
| F10.4 | **Fuel price drift** | Detects actual price per litre vs assumed. Same accept flow. |
| F10.5 | **Re-forecast** | Projected final spend = spent to date + remaining planned, adjusted by the observed variance ratio per category. Explainable, labelled estimate, hidden when data is insufficient. |
| F10.6 | **Recorded distance** | Optional per-day actual km (manual or derived from odometer entries). Compared with planned. |
| F10.7 | **Daily allowance tracker** | For food: today's remaining allowance and running over/under, carried across days optionally. |
| F10.8 | **What-if (read-only)** | Preview budget effect of a rule change before saving. |

### 13.2 Exports

| Export | Format | Notes |
| --- | --- | --- |
| Itinerary | CSV | Re-importable. Reflects latest saved state. |
| Expense ledger | CSV | Includes revisions, reversals and settlement references. |
| Participant-wise summary | CSV | Paid, share, net, settled, outstanding, by category. |
| Settlement history | CSV | All rounds with snapshots and payments. |
| Budget vs actual | CSV | Trip, category and day. |
| Activity log | CSV | Full audit feed with before/after. |
| Final trip financial report | PDF plus CSV bundle (ZIP) | Reconciliation block (Σ expenses, Σ paid, Σ balances = 0), generated-at and data version. |

Exports run from the server (authoritative). When offline, they are generated from local data and stamped **"as of last sync"**.

### 13.3 F11: Advanced visualisations

| ID | Visual | Purpose |
| --- | --- | --- |
| F11.1 | Category donut | Share of spend by category. |
| F11.2 | Cumulative spend line | Actual vs planned vs forecast band, with the forecast clearly dashed and labelled. |
| F11.3 | Daily spend bars with daily-budget line | Overspend days stand out. |
| F11.4 | Planned vs actual bullet bars | Per category and per day. |
| F11.5 | Participant paid-vs-share diverging bars | Who fronted money vs who owes. |
| F11.6 | Settlement flow graph | Before/after "who pays whom", with arrows and amounts. |
| F11.7 | Calendar heatmap | Spend by trip day. |
| F11.8 | Fuel per bike | Planned vs actual litres and cost, mileage trend. |
| F11.9 | Trip timeline strip | Days as segments (route chain `Chennai → Hampi → Mysuru`) with per-day spend. A text/graphic strip, **not a map**. |
| F11.10 | Budget gauge | Utilisation against thresholds. |

**Visual requirements:** all charts respect global filters; tap-to-drill into transactions; table view toggle for accessibility; colour-blind-safe palette; dark mode; skeleton loading; heavy chart bundles dynamically imported; touch-friendly tooltips.

---

## 14. Build roadmap

Sync is a **foundation, not a late feature**: from M1 all writes go through the local op queue, so offline and multi-device behaviour never needs a retrofit.

| Milestone | Scope | Exit criteria |
| --- | --- | --- |
| **M0 Foundations** | Repo, CI, auth, DB schema + migrations, money lib (paise), timezone lib, design tokens, PWA shell, test harness | `pnpm test` green in CI; sign-in works; empty trip can be created; installable PWA |
| **M1 Trip, import, itinerary** | CSV template, import wizard and validation (F1), itinerary day views, overlap warnings, IndexedDB + op queue + idempotent push/pull for itinerary | A sample CSV imports; two devices see the same itinerary |
| **M2 Expenses and audit** | F2 in full, atomic transactions, ledger, audit events, balances | Splitting property tests pass (Σ shares = Σ payments = amount, always); no duplicates on retry |
| **M3 Budget engine** | F3: rules, allocations, fuel derivation, planned vs actual, thresholds, history | Totals reconcile with ledger; mid-trip rule change leaves history intact |
| **M4 Settlement** | F4: balances, suggestions (greedy and exact), rounds, partial payments, on-behalf flow, final settlement | Σ balances = 0; pending never affects confirmed; multi-round scenario passes |
| **M5 Dashboards and Trip Now** | F6: engine, all phases, map links, main dashboard, Preview-as tool | Every phase renders correctly via simulated time; offline works |
| **M6 Analytics, insights, visuals** | F7, F11 | Charts reconcile with ledger; drill-down works; filters apply everywhere |
| **M7 Scheduling engine** | F9: conflict sheet, constraint solver, day insertion, diff, undo | "Add Hampi halt" scenario passes; no silent moves; undo restores exactly |
| **M8 Offline and conflict polish** | F8: queue screen, dependency-aware replay, conflict centre, realtime hints, storage safety | Airplane-mode test and two-device conflict test pass |
| **M9 Intelligence, exports, release** | F10, F13.2 exports, performance pass, iOS/Android PWA QA, **dry-run trip** with two devices | Acceptance checklist (section 16) fully green |

> **If you need a usable version for a real trip soon:** the "trip-ready cut" is M0 → M1 → M2 → M4 → M5, with M3's fuel derivation folded into M5. It covers import, itinerary, expenses, settlement and the live dashboard. Everything else layers on without schema changes.

### Suggested stack

Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · PostgreSQL with Drizzle ORM · Upstash Redis · Better Auth (or Auth.js) · Dexie (IndexedDB) · Serwist (service worker/PWA) · Zod (shared validation) · PapaParse (CSV) · date-fns with timezone support · Recharts (dynamically imported) · Vitest and Playwright.

### Suggested repo layout

```
src/
  app/                 # routes, layouts, server actions, route handlers
  features/
    trips/ itinerary/ expenses/ budget/ settlement/
    analytics/ dashboard/ sync/ import-export/ audit/
  lib/
    money/             # paise math, splits, rounding
    time/              # trip-timezone helpers
    now-engine/        # getTripNow (pure)
    scheduler/         # constraint solver (pure)
    settlement-engine/ # greedy + exact (pure)
    csv/               # parse, validate, generate
    maps/              # link generation + host allowlist
  db/                  # schema, migrations, queries
  sync/                # op queue, push/pull, conflict logic
docs/
  features.md
public/templates/      # CSV template + sample trip
```

The **pure engines** (`money`, `now-engine`, `scheduler`, `settlement-engine`, `csv`, `maps`) hold the product's risk. They get property-based and scenario tests before any UI depends on them.

---

## 15. Decisions and open points

### Decided defaults (change only with an explicit ADR)

| Topic | Decision |
| --- | --- |
| Split rounding | Largest remainder; ties by `member_id` ascending |
| Fuel rounding | Round half up to the paisa, per travel leg |
| Settlement reversal | Any member may propose; sender/receiver counterparty or owner approves |
| Non-app participants | Others may record and confirm on their behalf (flagged) |
| Maps links | External deep links only; allowlisted hosts; no location permission |
| Stale-cache rule | A cached value is never used to confirm a financial write |
| Notifications | None in V1 (in-app nudges only) |

### Still open

1. Realtime transport (hosted pub/sub vs self-run SSE): decide in M8; polling fallback exists regardless.
2. Auth method for first release (magic link vs OAuth).
3. PDF generation approach for the final report (print-styled page vs server renderer).
4. Hosting regions: verify the **actual** regions of Vercel functions, PostgreSQL and Redis, and colocate them. Choosing a Vercel region does not move the database.
5. Whether `FIXED` activities may ever be moved by an owner override.

---

## 16. Acceptance checklist (V1 release gate)

**Import and itinerary**
- [ ] One CSV creates trip, members, bikes, budgets, stays and itinerary
- [ ] Invalid rows are clearly identified with row/column and fix hints
- [ ] Nothing is silently dropped on import
- [ ] Activities can be created, edited, deleted, duplicated, reordered, moved
- [ ] Conflicting activities are detected before saving
- [ ] Activities only move to location-compatible days
- [ ] Inserting a day recalculates downstream dates, stays, distances and budgets
- [ ] Users review a diff before confirming; restructuring can be undone
- [ ] Rescheduling never changes historical expenses

**Dashboards**
- [ ] Trip Now shows the correct phase, current and next activity for any simulated date/time
- [ ] Travelling state shows the route window, map link, fuel estimate, destination stay and quick actions
- [ ] Map links open the external Maps app; no location permission is requested
- [ ] Dashboards work fully offline

**Money**
- [ ] All split methods, multiple payers and pre-trip expenses work
- [ ] Expense creation is atomic; retries never duplicate
- [ ] Participants who never use the app have correct balances
- [ ] All balances reconcile (Σ = 0); analytics reconcile with the ledger
- [ ] Planned and actual are independent; variance and alerts correct
- [ ] Budget changes are audited and never alter past expenses
- [ ] Intermediate rounds, partial payments and on-behalf confirmations work
- [ ] Pending payments never count as confirmed
- [ ] Final settlement is accurate

**Sync and audit**
- [ ] Both devices show identical, reconciled data after sync
- [ ] Offline expenses survive restart and upload without duplication
- [ ] Concurrent edits cannot silently overwrite each other
- [ ] Logs are complete and record the real actor
- [ ] No committed financial record is ever lost

**Delivery**
- [ ] All exports work and reconcile
- [ ] Targets met under realistic concurrent use (mobile load < 2.5 s, cached dashboard < 300 ms, expense write < 500 ms, realtime < 1 s, analytics < 1 s)
- [ ] Works on iOS and Android installed PWA
- [ ] Dry-run trip with two devices completed

**Definition of done:** Two or more people can simultaneously use the app, record expenses, change the itinerary, run intermediate settlements, and see identical, reconciled financial results on their own devices, including after offline periods, with the dashboard always showing what is relevant to the trip's current day and time.

# Development Plan: 5 Phases

Companion to [`docs/features.md`](./features.md). Feature IDs like `F2.8` point to that file.

Infrastructure is already set up (Render Postgres, Upstash Redis, Vercel via GitHub). This plan is **only about building features**, on production only.

---

## The 5 phases at a glance

| Phase | What you get | Main features |
| --- | --- | --- |
| **1. Base app** | Login, trips, members, the money-safe foundation | F0 |
| **2. Trip and itinerary** | Import a CSV, see and edit the itinerary, two phones stay in sync | F1, F5 (sync + audit) |
| **3. Money** | Expenses, budget, settlement | F2, F3, F4 |
| **4. Live dashboard and insights** | The "what's happening now" screen, Maps links, analytics, charts | F6, F7, F11 |
| **5. Smart extras and polish** | Smart rescheduling, offline conflict handling, fuel intelligence, exports | F8, F9, F10 |

> **Trip-ready point:** the first half of Phase 4 (the "Now" dashboard). After that, the app is usable on a real trip. Phase 5 only adds on top.

---

## Phase 1: Base app

**Goal:** people can sign in, create a trip and have members, and the core building blocks are ready.

**Build**
- Sign-in and secure sessions (F0.1)
- Participants that can exist without an account (F0.3)
- Money helper: all amounts stored in paise, splits never lose a paisa (G1, G2)
- Time helper: everything calculated in the trip's timezone
- App shell: five tabs, the central **+** button, light and dark mode, installable on the phone
- Basic "is this person a member of this trip?" check on every server action (G8)

**Done when**
- [ ] You can sign in on your phone and laptop
- [ ] The app installs to the home screen
- [ ] Splitting ₹100 among 3 people always gives amounts that add up to exactly ₹100

---

## Phase 2: Trip and itinerary

**Goal:** one CSV creates the whole trip, and the itinerary is shared between devices, even offline.

**Build**
- Trip creation, invite links, member status, trip settings (F0.2, F0.4 to F0.7)
- CSV template download and the import wizard: upload, errors shown row by row, preview, fix, confirm (F1.1 to F1.4)
- Google Maps links: use the link in the CSV, or build one automatically from origin and destination (F1.4)
- Day-by-day itinerary: add, edit, delete, duplicate, reorder, move to another day (F1.5, F1.6)
- Warning when two activities overlap (F1.7)
- Deleting an activity that has expenses asks what to do with them (F1.8)
- Activity status: planned, done, skipped (set by hand for now) (F1.9)
- Simple add and remove day (F1.10)
- Bike assignment and itinerary CSV export (F1.11, F1.12)
- **Sync:** every change is saved on the phone first, then sent to the cloud. Retrying never creates duplicates, and other members' phones update (F5.1 to F5.6, F5.8 to F5.10)
- Activity log: who changed what (F5.11, F5.12)
- Edits made offline are kept and sent when the connection returns (F8.1, F8.2 basics)

**Done when**
- [ ] The sample CSV creates a full trip
- [ ] A broken CSV shows exactly which row and column is wrong
- [ ] A change on one phone shows up on the other
- [ ] An edit made in airplane mode goes through once when you reconnect
- [ ] The exported itinerary CSV can be imported again

---

## Phase 3: Money

**Goal:** expenses, budgets and settlements that are correct to the paisa. Take extra care with this phase.

**Build**

*Expenses (F2)*
- Fast add-expense form (amount first), works offline (F2.1)
- Paid by one or many, shared by anyone, equal / exact / percentage splits, exclude people (F2.2 to F2.5)
- Pre-trip, during-trip and post-trip expenses (F2.6)
- Checks that shares and payments both equal the amount (F2.7)
- Saved all-or-nothing, with an activity log entry (F2.8)
- Fuel details: bike, litres, odometer (optional) (F2.9)
- Edit keeps history; delete is a "reverse" with a reason (F2.10, F2.11)
- Ledger with filters; running balances per person (F2.12, F2.13)
- No duplicates if you tap twice or retry (F2.14)
- People who never open the app still get correct balances (F2.15)

*Budget (F3)*
- Budget rules per category: fuel from distance and mileage, stay per night, food per day, others manual (F3.1, F3.2, F3.4)
- Planned vs actual, variance, and "within / approaching / over" status (F3.5, F3.6)
- Budget change history; budgets never block an expense (F3.7, F3.8)
- Alerts and a live preview when editing rules (F3.9, F3.10)

*Settlement (F4)*
- Live balances, suggested transfers with the fewest payments (F4.1, F4.2)
- Start a round, record full or partial payments, confirm receipt, close the round (F4.3 to F4.8)
- Confirm on behalf of someone who doesn't use the app (F4.7)
- Several rounds, history, reversals, final settlement (F4.9 to F4.12)
- Safety check: all balances always add up to zero (F4.13)

**Done when**
- [ ] Every split type works and always adds up exactly
- [ ] Two phones adding expenses at the same time both succeed
- [ ] An expense entered offline appears once on both phones later
- [ ] A pending payment doesn't change anyone's confirmed balance
- [ ] A multi-round settlement with partial payments ends at zero
- [ ] Changing the food budget mid-trip leaves past days unchanged

---

## Phase 4: Live dashboard, analytics and charts

**Goal:** the app shows the right thing for the current day and time, and explains where the money is going.

### 4A. The "Trip Now" dashboard (trip-ready point)

**Build** (F6)
- A "what's happening now" engine using the phone's clock and the trip's timezone, no GPS
- Cards for each situation: before the trip, the day before, morning, **travelling**, exploring, free time, at the stay, day wrap-up, rest day, after the trip
- **Travelling card** (for example Chennai to Hampi, 06:00 to 13:00): route and time left, **Open in Google Maps** button, planned distance, expected fuel and cost, destination stay with its own map link, quick buttons for Fuel, Toll, Food and **Arrived**
- Activity status now updates from the time, with a "Did this happen?" prompt if you forget
- Trip status, today's overview, money snapshot and sync status on the home screen
- Main dashboard listing your trips with a small "now" card
- Works offline
- A "Preview as…" control to test any date and time without waiting for the real trip

**Done when**
- [ ] Setting preview time to 09:40 on the Hampi day shows the travelling card with the right route, map link and buttons
- [ ] Every other situation shows the right card for its time
- [ ] Map links open the Maps app and the app never asks for your location

### 4B. Analytics and insights

**Build** (F7)
- Overall, category, per-person, daily/weekly, planned vs actual, and bike/fuel analytics
- Filters by date, person and category; tap any number to see the expenses behind it
- Insight messages such as "Food is ₹250 over the daily allowance"; forecasts are always labelled as estimates

### 4C. Charts

**Build** (F11)
- Category donut, cumulative spend line, daily bars with budget line, planned vs actual bars, budget gauge (F11.1 to F11.4, F11.10)
- Paid vs share per person, settlement flow, calendar heatmap, fuel per bike, trip timeline (F11.5 to F11.9). These can slip to Phase 5 if time is short.

**Done when**
- [ ] Chart and analytics totals match the ledger exactly
- [ ] Filters change every chart consistently
- [ ] The home screen loads quickly on mobile data

---

## Phase 5: Smart extras and polish

**Goal:** the advanced behaviours, and the polish that makes the app trustworthy on the road.

### 5A. Smart scheduling (F9)
- When a new activity overlaps another, a sheet offers only options that actually make sense: move it within the day, move it to another day, replace it, or choose manually (F9.1)
- Activities never move to a day in a different city, and fixed items never move (F9.2)
- **Add a day:** for example, add another halt in Hampi after Day 2. Dates, day numbers, stays, distances and budgets all recalculate (F9.3)
- A "proposed changes" screen shows what moves before anything is applied (F9.4)
- Expenses are never touched by rescheduling (F9.5)
- **Undo** for any restructuring (F9.6)

**Done when**
- [ ] "Add a Hampi halt after Day 2" gives Day 2 Hampi, a new Day 3 Hampi, then Mysuru, then Coorg
- [ ] Undo restores the exact previous plan

### 5B. Offline and conflicts (F8)
- Offline queue screen: what's waiting, what failed and why, retry (F8.3, F8.4)
- When two people edit the same thing: automatic merge if they changed different fields, otherwise a "keep mine / keep theirs / merge" screen (F8.5, F8.6)
- Expense edits that clash are always shown for review, never merged silently (F8.7)
- Sync status badges, a warning if the phone might clear stored data, and one-tap "export my unsynced changes" (F8.8, F8.9)
- A summary of what changed after reconnecting (F8.10)

**Done when**
- [ ] Two phones editing the same activity never overwrite each other silently
- [ ] Airplane-mode changes sync cleanly after reconnecting

### 5C. Fuel and budget intelligence (F10)
- Real mileage from fuel entries, compared with the assumed mileage (F10.2, F10.3)
- Fuel price changes noticed and flagged (F10.4)
- Smarter "may exceed budget by…" forecast, shown only when there is enough data (F10.5)
- Planned vs recorded distance, daily food allowance tracker, "what if" preview (F10.6 to F10.8)

### 5D. Exports
- CSVs: ledger, per-person summary, settlement history, budget vs actual, activity log
- Final trip report (PDF) with totals that reconcile

### 5E. Final polish
- Test on a real iPhone and Android
- A practice trip with two or more people, including offline moments, an itinerary change, a mid-trip settlement and a final settlement
- Walk through the full checklist in `features.md` section 16

**Done when**
- [ ] Every box in `features.md` section 16 is ticked
- [ ] The practice trip finishes with no money discrepancies

---

## Where each feature lives

| features.md | Phase |
| --- | --- |
| F0.1, F0.3 | 1 |
| F0.2, F0.4 to F0.7 | 2 |
| F1 (all, with F1.7 resolution and smart F1.10 in 5, auto-status in 4) | 2 |
| F2 | 3 |
| F3 | 3 |
| F4 | 3 |
| F5 (sync, audit) | 2 (hosted live push in 5) |
| F6 (dashboards, Trip Now) | 4 |
| F7 (analytics, insights) | 4 |
| F8 | 2 (basics), 5 (conflict centre and polish) |
| F9 | 5 |
| F10 | 3 (planned fuel), 5 (intelligence) |
| F11 | 4 (some may slip to 5) |
| Exports | 2 (itinerary CSV), 5 (the rest) |

---

## Ground rules while building

- **Only production exists**, so keep database changes safe: add new tables and columns, don't rename or delete existing ones.
- Never do money math with plain decimals; always use the money helper.
- Every new action that changes data must write an activity-log entry and check trip membership.
- Don't make big changes while a real trip is running.
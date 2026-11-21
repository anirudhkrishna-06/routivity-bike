Bike Trip Management Platform: Product Requirements Document
Version 1.1 · November 2026 · Consolidated master document (Rounds 1–3 merged, latest decisions win)
Guiding principle: The app is local-first for responsiveness, cloud-authoritative for correctness, and conflict-aware for collaboration.
Core financial separation: Budget → Expense → Payment → Settlement. These are four different concepts and must never be conflated.
1. Vision and scope
A collaborative, offline-resilient trip management app that brings itinerary planning, budgeting, expense tracking, intelligent settlements and financial analytics into one place. It must make it easy for a group of any size to plan and run a trip without coordination or financial confusion. It must be fast, minimal, reliable and expandable.
1.1 Core objectives
Create an entire trip from one CSV file.
Maintain a shared, editable, intelligent itinerary.
Maintain a budget engine that compares planned vs actual spending.
Track every trip expense, including pre-trip and post-trip.
Calculate individual balances accurately, in integer paise.
Minimise the number of transfers needed to settle.
Support partial and intermediate settlement rounds.
Provide meaningful financial analytics.
Keep a complete, auditable activity and expense history.
Keep all devices synchronised through a local-first sync engine.
Provide a premium mobile-first PWA experience (iOS and Android).
1.2 Explicit exclusions for V1
GPS and live location tracking.
Navigation and route guidance.
Photo uploads, galleries and any media storage (expense attachments included).
Meal scheduling and food planning (food is budgeted by daily allowance only).
Social features and public profiles.
UPI payment integration.
AI chatbot inside the app.
Rule: nothing is added to V1 just because it may be useful later. The data model stays extensible without making today's product complicated.
2. People, roles and access
2.1 Three distinct concepts
Concept
Definition
Trip participant
A person whose payments and shares are tracked. May never install or open the app.
Authenticated app user
A person who can log in and perform authorised operations.
Operation actor
The person who actually created or modified a record (used for audit).

Consequences:
Any authorised active member can enter an expense. The person entering it is not automatically the payer.
Payer(s), contributors and beneficiaries are independently selectable.
A participant can have expenses and settlements attributed to them without ever using the app.
If an inactive participant later joins, they see their existing records and balances after authentication and authorisation.
The audit log always records the real actor, never the attributed participant.
Worked example: A pays ₹2,000 for a stay shared with B. A records it. A: paid ₹2,000, share ₹1,000, net +₹1,000. B: paid ₹0, share ₹1,000, net −₹1,000. B did nothing in the app.
2.2 Roles
Trip creator (owner): creates the trip, configures settings, imports the CSV, invites participants, can edit all trip information, and remains owner for administrative purposes.
Participants: equal editing rights by default. They can edit the itinerary, manage activities, add/edit/delete expenses (subject to audit rules), edit budgets, start and take part in settlements, and view all analytics and the full history.
2.3 Participant record
Display name, email or login identity (optional), trip-specific role, joining date, active/inactive membership status, and app-account link (nullable). A removed participant's historical financial records stay intact.
The creator's identity is verified through the authenticated account, never trusted from a CSV email.
3. Navigation and screens
3.1 Primary navigation (five destinations)
Destination
Purpose
Home
Trip overview, next activity, financial snapshot
Itinerary
Day-wise schedule
Expenses
Ledger, budget comparison and analytics
Settlement
Balances, rounds and payments
Activity log
Complete history of changes, expenses and settlements

A persistent central + button gives quick access to Add Expense and Add Activity. Trip settings, members, bikes, budgets, thresholds, exports and sync status live in the trip header or More menu.
3.2 Screen inventory
Area
Screens
Access
Sign-in, invitation acceptance, trip list / trip switcher
Import wizard
Template download → Upload → Validation results (row-level errors) → Preview and correction → Confirm
Home
Dashboard
Itinerary
Day list, day detail, activity detail/edit, add/duplicate activity, scheduling-conflict sheet, add/remove-day wizard, proposed-itinerary diff review, undo confirmation
Expenses
Ledger (paginated, filterable), add/edit expense, expense detail with history and corrections, reverse/delete dialog (reason required), analytics, chart drill-down
Budget
Budget overview and health, category rules, allocations by day/activity, budget change history, alert thresholds
Settlement
Live balances, start round (snapshot), review suggestions, record transfer, confirm receipt, close round, round history, final settlement summary
Activity log
Filterable event feed, event detail with before/after
More
Trip settings, members and invites, bikes, exports, sync status and conflict centre, offline queue

4. Trip creation and CSV import
The CSV is the primary trip-planning interface: one consolidated file, with logical sections (not separate files) and one row per record.
4.1 Record types
record_type
Contents
TRIP
Creator, trip name, dates, currency, timezone
MEMBER
All travellers (creator included)
BIKE
Bike configuration and fuel assumptions
BUDGET
Category-wise planned budget rules
STAY
Accommodation (see note below)
ACTIVITY
Day-wise itinerary and activity details

4.2 Fields
TRIP: trip_name, start_date, end_date, creator_name, currency (default INR), timezone (e.g. Asia/Kolkata).
MEMBER: member_id (M001…), member_name, member_email (optional).
BIKE: bike_id (B001…), assigned_member_id, bike_model, mileage_kmpl, fuel_price_per_litre. One record per bike.
BUDGET: category, budget_type (PER_NIGHT, PER_DAY, TOTAL, DERIVED), planned_amount, applicable_to (ALL or a specific scope).
STAY: stay_id, accommodation name, address, check_in, check_out. Consolidation note: earlier drafts referenced stay_id on activities and listed stay fields, but no stay record existed. A STAY record type resolves this.
ACTIVITY: activity_id (A001…), day_number, date, activity_type, title, start_time, end_time, origin, destination, distance_km, bike_id, stay_id, planned_budget, notes, plus the scheduling fields below.
Scheduling fields on ACTIVITY (needed by the scheduling engine): location, flexibility (FIXED / PREFERRED / FLEXIBLE), movable_to_other_day (yes/no), duration_minutes, depends_on (activity or travel-leg ID).
Activity types: Travel, Stay, Exploration, Custom. No compulsory food or meal activities.
For Travel activities, the planned fuel budget is derived from bike mileage and fuel price, not typed in. Stays and exploration use manual or rule-based budgets.
4.3 Import workflow
Download the official CSV template.
Fill it manually or with an AI assistant (Claude / ChatGPT).
Upload the completed CSV.
Validate all records.
Show an import preview.
Flag missing, invalid or inconsistent values.
Allow in-app corrections.
Confirm import.
Create the trip (logged as a CSV-import event with a summary).
4.4 Import integrity
Stable IDs for all entities; no duplicate activity IDs.
Valid date and time formats and valid activity types.
Valid references between activities, stays, bikes and members.
No silent loss of imported information.
Clear row-level error reporting.
CSV export always reflects the latest saved itinerary, budgets included.
5. Home dashboard
The home page answers three questions immediately: Where are we? What is next? How are we doing financially? It derives everything from existing records; it keeps no separate copies of data.
Component
Contents
Trip status
Current day / total days, start and end dates, participant count, planned budget
Next activity
Title, start/end, location, type, quick edit
Daily overview
Planned distance, today's activities, accommodation, today's expenditure
Financial snapshot
Total expenditure, budget remaining, budget health, personal outstanding balance, group settlement status
Sync indicator
Synced / pending / failed counts

6. Itinerary management and scheduling engine
The itinerary is the central operational module and behaves like an intelligent schedule, not a static list.
6.1 Day structure
Each day has: date and day number, starting location, destination, planned distance, ordered activities, associated stay, and daily estimated budget.
6.2 Activity fields
Field
Required
Title
Yes
Type
Yes
Date
Yes
Start / end time
Optional
Location
Optional
Description
Optional
Estimated cost
Optional
Distance
Optional
Associated stay / bike
Optional
Flexibility (fixed / preferred / flexible)
Optional, default flexible
Movable to another day
Optional
Duration, dependency
Optional

6.3 Operations
Add, edit, delete, duplicate and reorder activities; move to another day; change times; add or remove a day; extend or shorten the trip.
6.4 Core behaviour
Reordering updates the displayed sequence immediately.
Time overlaps produce warnings and trigger the conflict flow; they never silently block or silently change things.
Changes synchronise to all participants.
Editing an activity never removes its linked expenses.
Deleting an activity with linked expenses preserves the expenses and requires an explicit unlink or reassign decision.
Activity IDs and expense links are preserved when activities are rescheduled.
6.5 Conflict handling when a slot is occupied
When a new or moved activity overlaps an existing one, the system detects the conflict, identifies affected activities, checks what is actually feasible, and presents options before applying anything:
Reschedule the existing activity: find another suitable slot that day or a compatible later day.
Move it to another day: suggested by location, free time and travel plans.
Replace the existing activity: remove the conflicting one and add the new one.
Choose manually: the user decides what to move, replace or retain.
Options are shown only if feasible. If an activity cannot be moved, the system explains why and asks the user to resolve it manually.
6.6 Location-aware constraints
An activity tied to Hampi must never roll to a day when the trip is in another city. The engine evaluates:
Location compatibility: can it realistically happen at that day's destination?
Time availability: is there enough free time?
Travel feasibility: is the group travelling between towns that day?
Dependencies: does it depend on a stay, travel leg or preceding activity?
Priority: fixed, preferred or flexible?
It must never silently move an activity to an unrelated city.
6.7 Adding a day or extending the trip
Example: on Day 2 the group decides to add another halt in Hampi. The user picks "add a day after Day 2", destination Hampi; the date is derived from the trip calendar. The system then:
Inserts the new day.
Shifts subsequent calendar dates.
Renumbers days.
Re-evaluates activities on affected days.
Recalculates travel legs, distances and fuel estimates.
Re-evaluates stays, check-in/out dates and night counts.
Recalculates daily and trip planned budgets.
Identifies activities that can move into the new day.
Flags activities now infeasible due to changed dates, locations or travel.
Presents a proposed revised itinerary for approval.
Adding a day must not simply push every activity forward by one day. Example result: Day 2 Hampi, new Day 3 Hampi, Day 4 Mysuru, Day 5 Coorg, with downstream dates and dependencies recalculated.
If a date changes, associated activities move only by explicit user action. Expenses keep their original dates unless deliberately corrected.
6.8 Scheduling algorithm and safeguards
Use a constraint-based approach with a scoring function over alternative schedules. Priority order:
Preserve fixed-date and fixed-time activities.
Preserve travel legs and destination continuity.
Keep location-specific activities on compatible destination days.
Respect durations and time windows.
Place flexible activities in available slots.
Minimise unnecessary changes.
The engine produces a proposed itinerary diff: activities added, moved, re-timed, unaccommodated, plus travel, stay and budget changes. The user must approve before commit.
Safeguards: never silently delete or move; never alter confirmed expenses; flag any stay or travel leg that becomes invalid; support undo of a restructuring; if constraints cannot all be met, explain the conflicts instead of forcing a bad schedule.
6.9 Concurrency
If two users edit the same activity simultaneously, the version conflict is detected, nothing is overwritten, and a refresh or resolution flow is offered.
7. Budget engine
The itinerary holds planned budgets and assumptions; the ledger holds actual spending. The app continuously compares the two.
Variance = Actual − Planned
Positive = over budget, negative = under, zero = on budget. Example: planned ₹30,000, actual ₹32,450, variance +₹2,450 (8.17% over; 108.17% of plan).
7.1 Calculation methods by category
Category
Method
Fuel
Distance ÷ mileage × fuel price (per bike, aggregated)
Stay
Nights × budget per night
Food
Trip days × daily allowance (no meal scheduling)
Exploration
Manually defined
Bike maintenance
Manually defined
Parking / tolls
Manually defined
Miscellaneous / custom / shopping
Manually defined (optional)

Fuel example: 320 km ÷ 40 km/L × ₹103 = ₹824. If mileage or price changes, the projection recalculates. Each bike is calculated independently. Computation is done in paise with a single documented rounding rule.
Stay example (₹1,000/night): planned ₹4,000 across four stays vs actual ₹4,300 gives +₹300 over. Per-stay and aggregate views are both shown.
A budget is an expectation, never a restriction. The app must never block an expense because a budget is exceeded.
7.2 Alerts and insights
Default thresholds (configurable): below 80% within budget; 80–100% approaching; above 100% over budget. Shown per category, per day and overall.
Automatic insights, for example: food exceeded the daily allowance by ₹250; stay spending is 12% above plan; fuel is below estimate; 75% of total budget spent; at the current rate the trip may exceed budget by ₹2,000. Forecasts are always labelled estimates, never actuals. Alerts update after expense synchronisation.
7.3 Budget data model and history
Entity
Responsibility
budget_rules
Rules such as Stay ₹1,000/night, Food ₹500/day
budget_allocations
Planned budget assigned to individual days or activities
expenses
Actual spending
expense_splits
Participant shares
payments
Actual contributions
settlements
Transfers between participants

Changing a budget never alters historical expenses. If food moves from ₹500 to ₹600/day halfway through, past expenses are unchanged and the budget change history is retained and auditable. Day or itinerary changes recompute allocations (see 6.7).
8. Expense management
The most reliable module in the product.
8.1 Expense fields
Field
Description
Amount
In integer paise of the trip currency
Description
Optional
Category
Stay, Fuel, Bike maintenance, Exploration/Tickets, Food, Parking/Tolls, Shopping, Miscellaneous, Custom
Paid by
One or more contributors, each with an amount
Participants
People sharing the cost (may include people who never use the app)
Split method
Equal, exact or percentage
Date
Pre-trip, during-trip or post-trip
Activity link
Optional
Entered by
Operation actor (system-recorded)

8.2 Required payment and split scenarios
One person pays for everyone.
One person pays for selected participants.
Multiple people contribute to one expense.
Equal split.
Exact-value split.
Percentage split.
Excluding specific participants.
Pre-trip, during-trip and post-trip expenses.
8.3 Financial correctness
Expense amount = Σ participant shares
Expense amount = Σ payments made
Both must validate before commit. All money is integer paise, never floating point. Remainders from equal or percentage splits are distributed deterministically (documented rule) so shares always sum exactly.
8.4 Editing and deletion
Original expense data is retained.
Editor and changed fields are recorded.
Affected balances are recalculated transactionally.
Deletion or reversal requires an explicit reason.
An expense never silently disappears from anyone's financial history.
9. Financial analytics
All analytics are aggregated from the ledger and must reconcile with it. Transfers between participants are never counted as trip expenses. Actual and projected values are visually distinct.
Group
Metrics
Overall
Planned budget, actual spend, remaining, utilisation %, total paid, average per day, average per participant, projected final spend
Category
Amount and % of total per category
Participant
Total paid, personal share, net balance, outstanding, settled, expenses contributed to, category-wise personal spend
Time
Daily, cumulative, weekly, pre-trip vs during-trip, highest and lowest spending day
Planned vs actual
Trip, category, day, stay, fuel, exploration
Bike and fuel
Planned distance, recorded distance (if entered), expected fuel, estimated vs actual fuel cost, mileage assumptions per bike

Requirements: filters by date, participant and category; charts reflect the active filters; every chart can drill down to its underlying transactions; analytics refresh after committed changes.
10. Settlement management
Settlement is an independent financial workflow, not just a number on the dashboard.
10.1 Live balance
B_i = P_i − S_i
P_i = total paid by participant i; S_i = total assigned shares. Positive: receives money. Negative: owes money. Confirmed settlements adjust outstanding balances.
10.2 Optimal settlement generation
Identify creditors and debtors, generate suggested transfers, minimise transfer count, prevent overpayment, and ensure transfers reconcile to outstanding balances. Use a greedy matching algorithm normally, with an exact minimum-transfer option for small groups.
10.3 Intermediate settlement rounds (mandatory)
No one has to wait until the trip ends.
Start settlement: snapshot of outstanding balances.
Review suggestions: who pays whom, and how much.
Record transfers: full or partial.
Confirm: sender records the payment; receiver confirms receipt.
Close round: record the outcome and keep full history.
Non-app participants: because a participant may never open the app, any authorised member may record or confirm a transfer on their behalf. The record is marked "confirmed on behalf of" and shows the real actor. (Consolidation decision to keep non-app participants fully supported.)
10.4 Rules
Multiple rounds and partial transfers are supported.
Pending transfers do not reduce confirmed balances.
A transfer is never a trip expense.
Completed settlements cannot be silently edited; reversals are explicit records.
Each round retains its original snapshot.
Expenses added after a round flow into the next round.
Historical rounds are viewable.
10.5 Final settlement
Recalculate balances, account for confirmed payments, generate final transfers, confirm all payments, produce a final financial summary and export the full settlement report.
11. History, audit and exports
Two distinct logs.
11.1 Application activity log
Every event carries: event ID, trip ID, actor ID, event type, entity reference, timestamp, and before/after data where applicable.
Event
Recorded
Trip created
Creator, timestamp
Member added
Member, inviter
CSV imported
Importer, summary
Activity edited / deleted / moved
Before and after, or original record, and actor
Itinerary restructured / undone
Proposed diff and approver
Budget rule changed
Old and new values
Expense created / edited / reversed
Details, changed fields, reason
Settlement initiated
Initiator, snapshot
Payment recorded / confirmed / reversed
Sender, receiver, amount, actor, on-behalf flag

11.2 Expense ledger
Chronological record of every expense: payers, participants, individual shares, category, related activity, later corrections and settlement references. Filterable by participant, date and category.
11.3 Exports
Activity log, expense ledger, participant-wise summary, settlement history, budget vs actual report, final trip financial report, and updated itinerary CSV (round-trippable with import).
12. Local-first sync and offline
Critical infrastructure. Clarification: this is synchronisation of application data only, with no media storage.
12.1 Data flow
Device (Next.js PWA, IndexedDB) → sync engine (queue, retry, conflict detection, idempotency) → cloud (Next.js server, PostgreSQL) → change notification → other members' local databases.
12.2 Local storage
IndexedDB is the persistent local database and holds: trip and members, itinerary, bikes, budget rules and allocations, expenses with contributors and splits, settlements, activity history, cached analytics and dashboards, and pending operations. The service worker handles app-shell caching and offline access. These are separate responsibilities.
12.3 Sync lifecycle
User acts.
Validate locally.
Save to IndexedDB immediately.
Enqueue a uniquely identified operation.
Update UI optimistically.
Attempt sync.
Server validates membership, permissions, business rules and versions.
Server commits transactionally to PostgreSQL.
Server acknowledges.
Local operation is marked synced.
Other members pull the change into their local databases.
12.4 Sync states
State
Meaning
Local only
Saved on this device
Syncing
Upload in progress
Synced
Confirmed by cloud
Failed
Retry available
Conflict
Needs reconciliation

A user must never lose an expense because the network dropped.
12.5 Sync protocol
Server-issued sync cursor / sequence number; incremental, resumable, versioned protocol.
PostgreSQL transactional outbox for durable change events. Redis Pub/Sub alone can miss events, so it is only an accelerator.
Realtime push or lightweight polling to notify members.
Sync on app launch, foregrounding, network restoration and manual refresh. Never rely solely on background sync, which is not guaranteed on iOS.
Idempotency keys on every mutation: retrying the same expense never duplicates it.
Entity version numbers; stale updates are rejected into the conflict flow. Independent operations (two members adding separate expenses) never conflict.
The server remains the financial source of truth.
12.6 Offline behaviour
Cache the current trip and itinerary; queue new expenses and edits offline; preserve data across app restarts; show unsynchronised changes; reconcile automatically on reconnect.
13. Technical architecture and performance
13.1 Stack (conceptual; exact transport and topology chosen during implementation)
Vercel · Next.js PWA (Server Components, Route Handlers, Server Actions) · PostgreSQL (authoritative) · Redis (disposable cache and coordination) · realtime delivery layer.
PostgreSQL is authoritative for trips, participants, itinerary, budgets, expenses, splits, settlements, audit history and sync versions. It alone must be enough to rebuild the app's state.
Redis is used for trip summaries, dashboard and analytics aggregates, balance snapshots, short-lived coordination, rate limiting, idempotency coordination and cache invalidation. Never the sole source of truth for expenses, balances or settlements, and a stale cache never confirms a financial transaction.
13.2 Atomic financial transactions
Expense creation is one database transaction: validate, create expense, create shares, create payment contributions, create audit event, increment versions, commit. Any failure rolls back everything. Settlement creation, payment recording and confirmation carry equivalent guarantees.
13.3 Read efficiency
Fetch only needed fields; server-side pagination for expense and activity histories; aggregated SQL for analytics; no full-ledger fetch for the dashboard; no N+1 queries; composite indexes on trip ID, date, category and participant; versioned cached aggregates with targeted, event-driven invalidation; connection pooling suited to serverless.
13.4 Caching
Data
Strategy
Trip metadata, dashboard
Redis cache
Itinerary
Versioned cache
Expense and audit history
Paginated PostgreSQL reads
Analytics, budget comparisons
Cached aggregate queries
Balances
Recomputed transactionally / cached snapshot
Settlement records
PostgreSQL authoritative

13.5 Regional placement
Colocate Vercel functions, PostgreSQL, Redis and any realtime service. Verify each provider's real region; choosing a Vercel region does not relocate the database or Redis.
13.6 Rendering
Server Components for initial data; Client Components only for interactivity; page-specific fetches; dynamic imports for heavy charts; small client state; no refetch of all trip data after each mutation.
13.7 Performance targets (proposed, to be measured under realistic concurrent use)
Metric
Target
Initial mobile load
Under 2.5 s on a typical connection
Cached dashboard / itinerary (server)
Under 300 ms
Normal expense write
Under 500 ms
Realtime propagation
Within 1 s under normal connectivity
Analytics page
Under 1 s for ordinary trips
Duplicate prevention
100% for retried identical requests
Consistency
No lost or double-counted committed transactions

14. Security and data integrity
Authenticated trip access; membership verified on every protected server operation.
Secure invitation links; role and ownership validation.
Server-side input validation; parameterised queries through the ORM.
Rate limiting; secure session handling.
No database or Redis credentials in client bundles.
Audit trails and transactional guarantees for financial mutations.
Explicit confirmation for destructive operations.
All trip queries scoped to the user's membership. Hiding a button is not authorisation.
15. Expandability
Future capability
Preparation
More travellers, multiple trips
Many-to-many membership; independent trip boundaries
Multiple currencies
Currency-aware money records
Multiple bikes, advanced fuel analytics
Bike entity; structured mileage and distance records
GPS integration
Optional location module
AI-assisted planning
CSV import pipeline
Notifications
Event-driven notification interface
Advanced analytics
Dedicated aggregate/read models
Photos
External reference links only, if ever

16. Acceptance criteria
V1 is ready for the real trip when all are true.
Import and trip: one CSV creates trip, members, bikes, budgets, stays and itinerary; invalid rows are clearly identified; any number of participants can join.
Itinerary and scheduling: day-by-day itinerary works; activities can be created, edited, deleted, reordered; every activity has day, date, type and timing; conflicts are detected before saving; activities move only to location-compatible days; inserting a day recalculates downstream dates and dependencies; users review a diff before confirming; restructuring can be undone; rescheduling never changes historical expenses; the dashboard shows the correct next activity; new days can be added after import.
Budget: travel activities support origin, destination and distance; fuel estimates derive from mileage and price; stay budgets work per night and food budgets per day; rules are customisable by category; planned and actual are maintained independently; category-wise and day-wise comparisons work; overspending alerts update after sync; budget changes are auditable; financial totals reconcile with the ledger.
Expenses and settlement: pre-trip expenses and all split methods work; multiple contributors work; expense tracking works for members who never use the app; all balances reconcile; intermediate rounds and partial payments work; pending payments are not counted as confirmed; final settlement is accurate; analytics reconcile with the ledger.
Sync and audit: logs are complete and record the real actor; devices show identical synchronised data; offline expenses survive restart and sync without duplication; concurrent edits cannot silently overwrite; IndexedDB is the local store and PostgreSQL the durable store; no committed financial record is silently lost; CSV and financial exports work; mobile experience works on iOS and Android.
17. Priorities
Priority
Module
P0
CSV import and itinerary (incl. conflict detection and day insertion)
P0
Expense tracking, splitting and financial calculations
P0
Budget engine (rules, planned vs actual, variance)
P0
Settlement, partial payments and rounds
P0
Local-first sync, idempotency and audit logs
P0
Mobile-first dashboard
P1
Detailed analytics and insights
P1
Full offline queue and conflict centre polish
P1
Advanced scheduling diff and undo polish
P1
Fuel and budget intelligence, exports
P2
Advanced visualisations
P2
GPS and navigation (future)

Definition of done: Two or more people can use the app simultaneously, record expenses, modify the itinerary, run intermediate settlements, and obtain identical, reconciled financial results on their devices, including after offline periods.
18. Consolidation notes and open points
Decisions made while merging; please confirm or change.
STAY record added to the CSV, since stays were referenced but never defined.
Scheduling fields added to ACTIVITY (flexibility, movable, duration, dependency) because the scheduling engine needs them.
Settlement on behalf of non-app members is allowed and flagged, so receiver confirmation does not block settlement.
Budget categories follow the budget engine list; Shopping has no default rule and is optional.
Open: rounding rule for splits and fuel (suggest largest-remainder, documented).
Open: realtime transport and sync library choice.
Open: whether any participant may reverse another's completed settlement, or only the owner.


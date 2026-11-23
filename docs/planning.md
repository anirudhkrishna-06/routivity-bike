# Current itinerary implementation

This document describes the itinerary system that exists in Routivity today. It is an implementation inventory for the next itinerary redesign. It intentionally documents the current behavior, data flow, fields, constraints, and known limitations; it is not a redesign specification.

## 1. Current user flow

The current itinerary flow has two separate stages:

1. The user creates a trip from `/trips/new`.
2. The user copies an AI prompt, fills in the placeholders, and pastes it into ChatGPT, Claude, Gemini, or another assistant.
3. The assistant returns raw CSV text.
4. The user saves that text as a `.csv` file and uploads it.
5. Routivity parses the file locally and shows a small preview.
6. The user enters a Routivity trip name, selects which CSV member represents the signed-in user, and confirms the import.
7. The server creates the trip, all calendar days between the start and end dates, members, budgets, and activities in one transaction.
8. After import, the user is returned to the main dashboard, where the Itinerary tab loads the saved activities.

CSV import is currently a trip-creation flow. It is not an in-place itinerary import or edit flow for an existing trip.

The current dashboard navigation includes Itinerary, Budget, Settlements, and Analytics. When Itinerary is active, the dashboard renders, in order:

- `ItineraryWorkspace`: saved itinerary display, day tabs, activity rows, refresh, offline cache fallback, and activity CSV export.
- `ActivityEditorPanel`: add, edit, move, duplicate, and delete controls.
- `SchedulingPanel`: preview/apply/undo for inserting a complete day.

The main itinerary display itself does not open the editor when an activity row is clicked. Editing controls are in the separate editor panel below the itinerary.

## 2. Current files and responsibilities

| Area | Current implementation |
| --- | --- |
| Create/import page | [`src/app/trips/new/page.tsx`](../src/app/trips/new/page.tsx) |
| CSV parsing and validation | [`src/lib/csv.ts`](../src/lib/csv.ts) |
| CSV template | [`public/templates/routivity-sample.csv`](../public/templates/routivity-sample.csv) |
| Example populated trip | [`public/routivity-trip.csv`](../public/routivity-trip.csv) |
| Itinerary display | [`src/components/itinerary-workspace.tsx`](../src/components/itinerary-workspace.tsx) |
| Activity editor | [`src/components/activity-editor-panel.tsx`](../src/components/activity-editor-panel.tsx) |
| Day restructuring UI | [`src/components/scheduling-panel.tsx`](../src/components/scheduling-panel.tsx) |
| Activity/day API | [`src/app/api/trips/[tripId]/activities/route.ts`](../src/app/api/trips/[tripId]/activities/route.ts) |
| Scheduling API | [`src/app/api/trips/[tripId]/schedule/route.ts`](../src/app/api/trips/[tripId]/schedule/route.ts) |
| Trip and activity server actions | [`src/app/actions/trips.ts`](../src/app/actions/trips.ts) |
| One-off itinerary change action | [`src/app/actions/itinerary.ts`](../src/app/actions/itinerary.ts) |
| Database schema | [`src/lib/db/schema.ts`](../src/lib/db/schema.ts) |

## 3. CSV input format

The parser recognizes this complete header schema:

```text
record_type,trip_name,start_date,end_date,creator_name,currency,timezone,member_id,member_name,member_email,category,budget_type,planned_amount,applicable_to,day_number,date,activity_type,title,start_time,end_time,origin,destination,location,via_points,maps_url,bike_id,status,notes
```

The CSV is a mixed-record file. Different columns are used depending on `record_type`.

### 3.1 TRIP row

There must be exactly one row with `record_type=TRIP`.

Fields consumed by the importer:

- `trip_name`: parsed and displayed in the preview, but the final trip name is taken from the separate Trip name input on the create page.
- `start_date`: required by the later server-side trip creation path.
- `end_date`: required by the later server-side trip creation path.
- `currency`: defaults to `INR` if empty.
- `timezone`: defaults to `Asia/Kolkata` if empty.
- `creator_name`: used to try to match the creator to a member row.
- `notes`: currently parsed but not persisted to the trip.

The UI requires the user to enter the final trip name separately. That value is sent as `trip.name`; the CSV `trip_name` is only used as a preview fallback.

### 3.2 MEMBER rows

Every row with `record_type=MEMBER` becomes a participant candidate.

Consumed fields:

- `member_id`: used only as a React key in the preview when present; it is not persisted as the participant ID.
- `member_name`: required.
- `member_email`: optional; used to match an existing Routivity user account when possible.

The import page asks, “Which CSV member is you?” The selected member name is sent as `authMemberName`. The server uses it, the email, or the signed-in user name to identify the owner participant. If the signed-in user cannot be matched to a supplied member, the server prepends the signed-in user as an owner participant.

### 3.3 BUDGET rows

Every row with `record_type=BUDGET` becomes a budget rule.

Consumed fields:

- `category`: required.
- `budget_type`: required; expected values are `PER_DAY`, `PER_NIGHT`, `TOTAL`, or `DERIVED` when sent to the server.
- `planned_amount`: required and parsed as rupees, then converted to paise by multiplying by 100.
- `applicable_to`: optional; `ALL` means the trip start date is used as the effective date. A valid `YYYY-MM-DD` value becomes the effective date.

The current sample uses values such as `Fuel`, `Stay`, `Food`, `Entry / Parking / Misc`, and `Buffer (10%)`. The parser validates the amount format but does not enforce a fixed category list.

### 3.4 ACTIVITY rows

Every row with `record_type=ACTIVITY` becomes an itinerary activity.

Consumed fields:

- `day_number`: parsed by the CSV preview but not used to select the database day during import.
- `date`: required and used to attach the activity to an `itinerary_days` row.
- `activity_type`: required. Supported stored values are `TRAVEL`, `STAY`, `EXPLORATION`, and `CUSTOM`.
- `title`: required.
- `start_time`: optional `HH:MM` text.
- `end_time`: optional `HH:MM` text.
- `origin`: optional, but required by validation for `TRAVEL`.
- `destination`: optional, but required by validation for `TRAVEL`.
- `location`: optional.
- `via_points`: optional semicolon-separated text; stored as text.
- `maps_url`: optional. The server builds a safe Google Maps URL from the supplied values when needed.
- `bike_id`: optional and passed through as a UUID-like value; the current import path does not validate that it belongs to a bike in the trip.
- `status`: optional; defaults to `planned`.
- `notes`: parsed by the CSV layer but not passed into the activity insert and therefore not stored in the activity table.

The database also has `distance_km_milli`, but it is not part of the parser's recognized schema. The create page contains a mapping for `distance_km`, but an unrecognized `distance_km` CSV column is warned about and ignored by the parser, so distance is not currently imported from the provided CSV schema.

## 4. AI prompt currently shown to users

The create page contains a hard-coded `AI_PROMPT_TEMPLATE`. The current opening instruction is:

> Act as a travel itinerary assistant. Generate a single CSV file formatted for the Routivity travel planner based on my trip details.

The prompt asks the user to provide:

- Trip name.
- Start and end dates.
- Creator or lead name.
- Riders/members and optional emails.
- Budget estimates.
- A short itinerary overview.

It then supplies the exact CSV header and instructs the assistant to emit:

- One `TRIP` row.
- `MEMBER` rows.
- `BUDGET` rows.
- Chronological `ACTIVITY` rows.

The activity instructions currently describe these activity types:

- `TRAVEL`.
- `STAY`.
- `EXPLORATION`.
- `CUSTOM`.

The prompt asks for activity title, day number, date, start and end time, origin, destination, location, via points, and notes. It tells the assistant to use `PLANNED` status and to output only raw CSV without Markdown or commentary.

The prompt currently does not contain a separate structured field for heritage sites, planned sightseeing details, a daily travel/transport summary, constraints, preferences, accessibility needs, or questions the assistant should ask before producing the CSV. Those details can only be placed in the general activity title, location, or notes fields.

## 5. CSV parsing and validation behavior

`parseTripCsv` uses Papa Parse with headers, skips empty lines, trims headers to lowercase, and trims string values.

The parser:

- Adds parser errors as error-level issues.
- Emits warning-level issues for unknown columns; unknown columns are ignored.
- Requires exactly one `TRIP` row.
- Groups rows into one trip, members, activities, and budgets collection.
- Normalizes activity type aliases:
  - `RIDE` and `TRIP` → `TRAVEL`.
  - `SIGHTSEEING` → `EXPLORATION`.
  - `OTHER` → `CUSTOM`.
- Normalizes activity status aliases:
  - `PLANNED` and `IN_PROGRESS` → `planned`.
  - `DONE` and `COMPLETED` → `done`.
  - `SKIPPED` → `skipped`.
- Checks duplicate `activity_id` values if such a column is present, although `activity_id` is not in the recognized schema and is therefore also reported as unknown.
- Validates Google Maps URL hosts against `google.com`, `www.google.com`, `maps.google.com`, `maps.app.goo.gl`, and `goo.gl`.
- Adds a warning when an activity end time is lexically earlier than or equal to its start time.
- Requires `origin` and `destination` for `TRAVEL` rows.
- Validates budget amounts as plain positive decimal text with up to two decimal places.
- Validates budget applicability as `ALL` or `YYYY-MM-DD`.

Warnings do not prevent import. Only issues with severity `error` block the create form.

The current import page displays at most the first six issues in the preview.

## 6. Import request and persistence

After preview validation, `/trips/new` constructs an import request containing:

```text
idempotencyKey
trip: { name, startDate, endDate, timezone, currency }
members: [{ name, email? }]
authMemberName
activities: [{ type, title, date, startTime?, endTime?, origin?, destination?, location?, viaPoints?, mapsUrl?, distanceKmMilli?, bikeId?, status? }]
budgets: [{ category, ruleType, amountPaise, effectiveFrom? }]
```

The request is sent to `POST /api/trips/import`, which calls `importTrip`.

`importTrip` runs in one database transaction:

1. Creates the `trips` row.
2. Creates one `itinerary_days` row for every date from `start_date` through `end_date`, inclusive. Day numbers are assigned sequentially starting at 1.
3. Creates participants from the member rows and links matching registered users.
4. Creates budget rules, when present.
5. Resolves each activity by its `date`, not its CSV `day_number`.
6. Inserts activities in the CSV order as their initial `sortOrder`.
7. Builds a Maps URL from the supplied URL or route/location fields.
8. Rejects an import if two activities on the same day have overlapping non-empty start/end ranges.
9. Records an audit event and an idempotency mutation.

If an activity date does not match a generated day, the current implementation falls back to the first generated day rather than rejecting the activity. The UI parser requires a date but does not validate that it falls within the trip date range.

The `idempotencyKey` prevents a retried import from creating another trip when the same key has already been recorded.

## 7. Database model

### Trip days

`itinerary_days` stores:

- `id`.
- `tripId`.
- `dayNumber`.
- `date`.
- Optional `location`.

There is a unique constraint on `(tripId, dayNumber)`.

### Activities

`activities` stores:

- `id` and `tripId`.
- `dayId` linking it to an itinerary day.
- `type`: `TRAVEL`, `STAY`, `EXPLORATION`, or `CUSTOM`.
- `title`.
- Optional `startTime` and `endTime`, stored as five-character strings.
- Optional `origin`, `destination`, `location`, `mapsUrl`, and `viaPoints`.
- Optional `distanceKmMilli` and `bikeId`.
- `status`: `planned`, `done`, or `skipped`.
- `movable`, defaulting to true.
- `archived`, defaulting to false.
- `sortOrder`.
- Created and updated timestamps.

An activity is hidden from the normal itinerary list when `archived=true`; delete is implemented as archiving rather than physical deletion.

The database does not currently have a first-class field for activity notes, sightseeing sub-items, lodging check-in/check-out semantics, travel mode, duration in minutes, or a relation between a stay and the following day.

## 8. Current itinerary display

`ItineraryWorkspace` requests `GET /api/trips/{tripId}/activities` with `cache: "no-store"`.

The API returns non-archived activities with:

- ID.
- Day number and date.
- Type and title.
- Start and end time.
- Origin and destination.
- Location and Maps URL.
- Distance and bike ID.
- Status and sort order.

The frontend groups the returned rows by the distinct `dayNumber` values present in the activity response. It does not separately fetch or render empty itinerary days. Therefore, a day with no activity does not receive a day tab in the current display.

The day selector is a horizontally scrollable row of buttons. Each button shows `DAY N` and the date of the first activity found for that day. Selecting a day filters activities to that day and sorts them by `sortOrder`.

Each activity row currently shows:

- Start time, or an em dash when no start time exists.
- Activity type.
- Title.
- A route string when both origin and destination exist, otherwise the location, otherwise `No location added`.
- An `Open in Maps` link when a Maps URL exists.
- Status text.

The current display does not show end time, duration, notes, via points, distance, a stay check-in/check-out relation, an empty-day state, or an inline add control.

The heading displays `Your saved journey`, a message, a Refresh button, and an Export button when activities exist. Initial loading uses a local-storage cache key of `routivity-itinerary-{tripId}`. If the network request fails and cached JSON exists, the UI displays the cached activities and says `Viewing cached itinerary (offline).` A successful network response replaces the cache.

## 9. Existing activity editor

`ActivityEditorPanel` is rendered below the main itinerary display. It loads the same activities endpoint independently.

The create/edit form currently contains:

- Activity title.
- Type selector: Custom, Travel, Stay, Exploration.
- Date.
- Start time.
- End time.
- Location.
- Status selector when editing: Planned, Done, Skipped.

The form does not expose origin, destination, via points, Maps URL, distance, bike, or a notes field.

### Create

The Add activity action calls `POST /api/trips/{tripId}/activities` with `operation=create`. The server checks that the date is within the trip, checks for time overlap on that day, builds a Maps URL, inserts the activity, and records an audit event.

### Edit

The Edit button pre-fills the form with the fields listed above and calls `operation=update`. The server can update the activity day when the date changes, preserves fields not included in the change, rechecks overlap, rebuilds the Maps URL, and records an audit event.

### Duplicate

Duplicate copies the activity into the same day with ` (copy)` appended to the title and status reset to `planned`. The server checks for overlap before inserting it.

### Delete

Delete first uses a browser confirmation. If expenses are linked to the activity, the server rejects the operation with an `EXPENSE_LINKED` error until a resolution is supplied. The current editor does not provide that resolution UI. If there are no linked expenses, the activity is archived.

### Move

Move opens a target-date input and asks the server for a reviewable move proposal. A movable activity can be moved to another day if a compatible target exists. The proposal can then be applied. The current editor does not provide a same-day drag-and-drop interaction.

All activity mutations carry a generated UUID idempotency key. Activity API errors are shown as a short error message. Overlap errors are recognized when they start with `OVERLAP:` and shown as a “Time overlap detected” message.

## 10. Existing scheduling engine

The scheduling engine is proposal-based. It creates a before/after schedule snapshot, shows a diff, and only changes the database after the user applies the proposal.

### Add a day

The current scheduling panel contains:

- Numeric `Insert after day` input, defaulting to `2`.
- `New halt / city` text input, defaulting to `Hampi`.
- `Propose new day` button.

The server:

1. Takes a snapshot of the trip dates, itinerary days, and activity day assignments.
2. Finds the requested existing day.
3. Extends the trip end date by one day.
4. Inserts a proposed day after the selected day.
5. Shifts later day numbers and dates by one day in the proposed snapshot.
6. Keeps existing activities in their existing day IDs in the snapshot.
7. Reports the added day, number of shifted days, and budget impact.

The UI displays the proposed date and location, the count of later shifted days, and the message that per-day rules will include the added day while existing expenses remain unchanged. The user can Reject the proposal or Apply it.

Applying updates the trip end date and day records, inserts the new day, updates activity assignments from the snapshot, marks the proposal applied, records an audit event, invalidates the trip cache, and reloads the page. Applied add-day proposals are shown in a short history list with an Undo action. Undo restores the proposal’s before snapshot and removes the inserted day.

### Move an activity proposal

The server also supports `propose-move-activity`. It checks that the activity is movable, finds a target day either from the requested date or from a compatible location, detects a time collision, and creates a proposal. A collision requires a special replacement mode to proceed. The diff explicitly marks linked expenses as untouched.

The current visible editor uses only the move-day mode and only exposes a target date. It does not expose the engine’s other modes as user options.

## 11. Activity API operations

`POST /api/trips/{tripId}/activities` accepts these operations:

- `create`: create a new activity.
- `update`: update an activity.
- `delete`: archive an activity, optionally resolving linked expenses.
- `duplicate`: copy an activity on its current day.
- `move`: update an activity’s date.

`GET /api/trips/{tripId}/activities` returns the non-archived activity list. The route uses a five-minute trip itinerary cache, while the client request uses `no-store` and updates the local cache after a successful response.

`POST /api/trips/{tripId}/schedule` accepts:

- `propose-add-day`.
- `propose-move-activity`.
- `apply`.
- `undo`.

All server actions require an authenticated active trip member. Owner-only access is used for unrelated trip administration; ordinary itinerary activity and restructuring operations are member-accessible.

## 12. Current CSV export

The Export button in `ItineraryWorkspace` exports only the activities currently returned by the itinerary API. It builds one `ACTIVITY` row per activity and writes these columns:

```text
record_type,day_number,date,activity_type,title,start_time,origin,destination,location,maps_url,status
```

The export omits the original trip row, members, budgets, end times, via points, bike IDs, notes, and other source columns. The browser downloads it as `routivity-itinerary.csv`.

This export is therefore an activity-only export, not a round-trip export of the complete import CSV format.

## 13. Current constraints and observable gaps

These are current implementation facts relevant to understanding the starting point:

- The main itinerary view is read-only; editing is a separate panel below it.
- The itinerary display derives day tabs from activities, so empty days are invisible there even though empty days exist in the database.
- `day_number` is accepted in the CSV but activity placement is determined by `date`.
- Activities whose date is outside the trip range currently fall back to the first generated day during import.
- The UI does not show activity end times or durations.
- The UI does not show notes, via points, distance, or bike information.
- The UI has no first-class sightseeing/heritage-site collection; these are represented as activities or free text.
- The current form has no dedicated stay details, lodging metadata, or check-in/check-out model.
- There is no automatic “current day” or “available time window” preselection when adding an activity.
- There is no add-event/add-day choice in one entry point; adding an activity and adding a day are separate panels.
- There is no timeline gap insertion model between two activities. The overlap checker only rejects intersecting start/end ranges.
- There is no drag-and-drop scheduling UI.
- Add-day restructuring changes the trip dates and day numbering, but existing activity assignment behavior is snapshot-based and should be reviewed carefully when redesigning this flow.
- The editor’s delete path can require an expense-link resolution, but the current editor does not expose the resolution controls.
- The AI prompt asks for raw CSV but does not currently instruct the assistant to ask clarifying questions before generating it.
- Unknown CSV columns are ignored after a warning, so adding new data requires updating the parser and the import mapping.
- The local cache is a browser cache of the activity response, not an offline mutation queue for itinerary edits.

## 14. Source-level summary

At present, the planning engine is not a generative planning engine. It is a persistence and restructuring layer around dated activities:

- CSV/AI input supplies a proposed trip and activity list.
- The importer creates normalized trip-day and activity records.
- The itinerary workspace displays activities grouped by stored day number.
- The activity editor performs direct CRUD operations with basic overlap validation.
- The scheduling engine creates reviewable snapshots for adding a day or moving an activity.
- Audit events record imports, activity mutations, and applied/undone restructuring.
- Budget and expense systems are related to itinerary activities through activity IDs, but itinerary edits do not recalculate or move expense records.

This is the current baseline for the itinerary-page reformation.

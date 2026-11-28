# Planning Itinerary: Current Query and UI Operation Map

This document describes the operations that currently happen when the planning itinerary is loaded, added to, edited, deleted, duplicated, moved, or restructured.

It is a description of the current implementation only. It does not propose or implement optimization changes.

## Main request paths

The planner UI is `src/components/itinerary-workspace.tsx`.

Requests are handled by:

- `GET /api/trips/[tripId]/activities`
- `POST /api/trips/[tripId]/activities`
- `GET /api/trips/[tripId]/schedule`
- `POST /api/trips/[tripId]/schedule`
- `GET /api/trips/[tripId]/dashboard`
- `POST /api/sync` for the live dashboard completion flow

The route handlers delegate to functions in `src/app/actions/trips.ts`. Database access uses Drizzle ORM and PostgreSQL.

## Initial itinerary load

### `GET /api/trips/[tripId]/activities`

The route does the following:

1. Reads `trip:${tripId}:itinerary` from Redis through `getOrSetCache`.
2. On a cache miss, calls `listTripActivities(tripId)`.
3. Separately calls `listTripDays(tripId)`.
4. Returns `{ activities, days }`.

The activity query selects activity data joined to itinerary days:

```sql
SELECT
  activities.id,
  itinerary_days.day_number,
  itinerary_days.date,
  activities.type,
  activities.title,
  activities.start_time,
  activities.end_time,
  activities.origin,
  activities.destination,
  activities.location,
  activities.location_lat,
  activities.location_lon,
  activities.maps_url,
  activities.notes,
  activities.commitment,
  activities.time_window,
  activities.duration_min,
  activities.travel_mode,
  activities.stay_nights,
  activities.distance_km_milli,
  activities.bike_id,
  activities.status,
  activities.sort_order
FROM activities
INNER JOIN itinerary_days
  ON activities.day_id = itinerary_days.id
WHERE activities.trip_id = :tripId
  AND activities.archived = false
ORDER BY activities.sort_order ASC;
```

The days query selects all days for the trip and orders them by day number.

The Redis itinerary cache TTL is 300 seconds. Mutations invalidate the itinerary cache and related trip caches after successful database work.

### Client-side behavior after load

The planner stores the response in React state and also writes a local snapshot to:

```text
routivity-itinerary-${tripId}
```

If the network request fails, the component attempts to render this local snapshot.

The initial load chooses the current day when possible; otherwise it chooses the first day.

After a mutation, the planner uses a preserve-day load so the currently selected day should remain selected.

## Add activity: event, travel, or stay

### Client operation

The user opens the event sheet and submits the activity form. The client sends:

```http
POST /api/trips/:tripId/activities
```

with:

```json
{
  "operation": "create",
  "payload": {
    "idempotencyKey": "uuid",
    "activity": {
      "type": "EXPLORATION | CUSTOM | TRAVEL | STAY",
      "title": "...",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "location": "...",
      "locationLat": 0,
      "locationLon": 0,
      "origin": "...",
      "destination": "...",
      "notes": "...",
      "commitment": "PLANNED",
      "travelMode": "Bike",
      "distanceKmMilli": 1234,
      "stayNights": 1,
      "status": "planned"
    }
  }
}
```

The Place field may contain either a Geoapify-selected place or a manually typed place. Geoapify-selected places carry coordinates and a directions-capable `maps_url`; manually typed places are saved without a map URL.

### Server operations

`createActivity` performs:

1. Authenticates the current user and verifies active trip membership.
2. Finds the itinerary day by `trip_id` and activity date.
3. If the activity is travel and no bike was selected, queries the first configured bike for the trip.
4. Runs the overlap check when both start and end times exist.
5. Inserts one row into `activities`.
6. Generates a maps URL when applicable.
7. Inserts one audit event in the same transaction.
8. Commits the transaction.
9. Invalidates all Redis keys for the trip.
10. Returns the inserted activity.

Relevant database operations:

```sql
SELECT *
FROM itinerary_days
WHERE itinerary_days.trip_id = :tripId
  AND itinerary_days.date = :activityDate
LIMIT 1;
```

For a travel activity without an explicit bike:

```sql
SELECT *
FROM bikes
WHERE bikes.trip_id = :tripId
LIMIT 1;
```

The insert is performed inside a transaction and uses `RETURNING *`.

## Overlap checking

`ensureNoOverlap` is called during create, full update, duplicate, and import.

If start or end time is missing, no overlap query is performed.

Otherwise it selects all active activities for the same trip day:

```sql
SELECT
  activities.id,
  activities.title,
  activities.start_time,
  activities.end_time
FROM activities
WHERE activities.trip_id = :tripId
  AND activities.day_id = :dayId
  AND activities.archived = false;
```

The returned rows are then scanned in JavaScript. Two intervals overlap when:

```text
aStart < bEnd AND bStart < aEnd
```

The current implementation does not perform the overlap comparison in SQL; it loads all active activities for that day and checks them in application code.

## Edit an existing activity

### Client operation

The client sends:

```http
POST /api/trips/:tripId/activities
```

with:

```json
{
  "operation": "update",
  "payload": {
    "activityId": "uuid",
    "idempotencyKey": "uuid",
    "change": { "...changed fields..." }
  }
}
```

### Full update server flow

For a normal edit, `updateActivity` performs:

1. Authenticates and verifies membership.
2. Checks the `mutations` table for the idempotency key.
3. Fetches the current active activity by activity ID and trip ID.
4. Finds the destination day:
   - by trip ID and date when the date changed;
   - otherwise by the current activity’s `day_id`.
5. Runs the day overlap check.
6. Updates nearly all mutable activity columns.
7. Rebuilds the maps URL.
8. Inserts an audit event in the same transaction.
9. Invalidates the trip cache keys.
10. Returns the updated activity.

The current activity lookup is effectively:

```sql
SELECT *
FROM activities
WHERE activities.id = :activityId
  AND activities.trip_id = :tripId
  AND activities.archived = false
LIMIT 1;
```

The date lookup is either:

```sql
SELECT *
FROM itinerary_days
WHERE itinerary_days.trip_id = :tripId
  AND itinerary_days.date = :date
LIMIT 1;
```

or:

```sql
SELECT *
FROM itinerary_days
WHERE itinerary_days.id = :currentDayId
LIMIT 1;
```

The update uses `UPDATE activities ... WHERE activities.id = :activityId RETURNING *`.

## Completion update from Trip Now

When the user taps `Reached?`, `Done?`, or `Settled in`, the dashboard sends a status-only activity update through:

```http
POST /api/sync
```

with:

```json
{
  "type": "update-activity",
  "payload": {
    "tripId": "uuid",
    "activityId": "uuid",
    "idempotencyKey": "uuid",
    "change": { "status": "done" }
  }
}
```

The server takes a fast path because the change contains only `status`:

```sql
UPDATE activities
SET status = 'done', updated_at = NOW()
WHERE activities.id = :activityId
  AND activities.trip_id = :tripId
  AND activities.archived = false
RETURNING activities.id, activities.status;
```

Inside the same transaction it also:

1. Inserts an audit event.
2. Inserts the idempotency result into `mutations`.
3. Commits.
4. Invalidates trip caches.

The dashboard updates its local activity payload without refetching the whole dashboard. For travel completion, the bike exit animation runs before the local state changes. Parent mode observes the change on its next refresh or manual refresh.

## Delete activity

Delete is an archive operation, not a physical delete.

### Preliminary expense lookup

Before changing the activity, the server queries linked expenses:

```sql
SELECT *
FROM expenses
WHERE expenses.trip_id = :tripId
  AND expenses.activity_id = :activityId;
```

If linked expenses exist and no resolution was supplied, the operation stops with an `EXPENSE_LINKED` error.

The user can choose:

- unlink expenses by setting `expenses.activity_id = NULL`;
- reassign expenses by setting `expenses.activity_id = :targetActivityId`.

The activity is then archived:

```sql
UPDATE activities
SET archived = true, updated_at = NOW()
WHERE activities.id = :activityId;
```

The expense update, activity archive, and audit event run in one transaction. Redis trip caches are invalidated after commit.

## Restore activity

Restore is available through the undo toast after deletion.

It performs:

```sql
UPDATE activities
SET archived = false, updated_at = NOW()
WHERE activities.id = :activityId
  AND activities.trip_id = :tripId;
```

It also writes an audit event and an idempotency record in one transaction, then invalidates the trip caches.

## Duplicate activity

The server:

1. Fetches the current active activity by ID and trip ID.
2. Runs the same-day overlap check using the source activity’s day and times.
3. Inserts a copy into `activities` with:
   - the same trip and day;
   - the title suffixed with `(copy)`;
   - the same times, route, location, bike, and movement settings;
   - status reset to `planned`;
   - sort order incremented by one.
4. Writes an audit event.
5. Invalidates caches.

The duplicate insert uses `RETURNING *`.

## Move activity

The basic move endpoint calls `moveActivity`, which:

1. Fetches the activity by trip and activity ID.
2. Calls `updateActivity` with a changed date while preserving its times.
3. Therefore performs the full update flow, including destination-day lookup and overlap checking.

The planner’s smart move flow is proposal-based and is described below.

## Add-day and itinerary restructuring

### Proposal creation

`proposeAddDay` first creates a complete schedule snapshot using three parallel database reads:

```text
trips.findFirst(tripId)
itineraryDays.findMany(tripId ORDER BY dayNumber)
activities.findMany(tripId)
```

The activity snapshot includes IDs, day IDs, times, sort order, and archived state.

The function then creates an in-memory `after` snapshot:

1. Extends the trip end date by one day.
2. Inserts a synthetic new day after the selected day.
3. Shifts later day numbers and dates by one.
4. Leaves activity rows unchanged in the add-day proposal.
5. Inserts one row into `restructuring_proposals` containing before snapshot, after snapshot, diff, trip ID, and actor.

No itinerary day or activity is changed yet.

### Applying a proposal

`applyRestructuringProposal`:

1. Fetches the proposal by proposal ID and trip ID.
2. Verifies its status is `proposed`.
3. Starts a transaction.
4. Selects all current itinerary day IDs for the trip.
5. Updates the trip end date.
6. Temporarily moves every existing day number to a negative sentinel value to avoid unique day-number collisions.
7. Inserts the synthetic new day.
8. Updates every existing day’s day number, date, and location.
9. Updates every activity’s day ID, times, sort order, and archived flag from the after snapshot.
10. Marks the proposal `applied`.
11. Writes an itinerary-restructured audit event.
12. Commits and invalidates trip caches.

The update loops issue one SQL statement per day and one SQL statement per activity rather than a single bulk statement.

### Undoing a proposal

`undoRestructuring`:

1. Fetches the proposal and verifies it is `applied`.
2. Reads current itinerary day IDs.
3. Deletes days that were not present in the before snapshot.
4. Restores the trip end date.
5. Restores each original day’s number, date, and location.
6. Marks the proposal `undone`.
7. Writes an audit event.
8. Commits and invalidates caches.

## Import itinerary

`importTrip` is a large transaction that creates:

1. One trip row.
2. One row per itinerary day.
3. Participant rows.
4. Optional budget rule rows.
5. One activity row per imported activity.
6. One import audit event.
7. One idempotency mutation row.

Each imported activity runs the overlap check before its insert. The import ends with cache invalidation.

## Idempotency

The `mutations` table stores:

- idempotency key;
- trip ID;
- actor ID;
- serialized result;
- creation timestamp.

The current idempotency checks are used by import, status-only update, restore, and some other action paths. Create, full update, delete, duplicate, and restructuring operations should be reviewed as a group when designing a consistent idempotency strategy.

## Current indexes and constraints

The `activities` table currently has this index:

```text
activities_trip_day_idx (trip_id, day_id)
```

The `itinerary_days` table has this unique index:

```text
itinerary_days_trip_day_idx (trip_id, day_number)
```

Activities also have:

- primary key on `id`;
- foreign key to `trips.id` through `trip_id`;
- foreign key to `itinerary_days.id` through `day_id`;
- a non-indexed `archived` flag;
- a non-indexed `status` field;
- a non-indexed `sort_order` field.

## Cache behavior

The shared cache helper uses Redis when configured. The standard trip keys are:

```text
trip:${tripId}:dashboard
trip:${tripId}:itinerary
trip:${tripId}:money
trip:${tripId}:activity-log
trip:${tripId}:meta
trip:${tripId}
```

Reads use a cache-aside pattern with a 300-second TTL for itinerary and dashboard reads. Cache read/write failures are swallowed and fall back to PostgreSQL.

Every successful itinerary mutation calls `invalidateTripCache`, which deletes all six keys. This happens after the transaction, so the database remains authoritative if Redis is unavailable.

## Current frontend loading and animation behavior

The planner currently has these UI behaviors:

- The modal is rendered through a portal.
- Opening uses `itinerary-overlay-in` and `itinerary-sheet-in`.
- Closing uses a 220 ms overlay/sheet exit animation before unmounting.
- The selected day is preserved by calling `load(true)` after event save, duplicate, delete, or restore flows.
- A successful new or edited event receives a short `just-added` timeline animation.
- The save button uses a busy state while the request is active.
- After the API response, the planner reloads the itinerary in the background and updates the visible list.
- The UI uses localStorage as an offline fallback, but mutations themselves are sent to the server through the API.

The current save path still waits for the mutation response before closing and starting the refresh. The API request is asynchronous from the browser’s perspective, but the current implementation is not a fully optimistic mutation pipeline for planner CRUD operations.

## Main areas for a later optimization review

These are observations for the next agent, not implemented changes:

- overlap checks load every active activity for a day and compare in JavaScript;
- the overlap query has no composite time-range index;
- `listTripActivities` and `listTripDays` are fetched separately by the itinerary route;
- restructuring applies day and activity changes in loops;
- several mutation paths perform a read, then a transaction, then cache invalidation;
- cache invalidation deletes all trip keys even when only one resource changed;
- cache invalidation occurs after the transaction and is resilient, but there is no event-driven client invalidation between planner, dashboard, and parent mode;
- planner CRUD waits for the server response before the final local list refresh;
- idempotency coverage is not uniform across every mutation path;
- `activities_trip_day_idx` does not include `archived`, `start_time`, or `end_time`.


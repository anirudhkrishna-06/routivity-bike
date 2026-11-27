# Routivity Trip Now Dashboard — Current Implementation

This document describes the Trip Now dashboard as it exists today. It is an implementation inventory for a future redesign. It intentionally describes current behavior, data sources, persistence, calculations, loading, caching, and integrations. It does not prescribe a replacement design.

## 1. Where Trip Now is rendered

The Trip Now UI is rendered by:

- `src/components/trip-now-dashboard.tsx`
- State/phase calculation: `src/lib/trip-now.ts`
- Server endpoint: `src/app/api/trips/[tripId]/dashboard/route.ts`
- Server data aggregation: `src/app/actions/trips.ts` and `src/app/actions/money.ts`
- Database schema: `src/lib/db/schema.ts`
- Trip shell/navigation: `src/components/app-shell.tsx`
- Dashboard styling: `src/app/real-dashboard.css`, `src/app/dashboard.css`, and shared shell styles.

The dashboard is not a separate route. It is the default `Trip Now` workspace inside `AppShell` for a selected trip.

When a trip is selected, `AppShell` renders:

```tsx
<TripNowDashboard
  tripId={selectedTrip.id}
  onOpenExpenses={openExpenses}
/>
```

The bottom navigation can switch between:

1. Itinerary
2. Budget
3. Settlements
4. Analytics

The central plus button opens the Expense modal. Trip Now also opens that same Expense modal through its quick actions.

## 2. Current Trip Now screen structure

The current page renders these areas in order:

1. Dashboard toolbar
2. Preview-as date/time control
3. Live Now card
4. Financial summary row
5. Ledger filters
6. Category spend card
7. Daily spend card
8. Paid-versus-share card
9. Budget health card
10. Filtered expense detail card

### 2.1 Dashboard toolbar

The toolbar contains:

- The selected trip name.
- The active dashboard date, formatted as a long Indian English date.
- The trip timezone.
- A refresh icon button.

The refresh icon calls `load()` and reloads `/api/trips/{tripId}/dashboard`.

The displayed date comes from `state.date`, not necessarily the current wall-clock date when Preview as is active.

### 2.2 Preview-as date/time setter

The dashboard currently includes a date-time input:

```tsx
<input type="datetime-local" />
```

State:

```ts
const [preview, setPreview] = useState("");
```

When empty, the dashboard uses the actual current time and the trip timezone.

When populated, the input is split as follows:

- `preview.slice(0, 10)` becomes the simulated date.
- `preview.slice(11, 16)` becomes the simulated `HH:mm` time.

The simulated date/time is passed into `getTripNow()` as:

```ts
preview: {
  date,
  time,
}
```

The `Use now` button clears the value and returns the dashboard to the real current time.

This Preview as control is currently the primary debugging/testing mechanism for the time-aware dashboard. It allows phase behavior to be checked without changing the system clock or database.

## 3. Trip Now state engine

The state engine is in `src/lib/trip-now.ts`.

It is a pure function:

```ts
getTripNow({
  startDate,
  endDate,
  timezone,
  activities,
  now?,
  preview?,
})
```

It does not use GPS, browser geolocation, weather, Geoapify, Google Maps, or a database directly.

It only receives trip metadata, activities, and an optional simulated date/time.

### 3.1 Timezone handling

Without Preview as, the current local date and minute are derived with:

```ts
new Intl.DateTimeFormat("en-CA", {
  timeZone: timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
```

The result is normalized into:

```ts
{
  date: "YYYY-MM-DD",
  minute: number,
}
```

The trip timezone comes from `trips.timezone`, defaulting at the schema level to `Asia/Kolkata`.

### 3.2 State phases

The possible `TripNowState.kind` values are:

- `before`
- `day-before`
- `morning`
- `travelling`
- `exploring`
- `free`
- `stay`
- `wrap-up`
- `rest`
- `after`

The state includes:

```ts
type TripNowState = {
  kind: ...;
  label: string;
  title: string;
  description: string;
  activity?: NowActivity;
  nextActivity?: NowActivity;
  minutesRemaining?: number;
  date: string;
}
```

### 3.3 Before the trip

If the simulated/current date is before `trip.startDate`:

- If it is exactly one day before the trip, kind is `day-before`.
- Otherwise kind is `before`.

Current labels/titles/descriptions:

`day-before`:

- Label: `THE DAY BEFORE`
- Title: `Tomorrow, the journey begins.`
- Description: `Check the itinerary, bikes, and budget before you leave.`

`before`:

- Label: `BEFORE THE TRIP`
- Title: `Your trip is coming up.`
- Description: `Check the itinerary, bikes, and budget before you leave.`

No activity is attached in these states.

### 3.4 After the trip

If the date is after `trip.endDate`:

- Kind: `after`
- Label: `AFTER THE TRIP`
- Title: `The route is complete.`
- Description: `Review your spending and settle any remaining balances.`

No activity is attached in this state.

### 3.5 No activities for the day

If no activity has the active date:

- Kind: `rest`
- Label: `REST DAY`
- Title: `A slower day by design.`
- Description: `There are no planned activities today.`

### 3.6 Current activity

Activities are considered current when:

```ts
startTime <= currentMinute < endTime
```

Both start and end must be present. Activities without both times cannot become the current active activity.

Current activity kind mapping:

- `TRAVEL` → `travelling`
- `STAY` → `stay`
- Everything else → `exploring`

Current labels:

- `TRAVELLING`
- `AT THE STAY`
- `EXPLORING`

Current title is the activity title.

Current description:

- Travel: `{origin} to {destination}`.
- Non-travel with location: the activity location.
- Non-travel without location: `This activity is happening now.`

For current timed activities, `minutesRemaining` is calculated as:

```ts
endMinute - currentMinute
```

The next activity is found by looking for an activity whose start time is after the current activity end time.

### 3.7 Next activity / morning

If there is no current activity but there is a later activity:

- Before the first activity starts:
  - Kind: `morning`
  - Label: `GOOD MORNING`
  - Title: `The day is ready when you are.`
  - Description: `First up: {next title}.`
- After the first activity has started:
  - Kind: `free`
  - Label: `FREE TIME`
  - Title: `A little room in the plan.`
  - Description: `Next: {next title}.`

The next activity is returned in `nextActivity`.

### 3.8 Day wrap-up

If the day has activities but none are current or upcoming:

- Kind: `wrap-up`
- Label: `DAY WRAP-UP`
- Title: `That’s the day.`
- Description: `Review what happened and prepare for tomorrow.`

The last activity of the day is attached as `activity`.

## 4. Current Now card behavior

The Now card uses a class based on `state.kind`:

```tsx
<article className={`now-card ${state.kind}`}>
```

It renders:

- A top row containing the state label.
- The remaining-minute text when `minutesRemaining` exists; otherwise `Now`.
- State title.
- State description.
- Google Maps link when `activity.mapsUrl` exists.
- Travel route details for a Travel activity.
- Travel quick actions for a Travel activity.
- Completion action for non-travelling activities.

### 4.1 Google Maps link

The card shows `Open in Google Maps` when the activity has a `mapsUrl`.

The URL is produced server-side by `buildMapsUrl()` in `src/lib/maps.ts`.

For Travel with origin and destination, the generated URL is:

```text
https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=two-wheeler
```

Existing valid Google Maps URLs are preserved.

Google Maps is used for navigation/deep linking only. It is not used by Trip Now to calculate distance.

### 4.2 Travel details

For a current Travel activity, the Now card displays:

- `Route {origin} → {destination}`
- `Arrive by {endTime}` when end time exists.

The current card does not display the stored `distanceKmMilli` directly.

### 4.3 Travel quick actions

When the current activity is Travel, four actions appear:

- Fuel
- Toll
- Food
- Arrived

Fuel, Toll, and Food call the same `onOpenExpenses` callback. The callback only opens the Expense modal; the category parameter is not currently passed by these buttons.

The Arrived action calls `markDone()`.

### 4.4 Completion action

For any state with an activity where `state.kind !== "travelling"`, the card shows:

```text
Did this happen?
```

It calls `markDone()`.

`markDone()` sends an `/api/sync` mutation:

```json
{
  "type": "update-activity",
  "payload": {
    "tripId": "...",
    "activityId": "...",
    "idempotencyKey": "uuid",
    "change": {
      "status": "done"
    }
  }
}
```

After the request, the dashboard reloads.

## 5. Dashboard API

The endpoint is:

```text
GET /api/trips/{tripId}/dashboard
```

The route is a Next.js App Router Route Handler at:

```text
src/app/api/trips/[tripId]/dashboard/route.ts
```

The handler:

1. Awaits the dynamic `tripId` route params.
2. Verifies the database is configured.
3. Loads a cached dashboard payload through `getOrSetCache()`.
4. On a cache miss, loads the trip and runs these in parallel:
   - `listTripActivities(tripId)`
   - `getMoneyOverview(tripId)`
5. Returns the combined payload.

The server cache key is:

```text
trip:{tripId}:dashboard
```

The server cache TTL is 300 seconds, or 5 minutes.

### 5.1 API response shape

The response is conceptually:

```ts
{
  trip: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    timezone: string;
    currency: string;
  };
  activities: Activity[];
  money: MoneyOverview;
  sync: {
    status: "online";
  };
}
```

## 6. Activity data returned to Trip Now

`listTripActivities()` joins `activities` with `itineraryDays`.

It returns active, non-archived activities ordered by `activities.sortOrder`.

Returned activity fields:

- `id`
- `dayNumber`
- `date`
- `type`
- `title`
- `startTime`
- `endTime`
- `origin`
- `destination`
- `location`
- `mapsUrl`
- `notes`
- `commitment`
- `timeWindow`
- `durationMin`
- `travelMode`
- `stayNights`
- `distanceKmMilli`
- `bikeId`
- `status`
- `sortOrder`

The current `NowActivity` client type uses only a subset of those fields:

- `id`
- `date`
- `dayNumber`
- `type`
- `title`
- `startTime`
- `endTime`
- `origin`
- `destination`
- `location`
- `mapsUrl`
- `distanceKmMilli`
- `status`

The API sends more fields than Trip Now currently consumes.

## 7. Money overview data used by Trip Now

Trip Now receives `getMoneyOverview(tripId)` as `payload.money`.

The money overview is built from:

- Participants
- Expenses
- Expense payments
- Expense shares
- Budget rules
- Settlement rounds
- Settlement transfers
- Trip
- Itinerary days
- Travel activities
- Bikes
- Stay activities

The complete server return includes more fields than Trip Now uses. Trip Now consumes:

```ts
money: {
  expenses;
  balances;
  budgetSummary;
}
```

### 7.1 Expenses

Each expense sent to the client includes the expense row plus its payment and share rows.

Relevant fields:

- `id`
- `description`
- `category`
- `expenseDate`
- `amountPaise`
- `reversedAt`
- `payments[]`
- `shares[]`

The Trip Now filtered ledger excludes expenses where `reversedAt` is truthy.

### 7.2 Participants and balances

`balances` are calculated from active expense payments, active expense shares, and confirmed settlement transfers.

Trip Now uses each balance row as:

```ts
{
  participantId: string;
  name: string;
  netPaise: number;
}
```

The dashboard does not display `netPaise` directly in the current UI. It uses participant IDs and names to filter and calculate paid-versus-share analytics.

### 7.3 Budget summary

Each budget summary row includes:

- `category`
- `plannedPaise`
- `actualPaise`
- `status`

Trip Now displays:

```text
planned amount / actual amount
```

The current budget status is calculated by comparing actual spend with planned spend:

- `over` when utilisation is greater than 100%.
- `approaching` when utilisation is at least 80%.
- `within` otherwise.

The budget summary is planned-vs-actual data, not a list of individual budget records.

## 8. Trip Now filters

The dashboard has four client-side filters:

### Category

Initial value: `ALL`.

Categories currently available in the select:

- `FOOD` → Food
- `STAY` → Stay
- `FUEL` → Fuel
- `PARKING_TOLLS` → Parking
- `EXPLORATION` → Tickets
- `PRE_REQ` → Pre Req
- `MISCELLANEOUS` → Custom
- `SHOPPING` → Shopping

### Person

Initial value: `ALL`.

Options are derived from `payload.money.balances`.

An expense matches a person if that participant appears in either:

- `expense.payments`
- `expense.shares`

### From date

Initial value: empty.

If set, expenses must have `expenseDate >= from`.

### To date

Initial value: empty.

If set, expenses must have `expenseDate <= to`.

The Clear button resets all four filters.

Filters are client-side only. Changing a filter does not call the server.

## 9. Filtered spend calculations

The filtered expense set includes expenses that:

1. Are not reversed.
2. Match the selected category, unless category is `ALL`.
3. Match the selected person, unless person is `ALL`.
4. Are on or after the From date, when set.
5. Are on or before the To date, when set.

From this filtered set, Trip Now calculates:

```ts
total
categoryTotals
dailyTotals
people
```

### 9.1 Total

`total` is the sum of `amountPaise` across the filtered expenses.

The UI formats paise as INR with no decimal places.

### 9.2 Category totals

Expenses are grouped by their raw category string, then sorted descending by amount.

This powers the Category Spend card.

### 9.3 Daily totals

Expenses are grouped by their `expenseDate`, then sorted ascending by date.

This powers the Daily Spend bar chart.

### 9.4 Person analytics

The dashboard creates one row for every balance participant, then sums filtered expenses into:

- `paid`: payment amounts for that participant.
- `share`: share amounts for that participant.

This powers the Paid vs Share card.

## 10. Forecast calculation

Trip Now derives a local forecast from the filtered expenses and the filtered budget rows.

The selected category filter also filters budget rows.

Variables:

- `planned`: sum of matching `plannedPaise` values.
- `analytics.total`: filtered spend total.

Current forecast behavior:

```ts
forecast = planned > analytics.total
  ? analytics.total + (planned - analytics.total)
  : analytics.total
```

Therefore, when planned is greater than actual filtered spend, the current forecast equals the planned amount. When actual is greater than planned, it equals actual.

This is a client-side display calculation and is separate from the server-side `money.forecast` object returned by `getMoneyOverview()`.

The current Trip Now component does not use `money.forecast.projectedPaise` or `money.forecast.label`.

## 11. Category Spend card

The card title is `Where the money is going`.

Each category is rendered as a button containing:

- Category display label.
- Category amount.
- Horizontal proportional bar.

Clicking a category bar sets the Category filter to that category.

If there are no matching categories, the card shows:

```text
No expenses match these filters.
```

## 12. Daily Spend card

The card title is `Spend over time`.

Each daily bar is a button.

Each bar:

- Uses daily spend as its height.
- Shows the month/day suffix below the bar.
- Has a browser title containing the full date and formatted amount.

Clicking a daily bar sets both From and To to that date, effectively filtering the ledger to one day.

If there are no matching dates, it shows:

```text
No daily spend for these filters.
```

## 13. Paid vs Share card

The card title is `Per-person position`.

Each participant row shows:

- Participant name.
- A bar based on paid amount relative to the larger of paid/share.
- `Paid {amount} · Share {amount}`.

The chart uses the filtered expense set, not all historical expenses.

## 14. Budget Health card

The card title is `Budget health`.

It shows one row per matching budget category:

- Category label.
- Actual/planned amounts.
- A proportional health bar.
- Status: within, approaching, or over.

The card includes the static label:

```text
Estimates never block spending
```

If no budget rows match the current category filter, it shows:

```text
No budget rules match this filter.
```

## 15. Filtered expense detail card

The card title is `Filtered expenses`.

It contains:

- An `Open ledger` button, which opens the Expense modal.
- Up to the first eight filtered expenses.

Each row shows:

- Category label.
- Expense date.
- Optional description.
- Formatted amount.

The list is not paginated in the current Trip Now component and is limited with `filtered.slice(0, 8)`.

## 16. Database schema sources

### 16.1 Trips

Table: `trips`

Relevant columns:

- `id`
- `name`
- `start_date`
- `end_date`
- `timezone`
- `currency`
- `created_by`

Trip Now uses name, date range, timezone, currency, and ID.

### 16.2 Itinerary days

Table: `itinerary_days`

Relevant columns:

- `id`
- `trip_id`
- `day_number`
- `date`
- `location`

Trip Now receives `dayNumber` and `date` through the activity join. It does not currently render the day location directly.

### 16.3 Activities

Table: `activities`

Relevant columns:

- `id`
- `trip_id`
- `day_id`
- `type`
- `title`
- `start_time`
- `end_time`
- `origin`
- `destination`
- `location`
- `maps_url`
- `distance_km_milli`
- `bike_id`
- `notes`
- `commitment`
- `time_window`
- `duration_min`
- `travel_mode`
- `stay_nights`
- `status`
- `archived`
- `sort_order`

Activity types are:

- `TRAVEL`
- `STAY`
- `EXPLORATION`
- `CUSTOM`

Trip Now filters out `archived = true` activities through `listTripActivities()`.

### 16.4 Expenses

Table: `expenses`

Relevant columns:

- `id`
- `trip_id`
- `activity_id`
- `description`
- `category`
- `expense_date`
- `entered_by`
- `bike_id`
- `amount_paise`
- `litres_milli`
- `odometer_km_milli`
- `reversed_at`

### 16.5 Expense payments

Table: `expense_payments`

Used to calculate who paid for an expense.

Relevant columns:

- `expense_id`
- `participant_id`
- `amount_paise`

### 16.6 Expense shares

Table: `expense_shares`

Used to calculate who shares an expense.

Relevant columns:

- `expense_id`
- `participant_id`
- `amount_paise`

### 16.7 Budget rules

Table: `budget_rules`

Relevant columns:

- `trip_id`
- `category`
- `rule_type`
- `amount_paise`
- `scope`
- `effective_from`
- `active`

Supported rule types in the current budget UI include:

- `PER_DAY`
- `PER_NIGHT`
- `TOTAL`

The money aggregation also supports a derived Fuel rule:

- `DERIVED` with category `FUEL`

### 16.8 Bikes

Table: `bikes`

Relevant columns:

- `id`
- `trip_id`
- `name`
- `model`
- `mileage_kmpl_milli`
- `fuel_price_paise_per_litre`

These values are used by the server-side fuel planning calculation when a Travel activity has a matching `bikeId`.

## 17. Fuel and planned-cost relationship

Trip Now itself does not calculate fuel cost from travel distance.

The calculation occurs inside `getMoneyOverview()`.

The server loads all non-archived Travel activities and all bikes for the trip. For a Travel activity with:

- `distanceKmMilli`
- matching bike mileage
- matching bike fuel price

The derived fuel cost is calculated using the bike’s mileage and petrol price.

The resulting planned Fuel amount can be used for a `DERIVED` Fuel budget rule.

The current system separates:

- Planned/derived cost from itinerary and bike configuration.
- Actual cost from recorded Fuel expenses.

## 18. Geoapify status

Geoapify is not used by the current Trip Now dashboard.

Geoapify is used by the itinerary Travel editor through:

```text
src/app/api/geoapify/route.ts
```

Current Geoapify responsibilities:

1. Place autocomplete.
2. Place coordinate resolution.
3. Route calculation.
4. Route distance calculation.

The Travel editor stores the calculated route distance in `activities.distance_km_milli`.

Trip Now can display the Travel origin, destination, arrival time, and Google Maps link from the activity data, but it does not currently show Geoapify distance as a dedicated metric.

## 19. Google Maps status

Google Maps is not queried by Trip Now.

Trip Now only renders a stored/generated `mapsUrl` as an external link.

For Travel activities, the URL uses:

- Origin
- Destination
- Two-wheeler travel mode
- Optional waypoints when present

For location-based non-Travel activities, a Google Maps search URL can be generated.

## 20. Weather status

There is currently no weather integration in Trip Now.

The dashboard does not currently load:

- Weather APIs.
- Forecast data.
- Temperature.
- Rain probability.
- Wind.
- Weather alerts.
- Weather location coordinates.

The current Trip Now API response has no weather field.

## 21. Loading and client cache

Trip Now currently has two cache layers.

### 21.1 Server cache

The dashboard API uses Redis through `getOrSetCache()`.

Key:

```text
trip:{tripId}:dashboard
```

TTL:

```text
300 seconds
```

If Redis is unavailable, the server falls back to the database fetcher.

### 21.2 Browser cache

The dashboard writes the API payload to:

```text
routivity-dashboard-{tripId}
```

On component mount, it reads that localStorage snapshot before starting the network request.

The network request still runs after cached hydration.

If the network request fails:

- Cached payload is used if available.
- Otherwise the inline LoadingScreen remains with the error label.

### 21.3 Refresh behavior

The dashboard refreshes when:

- The component first mounts.
- The refresh icon is clicked.
- A `routivity-refresh` browser event is dispatched.
- The 60-second interval fires.

The interval is cleared on unmount.

## 22. Sync and invalidation

The dashboard API currently returns:

```ts
sync: {
  status: "online"
}
```

This is a static response value in the dashboard route, not a live network quality calculation.

Trip mutations call `invalidateTripCache(tripId)`, which clears the Redis keys for:

- Dashboard
- Itinerary
- Money
- Activity log
- Trip metadata
- Trip root cache

The browser dashboard also listens for `routivity-refresh` and reloads its payload.

## 23. What Trip Now does not currently do

The current implementation does not:

- Use Geoapify directly in the dashboard.
- Use GPS or device location.
- Display live map tiles.
- Display weather.
- Display a weather forecast.
- Display sunrise or sunset.
- Display a dedicated hotel/stay section below each day.
- Display route distance in the Now card.
- Display route duration from Geoapify.
- Display bike mileage or petrol price in the Now card.
- Fetch a separate lightweight dashboard aggregate; the API currently includes the money overview payload.
- Use IndexedDB for Trip Now browser reads; the current component uses localStorage.
- Persist Preview-as date/time; it is component-local state and resets when the component is remounted.
- Persist dashboard filters; category, person, From, and To reset on remount.
- Paginate the filtered expense details; only eight are rendered.
- Use the server-returned `money.forecast` object in the current Trip Now UI.

## 24. Current implementation data flow

```text
AppShell
  └─ selected trip
      └─ TripNowDashboard(tripId)
          ├─ localStorage snapshot: routivity-dashboard-{tripId}
          ├─ GET /api/trips/{tripId}/dashboard
          │   └─ Redis: trip:{tripId}:dashboard, TTL 300s
          │       ├─ trips table
          │       ├─ activities + itinerary_days
          │       └─ getMoneyOverview()
          │           ├─ expenses
          │           ├─ expense_payments
          │           ├─ expense_shares
          │           ├─ budget_rules
          │           ├─ participants
          │           ├─ settlement_rounds
          │           ├─ settlement_transfers
          │           ├─ itinerary_days
          │           ├─ travel activities
          │           ├─ stay activities
          │           └─ bikes
          ├─ getTripNow(payload.trip, payload.activities, preview)
          ├─ client-side expense filters
          ├─ client-side spend aggregation
          └─ rendered cards and actions
```

## 25. Current files to inspect for a redesign

Primary UI:

- `src/components/trip-now-dashboard.tsx`

Time/state engine:

- `src/lib/trip-now.ts`
- `src/lib/trip-now.test.ts`

Data API:

- `src/app/api/trips/[tripId]/dashboard/route.ts`
- `src/app/actions/trips.ts`
- `src/app/actions/money.ts`

Data model:

- `src/lib/db/schema.ts`

Trip shell:

- `src/components/app-shell.tsx`
- `src/components/app-shell.css`

Current dashboard styles:

- `src/app/real-dashboard.css`
- `src/app/dashboard.css`

External integrations related to itinerary data:

- `src/app/api/geoapify/route.ts`
- `src/lib/maps.ts`


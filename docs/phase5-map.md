# Phase 5 implementation map

This file is the working traceability map for `docs/features.md` section 16. It deliberately distinguishes a real implementation from a UI placeholder.

| Area | Feature IDs | Current implementation | Status |
| --- | --- | --- | --- |
| Import | F1.1–F1.5, F1.12 | CSV parser, validation, preview/confirm import, generated Maps links, itinerary CSV export | Implemented |
| Itinerary CRUD | F1.6, F1.8, F1.9, F1.11 | Activity editor now surfaces create/update/duplicate/delete, overlap errors and safe linked-expense handling; server actions support move/status/bike fields | Implemented with remaining advanced move UI |
| Overlap safety | F1.7, F9.1–F9.2, F9.7 | Server overlap detection, visible conflict errors, fixed-activity protection, compatible-day move proposals and manual target-day selection are implemented; automatic same-day slot ranking and replace flow remain | In progress |
| Day restructuring | F1.10, F9.3–F9.6 | Durable add-day proposal, before/after diff, atomic apply, city hint, date/day shift, audit and undo snapshot are implemented at `/api/trips/[tripId]/schedule` | Implemented for add-day; full solver remains |
| Expenses | F2.1–F2.15 | Integer paise, equal/exact/percentage splits, multiple payers, revisions, reversals, idempotency, fuel fields and offline queue | Implemented |
| Budget | F3.1–F3.10 | Rules/history, planned-vs-actual, editable imported rules, day cards and thresholds | Partially implemented; allocations/alerts need server read model |
| Settlement | F4.1–F4.13 | Rounds, minimum suggestions, pending/confirmed transfers, close/history, reconciliation checks | Implemented server-side; on-behalf/final report UI remains |
| Offline | F5.1–F5.11, F8.1–F8.10 | IndexedDB outbox, retry/discard, online flush, offline banner, queue status, unsynced JSON export, stale-expense conflict records and conflict centre | Partially implemented; cursor/realtime, dependency blocking and field-level merge remain |
| Trip Now | F6.1–F6.7 | Time-aware state engine, preview-as, Maps links, quick fuel/toll/food actions, budget health | Implemented |
| Intelligence | F10.1–F10.8 | Derived planned fuel, bike-linked mileage insight panel and server forecast read model exist | Price drift update flow, daily allowance and what-if UI remain |
| Exports | F11.1–F11.9 | Itinerary, expense ledger, participant summary, settlement history, budget-vs-actual, activity-log, final JSON snapshot, and printable reconciliation report at `/trip/[tripId]/report` | Partial; server PDF/ZIP packaging remains |

## Phase 5 safety rule

No scheduling UI should mutate activities until it has a server-generated proposal containing before/after activity-day assignments, affected dates, budget recalculations and an undo snapshot. Expenses must not be included in that mutation set.

## Verification checklist

- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `pnpm test`
- Manual: airplane-mode expense, reload, reconnect, retry; two-member activity edit; proposed day insertion; undo; final settlement reconciliation.

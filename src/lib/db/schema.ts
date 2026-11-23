import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  date,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const memberStatus = pgEnum("member_status", ["active", "inactive"]);
export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const activityStatus = pgEnum("activity_status", [
  "planned",
  "done",
  "skipped",
]);
export const activityType = pgEnum("activity_type", [
  "TRAVEL",
  "STAY",
  "EXPLORATION",
  "CUSTOM",
]);
export const settlementTransferStatus = pgEnum("settlement_transfer_status", [
  "pending",
  "confirmed",
  "reversed",
]);
export const settlementRoundStatus = pgEnum("settlement_round_status", [
  "open",
  "closed",
  "reversed",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const authMagicLinks = pgTable("auth_magic_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const trips = pgTable("trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  currency: varchar("currency", { length: 3 }).default("INR").notNull(),
  timezone: varchar("timezone", { length: 80 })
    .default("Asia/Kolkata")
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }),
    status: memberStatus("status").default("active").notNull(),
    role: memberRole("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripMember: uniqueIndex("participants_trip_name_idx").on(
      table.tripId,
      table.name,
    ),
  }),
);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  participantId: uuid("participant_id")
    .references(() => participants.id)
    .notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tripJoinCodes = pgTable("trip_join_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  codeHash: varchar("code_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    dayNumber: integer("day_number").notNull(),
    date: date("date").notNull(),
    location: text("location"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripDay: uniqueIndex("itinerary_days_trip_day_idx").on(
      table.tripId,
      table.dayNumber,
    ),
  }),
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    dayId: uuid("day_id")
      .references(() => itineraryDays.id)
      .notNull(),
    type: activityType("type").default("CUSTOM").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    origin: text("origin"),
    destination: text("destination"),
    location: text("location"),
    mapsUrl: text("maps_url"),
    viaPoints: text("via_points"),
    distanceKmMilli: integer("distance_km_milli"),
    bikeId: uuid("bike_id"),
    notes: text("notes"),
    commitment: varchar("commitment", { length: 20 })
      .default("PLANNED")
      .notNull(),
    timeWindow: varchar("time_window", { length: 20 }),
    durationMin: integer("duration_min"),
    travelMode: varchar("travel_mode", { length: 30 }),
    stayNights: integer("stay_nights"),
    status: activityStatus("status").default("planned").notNull(),
    movable: boolean("movable").default(true).notNull(),
    archived: boolean("archived").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripDayIndex: index("activities_trip_day_idx").on(
      table.tripId,
      table.dayId,
    ),
  }),
);

export const bikes = pgTable("bikes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  model: varchar("model", { length: 120 }),
  mileageKmplMilli: integer("mileage_kmpl_milli"),
  fuelPricePaisePerLitre: integer("fuel_price_paise_per_litre"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    activityId: uuid("activity_id").references(() => activities.id),
    description: varchar("description", { length: 180 }),
    category: varchar("category", { length: 60 })
      .default("MISCELLANEOUS")
      .notNull(),
    expenseDate: date("expense_date").notNull(),
    enteredBy: uuid("entered_by")
      .references(() => users.id)
      .notNull(),
    bikeId: uuid("bike_id").references(() => bikes.id),
    amountPaise: integer("amount_paise").notNull(),
    litres: integer("litres_milli"),
    odometerKm: integer("odometer_km_milli"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripIdx: index("expenses_trip_idx").on(table.tripId),
    dateIdx: index("expenses_trip_date_idx").on(
      table.tripId,
      table.expenseDate,
    ),
  }),
);

export const expensePayments = pgTable(
  "expense_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .references(() => expenses.id)
      .notNull(),
    participantId: uuid("participant_id")
      .references(() => participants.id)
      .notNull(),
    amountPaise: integer("amount_paise").notNull(),
  },
  (table) => ({
    expenseIdx: index("expense_payments_expense_idx").on(table.expenseId),
    participantIdx: index("expense_payments_participant_idx").on(
      table.participantId,
    ),
  }),
);

export const expenseShares = pgTable(
  "expense_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .references(() => expenses.id)
      .notNull(),
    participantId: uuid("participant_id")
      .references(() => participants.id)
      .notNull(),
    amountPaise: integer("amount_paise").notNull(),
  },
  (table) => ({
    expenseIdx: index("expense_shares_expense_idx").on(table.expenseId),
    participantIdx: index("expense_shares_participant_idx").on(
      table.participantId,
    ),
  }),
);

export const expenseRevisions = pgTable("expense_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  expenseId: uuid("expense_id")
    .references(() => expenses.id)
    .notNull(),
  actorId: uuid("actor_id")
    .references(() => users.id)
    .notNull(),
  version: integer("version").notNull(),
  before: jsonb("before").notNull(),
  after: jsonb("after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const budgetRules = pgTable(
  "budget_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    ruleType: varchar("rule_type", { length: 30 }).notNull(),
    amountPaise: integer("amount_paise").notNull(),
    scope: varchar("scope", { length: 30 }).default("TRIP").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    active: boolean("active").default(true).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripActiveIdx: index("budget_rules_trip_active_idx").on(
      table.tripId,
      table.active,
    ),
  }),
);

export const budgetRuleHistory = pgTable("budget_rule_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  budgetRuleId: uuid("budget_rule_id")
    .references(() => budgetRules.id)
    .notNull(),
  actorId: uuid("actor_id")
    .references(() => users.id)
    .notNull(),
  oldAmountPaise: integer("old_amount_paise").notNull(),
  newAmountPaise: integer("new_amount_paise").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const settlementRounds = pgTable("settlement_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  snapshot: jsonb("snapshot").notNull(),
  status: settlementRoundStatus("status").default("open").notNull(),
  startedBy: uuid("started_by")
    .references(() => users.id)
    .notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const settlementTransfers = pgTable(
  "settlement_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roundId: uuid("round_id")
      .references(() => settlementRounds.id)
      .notNull(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => participants.id)
      .notNull(),
    receiverId: uuid("receiver_id")
      .references(() => participants.id)
      .notNull(),
    amountPaise: integer("amount_paise").notNull(),
    status: settlementTransferStatus("status").default("pending").notNull(),
    recordedBy: uuid("recorded_by")
      .references(() => users.id)
      .notNull(),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    reversalReason: text("reversal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripIdx: index("settlement_transfers_trip_idx").on(table.tripId),
    roundIdx: index("settlement_transfers_round_idx").on(table.roundId),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .references(() => trips.id)
      .notNull(),
    actorId: uuid("actor_id")
      .references(() => users.id)
      .notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tripCreatedIdx: index("audit_events_trip_created_idx").on(
      table.tripId,
      table.createdAt,
    ),
  }),
);

export const mutations = pgTable("mutations", {
  id: uuid("id").defaultRandom().primaryKey(),
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  actorId: uuid("actor_id")
    .references(() => users.id)
    .notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const restructuringProposals = pgTable("restructuring_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  kind: varchar("kind", { length: 60 }).notNull(),
  status: varchar("status", { length: 20 }).default("proposed").notNull(),
  beforeSnapshot: jsonb("before_snapshot").notNull(),
  afterSnapshot: jsonb("after_snapshot").notNull(),
  diff: jsonb("diff").notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const syncConflicts = pgTable("sync_conflicts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .references(() => trips.id)
    .notNull(),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  base: jsonb("base").notNull(),
  mine: jsonb("mine").notNull(),
  theirs: jsonb("theirs").notNull(),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  resolution: jsonb("resolution"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

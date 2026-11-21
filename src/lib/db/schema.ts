import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar, boolean, date, uniqueIndex, index } from "drizzle-orm/pg-core";

export const memberStatus = pgEnum("member_status", ["active", "inactive"]);
export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const activityStatus = pgEnum("activity_status", ["planned", "done", "skipped"]);
export const activityType = pgEnum("activity_type", ["TRAVEL", "STAY", "EXPLORATION", "CUSTOM"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authMagicLinks = pgTable("auth_magic_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const trips = pgTable("trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  currency: varchar("currency", { length: 3 }).default("INR").notNull(),
  timezone: varchar("timezone", { length: 80 }).default("Asia/Kolkata").notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }),
  status: memberStatus("status").default("active").notNull(),
  role: memberRole("role").default("member").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ tripMember: uniqueIndex("participants_trip_name_idx").on(table.tripId, table.name) }));

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  participantId: uuid("participant_id").references(() => participants.id).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const itineraryDays = pgTable("itinerary_days", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  dayNumber: integer("day_number").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ tripDay: uniqueIndex("itinerary_days_trip_day_idx").on(table.tripId, table.dayNumber) }));

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  dayId: uuid("day_id").references(() => itineraryDays.id).notNull(),
  type: activityType("type").default("CUSTOM").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  origin: text("origin"),
  destination: text("destination"),
  location: text("location"),
  mapsUrl: text("maps_url"),
  viaPoints: text("via_points"),
  bikeId: uuid("bike_id"),
  status: activityStatus("status").default("planned").notNull(),
  movable: boolean("movable").default(true).notNull(),
  archived: boolean("archived").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ tripDayIndex: index("activities_trip_day_idx").on(table.tripId, table.dayId) }));

export const bikes = pgTable("bikes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  model: varchar("model", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  activityId: uuid("activity_id").references(() => activities.id),
  description: varchar("description", { length: 180 }).notNull(),
  amountPaise: integer("amount_paise").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  actorId: uuid("actor_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mutations = pgTable("mutations", {
  id: uuid("id").defaultRandom().primaryKey(),
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
  tripId: uuid("trip_id").references(() => trips.id).notNull(),
  actorId: uuid("actor_id").references(() => users.id).notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

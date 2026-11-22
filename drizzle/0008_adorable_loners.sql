CREATE INDEX IF NOT EXISTS "audit_events_trip_created_idx" ON "audit_events" USING btree ("trip_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_rules_trip_active_idx" ON "budget_rules" USING btree ("trip_id","active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_payments_expense_idx" ON "expense_payments" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_payments_participant_idx" ON "expense_payments" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_shares_expense_idx" ON "expense_shares" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_shares_participant_idx" ON "expense_shares" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_trip_idx" ON "expenses" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_trip_date_idx" ON "expenses" USING btree ("trip_id","expense_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_transfers_trip_idx" ON "settlement_transfers" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settlement_transfers_round_idx" ON "settlement_transfers" USING btree ("round_id");

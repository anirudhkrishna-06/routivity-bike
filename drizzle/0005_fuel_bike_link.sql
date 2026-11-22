ALTER TABLE "expenses" ADD COLUMN "bike_id" uuid REFERENCES "bikes"("id");

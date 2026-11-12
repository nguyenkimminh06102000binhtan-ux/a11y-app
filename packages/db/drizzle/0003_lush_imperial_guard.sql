ALTER TABLE "scans" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "scans_status_created_at_index" ON "scans" USING btree ("status","created_at");
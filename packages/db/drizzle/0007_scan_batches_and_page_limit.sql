ALTER TABLE "scans" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "monthly_page_limit" integer;--> statement-breakpoint
CREATE INDEX "scans_batch_id_index" ON "scans" USING btree ("batch_id");
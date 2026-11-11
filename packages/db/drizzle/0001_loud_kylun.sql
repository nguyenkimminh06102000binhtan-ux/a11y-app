CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"rule_id" text NOT NULL,
	"impact" text,
	"page_url" text NOT NULL,
	"selector" text NOT NULL,
	"html" text NOT NULL,
	"summary" text,
	"help_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "scans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_scan_id_index" ON "issues" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "issues_site_id_fingerprint_index" ON "issues" USING btree ("site_id","fingerprint");--> statement-breakpoint
CREATE INDEX "scans_site_id_created_at_index" ON "scans" USING btree ("site_id","created_at");
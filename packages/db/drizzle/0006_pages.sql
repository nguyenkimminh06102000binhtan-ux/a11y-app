CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_site_id_url_unique" UNIQUE("site_id","url")
);
--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: every existing site gets its homepage, plus every page it has already scanned, so the Pages list
-- starts out matching the results owners already see. Same URL strings as scans.url (the homepage as
-- https://<domain>/, which is how the dashboard has always sent it).
INSERT INTO "pages" ("site_id", "url")
SELECT "id", 'https://' || "domain" || '/' FROM "sites"
UNION
SELECT DISTINCT "site_id", "url" FROM "scans"
ON CONFLICT ("site_id", "url") DO NOTHING;

ALTER TABLE "sites" DROP CONSTRAINT "sites_site_key_unique";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "widget_key" text DEFAULT 'acct_' || replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN "site_key";--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_widget_key_unique" UNIQUE("widget_key");
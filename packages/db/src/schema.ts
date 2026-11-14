import { pgTable, pgEnum, uuid, text, integer, timestamp, unique, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  widgetKey: text("widget_key")
    .notNull()
    .unique()
    .default(sql`'acct_' || replace(gen_random_uuid()::text, '-', '')`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.accountId, t.domain)]
).enableRLS();

/**
 * The widget's settings for one site: what the owner chose. No row = our defaults.
 * One JSON document, so new options need no migration. Its shape is SiteSettings in @app/widget-config:
 * always read it with readSiteSettings(), never trust it as is.
 */
export const widgetSettings = pgTable("widget_settings", {
  siteId: uuid("site_id")
    .primaryKey()
    .references(() => sites.id, { onDelete: "cascade" }),
  settings: jsonb("settings").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();


/**
 * The pages of a site that its owner wants checked (Audit › Pages). No limit on how many; the plan limits how
 * many different pages can be scanned per month. The homepage is added with the site; owners paste the rest.
 * `url` is the full address as scanned (no #fragment), the same string scans.url and issues.page_url use.
 */
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.siteId, t.url)]
).enableRLS();

export const scanStatus = pgEnum("scan_status", ["queued", "running", "done", "failed"]);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    status: scanStatus("status").notNull().default("queued"),
    issueCount: integer("issue_count").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
  },
  (t) => [index().on(t.siteId, t.createdAt), index().on(t.status, t.createdAt)]
).enableRLS();

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scanId: uuid("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(), // same issue = same fingerprint across scans
    ruleId: text("rule_id").notNull(),          // e.g. "image-alt", "color-contrast"
    impact: text("impact"),                     // minor | moderate | serious | critical
    pageUrl: text("page_url").notNull(),
    selector: text("selector").notNull(),       // where it is
    html: text("html").notNull(),               // the offending element's HTML
    summary: text("summary"),                   // what's wrong / how to fix
    help: text("help"),
    helpUrl: text("help_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.scanId), index().on(t.siteId, t.fingerprint)]
).enableRLS();




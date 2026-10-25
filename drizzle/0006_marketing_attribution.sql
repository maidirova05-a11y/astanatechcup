ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_source" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_content" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "utm_term" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "referrer" varchar(500);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "landing_path" varchar(255);
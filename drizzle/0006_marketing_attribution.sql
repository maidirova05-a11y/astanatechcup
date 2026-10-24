ALTER TABLE "applications" ADD COLUMN "utm_source" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "utm_medium" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "utm_campaign" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "utm_content" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "utm_term" varchar(120);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "referrer" varchar(500);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "landing_path" varchar(255);
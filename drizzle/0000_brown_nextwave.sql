CREATE TYPE "public"."application_status" AS ENUM('pending_payment', 'paid', 'confirmed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."contact_role" AS ENUM('participant', 'parent', 'teacher');--> statement-breakpoint
CREATE TABLE "admin_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" varchar(64),
	"user_agent" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "application_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32),
	"session_id" uuid,
	"ip" varchar(64),
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"team_name" varchar(120) NOT NULL,
	"discipline" varchar(32) NOT NULL,
	"organization" varchar(200) NOT NULL,
	"region" varchar(40) NOT NULL,
	"city" varchar(120) NOT NULL,
	"members" text NOT NULL,
	"member_count" integer NOT NULL,
	"contact_name" text NOT NULL,
	"contact_role" "contact_role" NOT NULL,
	"contact_email" text NOT NULL,
	"contact_email_hash" varchar(64) NOT NULL,
	"contact_phone" text NOT NULL,
	"comment" text,
	"consent_data" boolean NOT NULL,
	"consent_guardian" boolean NOT NULL,
	"consent_rules" boolean NOT NULL,
	"consent_media" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "application_status" DEFAULT 'pending_payment' NOT NULL,
	"payment_reference" varchar(255),
	"paid_at" timestamp with time zone,
	"locale" varchar(8) DEFAULT 'ru' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"type" varchar(64) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_login_attempts_lookup_idx" ON "admin_login_attempts" USING btree ("identifier","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_idx" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "application_audit_application_idx" ON "application_audit" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_audit_at_idx" ON "application_audit" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_reference_idx" ON "applications" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_dedupe_idx" ON "applications" USING btree ("contact_email_hash","team_name","discipline");--> statement-breakpoint
CREATE INDEX "applications_email_hash_idx" ON "applications" USING btree ("contact_email_hash");--> statement-breakpoint
CREATE INDEX "applications_discipline_idx" ON "applications" USING btree ("discipline");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_created_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events" USING btree ("processed_at");
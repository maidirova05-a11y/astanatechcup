CREATE TYPE "public"."match_state" AS ENUM('scheduled', 'live', 'completed');--> statement-breakpoint
CREATE TYPE "public"."run_state" AS ENUM('ok', 'dnf', 'foul', 'dsq');--> statement-breakpoint
CREATE TYPE "public"."scoring_stage" AS ENUM('group', 'playoff', 'final');--> statement-breakpoint
CREATE TYPE "public"."session_role" AS ENUM('admin', 'judge');--> statement-breakpoint
CREATE TABLE "scoring_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" varchar(16) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"before" text,
	"after" text,
	"session_id" uuid,
	"role" varchar(16),
	"ip" varchar(64),
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar(32) NOT NULL,
	"class_id" varchar(48) NOT NULL,
	"stage" "scoring_stage" DEFAULT 'group' NOT NULL,
	"group_label" varchar(8),
	"round_label" varchar(40),
	"red_team_id" uuid NOT NULL,
	"blue_team_id" uuid NOT NULL,
	"red_score" integer DEFAULT 0 NOT NULL,
	"blue_score" integer DEFAULT 0 NOT NULL,
	"red_yellow" integer DEFAULT 0 NOT NULL,
	"red_red" integer DEFAULT 0 NOT NULL,
	"blue_yellow" integer DEFAULT 0 NOT NULL,
	"blue_red" integer DEFAULT 0 NOT NULL,
	"state" "match_state" DEFAULT 'scheduled' NOT NULL,
	"winner_team_id" uuid,
	"is_draw" boolean DEFAULT false NOT NULL,
	"notes" text,
	"played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar(32) NOT NULL,
	"class_id" varchar(48) NOT NULL,
	"team_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"state" "run_state" DEFAULT 'ok' NOT NULL,
	"time_ms" integer,
	"points" integer,
	"remaining_ms" integer,
	"breakdown" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar(32) NOT NULL,
	"class_id" varchar(48) NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(120) NOT NULL,
	"organization" varchar(200),
	"region" varchar(40),
	"group_label" varchar(8),
	"application_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "role" "session_role" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
CREATE INDEX "scoring_audit_entity_idx" ON "scoring_audit" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "scoring_audit_at_idx" ON "scoring_audit" USING btree ("at");--> statement-breakpoint
CREATE INDEX "scoring_matches_category_idx" ON "scoring_matches" USING btree ("category_id","class_id");--> statement-breakpoint
CREATE INDEX "scoring_matches_state_idx" ON "scoring_matches" USING btree ("state");--> statement-breakpoint
CREATE INDEX "scoring_matches_played_idx" ON "scoring_matches" USING btree ("played_at");--> statement-breakpoint
CREATE INDEX "scoring_matches_red_idx" ON "scoring_matches" USING btree ("red_team_id");--> statement-breakpoint
CREATE INDEX "scoring_matches_blue_idx" ON "scoring_matches" USING btree ("blue_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_runs_attempt_idx" ON "scoring_runs" USING btree ("team_id","round_number");--> statement-breakpoint
CREATE INDEX "scoring_runs_category_idx" ON "scoring_runs" USING btree ("category_id","class_id");--> statement-breakpoint
CREATE INDEX "scoring_runs_created_idx" ON "scoring_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scoring_teams_code_idx" ON "scoring_teams" USING btree ("category_id","class_id","code");--> statement-breakpoint
CREATE INDEX "scoring_teams_category_idx" ON "scoring_teams" USING btree ("category_id","class_id");--> statement-breakpoint
CREATE INDEX "scoring_teams_application_idx" ON "scoring_teams" USING btree ("application_id");
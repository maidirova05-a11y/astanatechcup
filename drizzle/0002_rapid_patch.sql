CREATE TABLE "coach_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" varchar(64) NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "coach_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"coach_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" varchar(64),
	"user_agent" varchar(255)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "coach_accounts_email_idx" ON "coach_accounts" USING btree ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_sessions_token_idx" ON "coach_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "coach_sessions_account_idx" ON "coach_sessions" USING btree ("coach_account_id");--> statement-breakpoint
CREATE INDEX "coach_sessions_expires_idx" ON "coach_sessions" USING btree ("expires_at");
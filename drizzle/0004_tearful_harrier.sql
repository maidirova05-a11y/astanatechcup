ALTER TABLE "scoring_matches" ALTER COLUMN "red_team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scoring_matches" ALTER COLUMN "blue_team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scoring_matches" ADD COLUMN "red_from_match_id" uuid;--> statement-breakpoint
ALTER TABLE "scoring_matches" ADD COLUMN "blue_from_match_id" uuid;--> statement-breakpoint
CREATE INDEX "scoring_matches_red_from_idx" ON "scoring_matches" USING btree ("red_from_match_id");--> statement-breakpoint
CREATE INDEX "scoring_matches_blue_from_idx" ON "scoring_matches" USING btree ("blue_from_match_id");
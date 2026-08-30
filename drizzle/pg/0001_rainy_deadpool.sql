ALTER TABLE "household" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "household_member" ADD COLUMN "email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "household_invite_code" ON "household" USING btree ("invite_code");
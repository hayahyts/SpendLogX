CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"opening_balance_minor" integer DEFAULT 0 NOT NULL,
	"opening_balance_on" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "account_valuation" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"as_of" date NOT NULL,
	"value_minor" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"parent_id" text,
	"is_person_facing" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "household_member" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"relation" text,
	"member_user_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "txn" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"type" text NOT NULL,
	"occurred_on" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"tips_minor" integer DEFAULT 0 NOT NULL,
	"fee_minor" integer DEFAULT 0 NOT NULL,
	"account_id" text NOT NULL,
	"counter_account_id" text,
	"category_id" text,
	"person_id" text,
	"note" text,
	"is_opening" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"legacy_row_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "txn_amount_positive" CHECK ("txn"."amount_minor" > 0),
	CONSTRAINT "txn_tips_non_negative" CHECK ("txn"."tips_minor" >= 0),
	CONSTRAINT "txn_fee_non_negative" CHECK ("txn"."fee_minor" >= 0),
	CONSTRAINT "txn_transfer_shape" CHECK (("txn"."type" <> 'transfer') OR (
        "txn"."counter_account_id" IS NOT NULL
        AND "txn"."counter_account_id" <> "txn"."account_id"
        AND "txn"."category_id" IS NULL
        AND "txn"."tips_minor" = 0
      )),
	CONSTRAINT "txn_single_sided_shape" CHECK (("txn"."type" = 'transfer') OR (
        "txn"."counter_account_id" IS NULL AND "txn"."fee_minor" = 0
      )),
	CONSTRAINT "txn_tips_on_expenses_only" CHECK (("txn"."type" = 'expense') OR ("txn"."tips_minor" = 0))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_valuation" ADD CONSTRAINT "account_valuation_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_member" ADD CONSTRAINT "household_member_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_counter_account_id_account_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_household" ON "account" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "account_valuation_account" ON "account_valuation" USING btree ("account_id","as_of");--> statement-breakpoint
CREATE INDEX "category_household" ON "category" USING btree ("household_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "household_member_unique" ON "household_member" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE INDEX "person_household" ON "person" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "txn_household_date" ON "txn" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "txn_account" ON "txn" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "txn_category" ON "txn" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "txn_person" ON "txn" USING btree ("person_id");
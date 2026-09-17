CREATE TYPE "public"."color" AS ENUM('w', 'b');--> statement-breakpoint
CREATE TYPE "public"."game_result" AS ENUM('1-0', '0-1', '1/2-1/2', '*');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('chesscom', 'lichess');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"engine_version" varchar(50) NOT NULL,
	"depth" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_game_engine_depth_unique" UNIQUE("game_id","engine_version","depth")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "platform" NOT NULL,
	"source_id" varchar(100) NOT NULL,
	"pgn" text NOT NULL,
	"url" text NOT NULL,
	"white" varchar(100) NOT NULL,
	"black" varchar(100) NOT NULL,
	"white_elo" integer,
	"black_elo" integer,
	"result" "game_result" NOT NULL,
	"rated" boolean NOT NULL,
	"time_control" varchar(50) NOT NULL,
	"eco" varchar(10),
	"opening" varchar(200),
	"ended_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_source_source_id_unique" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "linked_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"username" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linked_accounts_user_platform_unique" UNIQUE("user_id","platform")
);
--> statement-breakpoint
CREATE TABLE "move_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"ply" integer NOT NULL,
	"color" "color" NOT NULL,
	"label" varchar(20) NOT NULL,
	"delta_win" real NOT NULL,
	"cp_loss" real NOT NULL,
	"phase" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"games_analyzed" integer DEFAULT 0 NOT NULL,
	"avg_accuracy" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_labels" ADD CONSTRAINT "move_labels_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_white_idx" ON "games" USING btree ("white");--> statement-breakpoint
CREATE INDEX "games_black_idx" ON "games" USING btree ("black");--> statement-breakpoint
CREATE INDEX "linked_accounts_platform_username_idx" ON "linked_accounts" USING btree ("platform","username");--> statement-breakpoint
CREATE INDEX "move_labels_analysis_idx" ON "move_labels" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "move_labels_label_idx" ON "move_labels" USING btree ("label");
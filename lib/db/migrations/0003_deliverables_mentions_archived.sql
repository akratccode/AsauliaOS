CREATE TABLE "deliverable_comment_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliverable_comment_mentions" ADD CONSTRAINT "deliverable_comment_mentions_comment_id_deliverable_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."deliverable_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_comment_mentions" ADD CONSTRAINT "deliverable_comment_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
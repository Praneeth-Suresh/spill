ALTER TABLE `questions` ADD `pointsAwarded` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `facilities` DROP COLUMN `pointsAwarded`;
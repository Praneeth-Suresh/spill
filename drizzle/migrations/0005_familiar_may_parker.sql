CREATE TABLE `experiment_exposures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`device_id` varchar(64) NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`experiment_key` varchar(100) NOT NULL,
	`variation_id` varchar(50) NOT NULL,
	`page_path` varchar(255),
	`question_id` int,
	`ip_address` varchar(45),
	`user_agent` text,
	`exposed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `experiment_exposures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`variations` json NOT NULL,
	`weights` json,
	`coverage` int DEFAULT 100,
	`condition` json,
	`page_path` varchar(255),
	`question_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `experiments_id` PRIMARY KEY(`id`),
	CONSTRAINT `experiments_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
ALTER TABLE `experiments` ADD CONSTRAINT `experiments_question_id_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE no action ON UPDATE no action;
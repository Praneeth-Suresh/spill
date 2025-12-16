CREATE TABLE `admin_facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`facilityId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	CONSTRAINT `admin_facilities_id` PRIMARY KEY(`id`)
);

CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `facilities_name_unique` UNIQUE(`name`),
	CONSTRAINT `facilities_code_unique` UNIQUE(`code`)
);

CREATE TABLE `ip_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ip_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `ip_addresses_ipAddress_unique` UNIQUE(`ipAddress`)
);

CREATE TABLE `points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`points` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `points_id` PRIMARY KEY(`id`),
	CONSTRAINT `points_ipAddress_unique` UNIQUE(`ipAddress`)
);

CREATE TABLE `question_branching` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`optionId` int,
	`condition` enum('option_selected','any_answer','no_answer') NOT NULL,
	`nextQuestionId` int,
	`redirectToHome` boolean NOT NULL DEFAULT false,
	`priority` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_branching_id` PRIMARY KEY(`id`)
);

CREATE TABLE `question_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`optionText` varchar(500) NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_options_id` PRIMARY KEY(`id`)
);

CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`type` enum('poll','text','fill_blanks','file_upload') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`placeholder` varchar(255),
	`isRequired` boolean NOT NULL DEFAULT true,
	`allowMultiple` boolean NOT NULL DEFAULT false,
	`maxFileSize` int,
	`allowedFileTypes` text,
	`nextQuestionId` int,
	`redirectToHome` boolean NOT NULL DEFAULT true,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`pointsAwarded` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `response_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`questionId` int NOT NULL,
	`optionId` int,
	`textAnswer` text,
	`fileId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `response_answers_id` PRIMARY KEY(`id`)
);

CREATE TABLE `responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`facilityId` int NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`userAgent` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`sessionId` varchar(64),
	CONSTRAINT `responses_id` PRIMARY KEY(`id`)
);

CREATE TABLE `updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL DEFAULT (now()),
	`person` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`relevance` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `updates_id` PRIMARY KEY(`id`)
);

CREATE TABLE `uploaded_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uploaded_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `uploaded_files_fileKey_unique` UNIQUE(`fileKey`)
);

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin','super_admin') NOT NULL DEFAULT 'user',
	`points` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

ALTER TABLE `question_branching` ADD CONSTRAINT `question_branching_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE no action ON UPDATE no action;
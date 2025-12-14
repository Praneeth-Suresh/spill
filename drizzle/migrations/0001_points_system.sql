ALTER TABLE `users`
  ADD COLUMN `points` int NOT NULL DEFAULT 0;

ALTER TABLE `questions`
  ADD COLUMN `pointsAwarded` int NOT NULL DEFAULT 0;

CREATE TABLE `points` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ipAddress` varchar(45) NOT NULL,
  `points` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `points_id` PRIMARY KEY(`id`),
  CONSTRAINT `points_ipAddress_unique` UNIQUE(`ipAddress`)
);

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
--> statement-breakpoint
CREATE TABLE `ip_addresses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ipAddress` varchar(45) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ip_addresses_id` PRIMARY KEY(`id`),
  CONSTRAINT `ip_addresses_ipAddress_unique` UNIQUE(`ipAddress`)
);

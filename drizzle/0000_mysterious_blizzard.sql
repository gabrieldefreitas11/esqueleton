CREATE TABLE `download_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`resourceType` varchar(64),
	`resourceId` int,
	`usedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `download_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`resourceType` varchar(64),
	`resourceId` int,
	`mpPreferenceId` varchar(255),
	`mpPaymentId` varchar(255),
	`mpStatus` varchar(100),
	`amount` decimal(10,2) DEFAULT '0.00',
	`currency` varchar(10) DEFAULT 'BRL',
	`status` enum('pending','approved','rejected','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`payerEmail` varchar(320),
	`initPoint` text,
	`abandonedEmailSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`defaultProductPrice` decimal(10,2) NOT NULL DEFAULT '9.90',
	`subscriptionMonthlyPrice` decimal(10,2) NOT NULL DEFAULT '29.90',
	`subscriptionAnnualPrice` decimal(10,2) NOT NULL DEFAULT '299.00',
	`whatsappEnabled` boolean NOT NULL DEFAULT false,
	`whatsappNumber` varchar(32),
	`whatsappMessage` text,
	`whatsappCtaText` varchar(120),
	`whatsappAnimation` varchar(20) NOT NULL DEFAULT 'pulse',
	`whatsappPosition` varchar(20) NOT NULL DEFAULT 'right',
	`headScripts` text,
	`bodyScripts` text,
	`xgateEmail` varchar(320),
	`xgatePassword` varchar(255),
	`xgateApiBaseUrl` varchar(255),
	`xgateDefaultCustomerId` varchar(120),
	`mercadopagoAccessToken` text,
	`mercadopagoSubscriptionBackUrl` text,
	`llmApiKey` varchar(255),
	`mailjetApiKey` varchar(255),
	`mailjetApiSecret` varchar(255),
	`mailjetFromEmail` varchar(320),
	`mailjetFromName` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planCode` varchar(64) NOT NULL DEFAULT 'unlimited_monthly',
	`mpPreapprovalId` varchar(255),
	`mpStatus` varchar(100),
	`status` enum('pending','active','paused','cancelled','expired') NOT NULL DEFAULT 'pending',
	`amount` decimal(10,2) DEFAULT '29.90',
	`currency` varchar(10) DEFAULT 'BRL',
	`payerEmail` varchar(320),
	`initPoint` text,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`passwordHash` varchar(255),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

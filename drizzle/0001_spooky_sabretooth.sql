ALTER TABLE `site_settings` ADD `googleClientId` varchar(255);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `googleClientSecret` varchar(255);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `recaptchaSiteKey` varchar(255);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `recaptchaSecretKey` varchar(255);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `recaptchaMinScore` decimal(3,2) DEFAULT '0.50' NOT NULL;
ALTER TABLE `account` ADD COLUMN `accessTokenExpiresAt` integer;
ALTER TABLE `account` ADD COLUMN `refreshTokenExpiresAt` integer;
ALTER TABLE `account` ADD COLUMN `scope` text;

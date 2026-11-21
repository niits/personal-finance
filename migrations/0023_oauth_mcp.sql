-- OAuth 2.1 tables for the Better Auth `mcp` plugin (oidc-provider schema).
-- MCP clients register dynamically and receive per-user access tokens.

CREATE TABLE IF NOT EXISTS `oauthApplication` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `icon` text,
  `metadata` text,
  `clientId` text NOT NULL UNIQUE,
  `clientSecret` text,
  `redirectUrls` text NOT NULL,
  `type` text NOT NULL,
  `disabled` integer DEFAULT 0,
  `userId` text REFERENCES `user`(`id`) ON DELETE CASCADE,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `oauthApplication_userId_idx` ON `oauthApplication` (`userId`);

CREATE TABLE IF NOT EXISTS `oauthAccessToken` (
  `id` text PRIMARY KEY NOT NULL,
  `accessToken` text NOT NULL UNIQUE,
  `refreshToken` text NOT NULL UNIQUE,
  `accessTokenExpiresAt` integer NOT NULL,
  `refreshTokenExpiresAt` integer NOT NULL,
  `clientId` text NOT NULL REFERENCES `oauthApplication`(`clientId`) ON DELETE CASCADE,
  `userId` text REFERENCES `user`(`id`) ON DELETE CASCADE,
  `scopes` text NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `oauthAccessToken_clientId_idx` ON `oauthAccessToken` (`clientId`);
CREATE INDEX IF NOT EXISTS `oauthAccessToken_userId_idx` ON `oauthAccessToken` (`userId`);

CREATE TABLE IF NOT EXISTS `oauthConsent` (
  `id` text PRIMARY KEY NOT NULL,
  `clientId` text NOT NULL REFERENCES `oauthApplication`(`clientId`) ON DELETE CASCADE,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `scopes` text NOT NULL,
  `consentGiven` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `oauthConsent_clientId_idx` ON `oauthConsent` (`clientId`);
CREATE INDEX IF NOT EXISTS `oauthConsent_userId_idx` ON `oauthConsent` (`userId`);

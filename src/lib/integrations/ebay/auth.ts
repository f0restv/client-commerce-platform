/**
 * eBay OAuth Authentication Module
 *
 * Handles OAuth 2.0 authentication flow for eBay API:
 * - Authorization URL generation
 * - Authorization code exchange
 * - Token refresh
 * - App-level token (client_credentials grant)
 */

import { db } from "@/lib/db";

// =============================================================================
// Types
// =============================================================================

export interface EbayTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface EbayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  devId?: string;
  sandbox: boolean;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// =============================================================================
// Configuration
// =============================================================================

const getConfig = (): EbayConfig => ({
  clientId: process.env.EBAY_CLIENT_ID!,
  clientSecret: process.env.EBAY_CLIENT_SECRET!,
  redirectUri: process.env.EBAY_REDIRECT_URI!,
  devId: process.env.EBAY_DEV_ID,
  sandbox: process.env.EBAY_SANDBOX === "true",
});

// URL helpers
const getAuthBaseUrl = (sandbox: boolean) =>
  sandbox ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";

const getApiBaseUrl = (sandbox: boolean) =>
  sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

// OAuth scopes
const OAUTH_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
];

// =============================================================================
// OAuth Flow
// =============================================================================

/**
 * Generate the eBay OAuth authorization URL
 * @param state - State parameter for CSRF protection (typically clientId)
 */
export function getAuthUrl(state: string): string {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    state,
  });

  return `${getAuthBaseUrl(config.sandbox)}/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param code - Authorization code from eBay callback
 */
export async function exchangeCodeForToken(code: string): Promise<EbayTokens> {
  const config = getConfig();
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${getApiBaseUrl(config.sandbox)}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay token exchange failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 * @param refreshToken - The refresh token to use
 */
export async function refreshToken(refreshToken: string): Promise<EbayTokens> {
  const config = getConfig();
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${getApiBaseUrl(config.sandbox)}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: OAUTH_SCOPES.join(" "),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay token refresh failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get an app-level access token (client_credentials grant)
 * Used for API calls that don't require user authorization (e.g., Browse API)
 */
export async function getAppToken(): Promise<string> {
  const config = getConfig();
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${getApiBaseUrl(config.sandbox)}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay app token failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// =============================================================================
// Token Storage & Management (Platform-level)
// =============================================================================

/**
 * Store tokens for the platform eBay connection
 */
export async function storePlatformTokens(tokens: EbayTokens): Promise<void> {
  await db.platformConnection.upsert({
    where: { platform: "EBAY" },
    create: {
      platform: "EBAY",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      isActive: true,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      isActive: true,
    },
  });
}

/**
 * Get a valid access token for the platform connection
 * Automatically refreshes if expired
 */
export async function getPlatformAccessToken(): Promise<string> {
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  if (!connection || !connection.accessToken) {
    throw new Error("eBay not connected. Please connect via OAuth.");
  }

  // Check if token is expired or about to expire (5 min buffer)
  const bufferMs = 5 * 60 * 1000;
  if (connection.expiresAt && connection.expiresAt.getTime() - bufferMs < Date.now()) {
    if (!connection.refreshToken) {
      throw new Error("eBay token expired and no refresh token available.");
    }

    const tokens = await refreshToken(connection.refreshToken);
    await storePlatformTokens(tokens);
    return tokens.access_token;
  }

  return connection.accessToken;
}

/**
 * Force refresh the platform token even if not expired
 */
export async function forcePlatformTokenRefresh(): Promise<string> {
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  if (!connection?.refreshToken) {
    throw new Error("eBay not connected or no refresh token available.");
  }

  const tokens = await refreshToken(connection.refreshToken);
  await storePlatformTokens(tokens);
  return tokens.access_token;
}

/**
 * Mark the platform connection as inactive (e.g., on auth failure)
 */
export async function deactivatePlatformConnection(): Promise<void> {
  await db.platformConnection.update({
    where: { platform: "EBAY" },
    data: { isActive: false },
  });
}

// =============================================================================
// Token Storage & Management (Client-level)
// =============================================================================

/**
 * Store tokens for a specific client's eBay integration
 * Note: Requires ClientIntegration model in schema
 */
export async function storeClientTokens(
  clientId: string,
  tokens: EbayTokens
): Promise<void> {
  // Check if ClientIntegration model exists, fall back to platform connection
  try {
    await (db as any).clientIntegration.upsert({
      where: {
        clientId_platform: { clientId, platform: "EBAY" },
      },
      create: {
        clientId,
        platform: "EBAY",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  } catch {
    // Fall back to platform-level storage if ClientIntegration doesn't exist
    await storePlatformTokens(tokens);
  }
}

/**
 * Get a valid access token for a client's eBay integration
 * Falls back to platform token if client-specific not available
 */
export async function getClientAccessToken(clientId: string): Promise<string> {
  try {
    const integration = await (db as any).clientIntegration.findUnique({
      where: {
        clientId_platform: { clientId, platform: "EBAY" },
      },
    });

    if (integration?.accessToken) {
      // Check if token is expired
      const bufferMs = 5 * 60 * 1000;
      if (integration.expiresAt && integration.expiresAt.getTime() - bufferMs < Date.now()) {
        if (!integration.refreshToken) {
          throw new Error("Client eBay token expired.");
        }
        const tokens = await refreshToken(integration.refreshToken);
        await storeClientTokens(clientId, tokens);
        return tokens.access_token;
      }
      return integration.accessToken;
    }
  } catch {
    // ClientIntegration model doesn't exist, use platform token
  }

  // Fall back to platform token
  return getPlatformAccessToken();
}

/**
 * Ensure we have a valid token, refreshing if necessary
 * Used by other modules that need an access token
 */
export async function ensureValidToken(
  integration?: { accessToken: string; refreshToken?: string | null; expiresAt: Date | null }
): Promise<string> {
  if (!integration) {
    return getPlatformAccessToken();
  }

  const bufferMs = 5 * 60 * 1000;
  if (integration.expiresAt && integration.expiresAt.getTime() - bufferMs < Date.now()) {
    if (!integration.refreshToken) {
      throw new Error("Token expired and no refresh token available.");
    }
    const tokens = await refreshToken(integration.refreshToken);
    return tokens.access_token;
  }

  return integration.accessToken;
}

// =============================================================================
// Utility Exports
// =============================================================================

export { getConfig, getApiBaseUrl, getAuthBaseUrl, OAUTH_SCOPES };

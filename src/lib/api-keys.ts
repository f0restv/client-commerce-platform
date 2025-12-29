/**
 * API Key Validation
 *
 * Simple API key validation for platform API endpoints.
 * In production, extend this with database storage and rate limiting.
 */

// Valid API keys - in production, store in database with per-key rate limits
const VALID_KEYS = new Set(
  [
    process.env.COLLEKTIQ_API_KEY,
    process.env.PLATFORM_API_KEY,
    // For development/testing
    process.env.NODE_ENV === 'development' ? 'ck_test_dev_key' : null,
  ].filter(Boolean)
);

export interface ApiKeyInfo {
  valid: boolean;
  name?: string;
  rateLimit?: RateLimits;
}

export interface RateLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
}

/**
 * Validate an API key
 */
export function validateApiKey(key: string | null): boolean {
  if (!key) return false;
  return VALID_KEYS.has(key);
}

/**
 * Get detailed info about an API key
 */
export function getApiKeyInfo(key: string | null): ApiKeyInfo {
  if (!key || !VALID_KEYS.has(key)) {
    return { valid: false };
  }

  // Determine key name based on env var match
  let name = 'unknown';
  if (key === process.env.COLLEKTIQ_API_KEY) {
    name = 'collektiq';
  } else if (key === process.env.PLATFORM_API_KEY) {
    name = 'platform';
  } else if (key === 'ck_test_dev_key') {
    name = 'development';
  }

  return {
    valid: true,
    name,
    rateLimit: getRateLimits(key),
  };
}

/**
 * Get rate limits for an API key
 */
export function getRateLimits(key: string): RateLimits {
  // In production, lookup key-specific limits from database
  // For now, return default limits
  return {
    requestsPerMinute: 60,
    requestsPerDay: 10000,
  };
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(headers: Headers): string | null {
  // Support both x-api-key and Authorization: Bearer headers
  const apiKey = headers.get('x-api-key');
  if (apiKey) return apiKey;

  const auth = headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  return null;
}

/**
 * Validate request and return error response if invalid
 */
export function validateRequest(headers: Headers): { valid: boolean; error?: Response } {
  const apiKey = extractApiKey(headers);

  if (!validateApiKey(apiKey)) {
    return {
      valid: false,
      error: new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or missing API key',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { valid: true };
}

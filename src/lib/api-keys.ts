/**
 * API Key Validation with Rate Limiting
 *
 * Features:
 * - Per-key rate limiting with Redis (falls back to memory)
 * - Key hashing for secure comparison
 * - Detailed usage tracking
 * - Rate limit headers in responses
 * - Structured logging
 *
 * Usage:
 *   const result = await validateRequest(headers);
 *   if (!result.valid) {
 *     return result.error;
 *   }
 *   // Continue with request...
 */

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { cache } from './redis';
import { createLogger } from './logger';

const log = createLogger({ service: 'api-auth' });

// ============================================================================
// TYPES
// ============================================================================

export interface ApiKeyConfig {
  name: string;
  key: string;
  rateLimit: RateLimits;
  scopes?: string[];
}

export interface RateLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface ApiKeyInfo {
  valid: boolean;
  name?: string;
  keyHash?: string;
  rateLimit?: RateLimits;
  scopes?: string[];
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
    day: number;
  };
  resetAt: {
    minute: Date;
    hour: Date;
    day: Date;
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: NextResponse;
  keyInfo?: ApiKeyInfo;
  rateLimit?: RateLimitStatus;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_RATE_LIMITS: RateLimits = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
};

const ELEVATED_RATE_LIMITS: RateLimits = {
  requestsPerMinute: 120,
  requestsPerHour: 5000,
  requestsPerDay: 50000,
};

/**
 * Get configured API keys.
 * In production, these could come from a database.
 */
function getApiKeyConfigs(): ApiKeyConfig[] {
  const configs: ApiKeyConfig[] = [];

  if (process.env.COLLEKTIQ_API_KEY) {
    configs.push({
      name: 'collektiq',
      key: process.env.COLLEKTIQ_API_KEY,
      rateLimit: ELEVATED_RATE_LIMITS,
      scopes: ['analyze', 'inventory', 'pricing'],
    });
  }

  if (process.env.PLATFORM_API_KEY) {
    configs.push({
      name: 'platform',
      key: process.env.PLATFORM_API_KEY,
      rateLimit: ELEVATED_RATE_LIMITS,
      scopes: ['*'], // All scopes
    });
  }

  // Development key (only in dev mode)
  if (process.env.NODE_ENV === 'development') {
    configs.push({
      name: 'development',
      key: 'ck_test_dev_key',
      rateLimit: DEFAULT_RATE_LIMITS,
      scopes: ['*'],
    });
  }

  return configs;
}

// ============================================================================
// KEY VALIDATION
// ============================================================================

/**
 * Hash an API key for secure storage/comparison.
 */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Find API key config by key value.
 */
function findKeyConfig(key: string): ApiKeyConfig | null {
  const configs = getApiKeyConfigs();
  return configs.find((c) => c.key === key) || null;
}

/**
 * Validate an API key and return info.
 */
export function validateApiKey(key: string | null): ApiKeyInfo {
  if (!key) {
    return { valid: false };
  }

  const config = findKeyConfig(key);
  if (!config) {
    log.warn({ keyPrefix: key.slice(0, 8) + '...' }, 'Invalid API key attempt');
    return { valid: false };
  }

  return {
    valid: true,
    name: config.name,
    keyHash: hashKey(key),
    rateLimit: config.rateLimit,
    scopes: config.scopes,
  };
}

/**
 * Get detailed info about an API key.
 */
export function getApiKeyInfo(key: string | null): ApiKeyInfo {
  return validateApiKey(key);
}

/**
 * Get rate limits for an API key.
 */
export function getRateLimits(key: string): RateLimits {
  const config = findKeyConfig(key);
  return config?.rateLimit || DEFAULT_RATE_LIMITS;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check and update rate limits for a key.
 */
async function checkRateLimit(keyHash: string, limits: RateLimits): Promise<RateLimitStatus> {
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60000);
  const hourWindow = Math.floor(now / 3600000);
  const dayWindow = Math.floor(now / 86400000);

  const minuteKey = `ratelimit:${keyHash}:minute:${minuteWindow}`;
  const hourKey = `ratelimit:${keyHash}:hour:${hourWindow}`;
  const dayKey = `ratelimit:${keyHash}:day:${dayWindow}`;

  // Get current counts
  const [minuteCount, hourCount, dayCount] = await Promise.all([
    cache.get<number>(minuteKey) || 0,
    cache.get<number>(hourKey) || 0,
    cache.get<number>(dayKey) || 0,
  ]);

  // Check if any limit exceeded
  const allowed =
    (minuteCount as number) < limits.requestsPerMinute &&
    (hourCount as number) < limits.requestsPerHour &&
    (dayCount as number) < limits.requestsPerDay;

  // Increment counters if allowed
  if (allowed) {
    await Promise.all([
      cache.set(minuteKey, (minuteCount as number) + 1, { ttl: 60 }),
      cache.set(hourKey, (hourCount as number) + 1, { ttl: 3600 }),
      cache.set(dayKey, (dayCount as number) + 1, { ttl: 86400 }),
    ]);
  }

  return {
    allowed,
    remaining: {
      minute: Math.max(0, limits.requestsPerMinute - (minuteCount as number) - 1),
      hour: Math.max(0, limits.requestsPerHour - (hourCount as number) - 1),
      day: Math.max(0, limits.requestsPerDay - (dayCount as number) - 1),
    },
    resetAt: {
      minute: new Date((minuteWindow + 1) * 60000),
      hour: new Date((hourWindow + 1) * 3600000),
      day: new Date((dayWindow + 1) * 86400000),
    },
  };
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

/**
 * Extract API key from request headers.
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
 * Add rate limit headers to a response.
 */
function addRateLimitHeaders(
  headers: Record<string, string>,
  status: RateLimitStatus
): void {
  headers['X-RateLimit-Limit-Minute'] = String(status.remaining.minute + 1);
  headers['X-RateLimit-Remaining-Minute'] = String(status.remaining.minute);
  headers['X-RateLimit-Reset-Minute'] = status.resetAt.minute.toISOString();
  headers['X-RateLimit-Limit-Hour'] = String(status.remaining.hour + 1);
  headers['X-RateLimit-Remaining-Hour'] = String(status.remaining.hour);
}

/**
 * Validate request with rate limiting.
 * Returns error response if validation fails.
 */
export async function validateRequest(
  headers: Headers,
  options?: { scope?: string }
): Promise<ValidationResult> {
  const apiKey = extractApiKey(headers);
  const keyInfo = validateApiKey(apiKey);

  // Check key validity
  if (!keyInfo.valid || !keyInfo.keyHash) {
    log.warn({ hasKey: !!apiKey }, 'API request with invalid key');
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or missing API key',
        },
        { status: 401 }
      ),
    };
  }

  // Check scope if required
  if (options?.scope && keyInfo.scopes) {
    const hasScope = keyInfo.scopes.includes('*') || keyInfo.scopes.includes(options.scope);
    if (!hasScope) {
      log.warn(
        { keyName: keyInfo.name, requiredScope: options.scope },
        'API key lacks required scope'
      );
      return {
        valid: false,
        error: NextResponse.json(
          {
            error: 'Forbidden',
            message: `API key does not have access to scope: ${options.scope}`,
          },
          { status: 403 }
        ),
      };
    }
  }

  // Check rate limits
  const rateLimits = keyInfo.rateLimit || DEFAULT_RATE_LIMITS;
  const rateStatus = await checkRateLimit(keyInfo.keyHash, rateLimits);

  if (!rateStatus.allowed) {
    log.warn(
      {
        keyName: keyInfo.name,
        remaining: rateStatus.remaining,
        resetAt: rateStatus.resetAt.minute,
      },
      'Rate limit exceeded'
    );

    const responseHeaders: Record<string, string> = {};
    addRateLimitHeaders(responseHeaders, rateStatus);
    responseHeaders['Retry-After'] = String(
      Math.ceil((rateStatus.resetAt.minute.getTime() - Date.now()) / 1000)
    );

    return {
      valid: false,
      error: NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please retry later.',
          retryAfter: rateStatus.resetAt.minute.toISOString(),
        },
        {
          status: 429,
          headers: responseHeaders,
        }
      ),
      keyInfo,
      rateLimit: rateStatus,
    };
  }

  log.debug(
    {
      keyName: keyInfo.name,
      remaining: rateStatus.remaining.minute,
    },
    'API request validated'
  );

  return {
    valid: true,
    keyInfo,
    rateLimit: rateStatus,
  };
}

/**
 * Create response with rate limit headers.
 */
export function withRateLimitHeaders<T>(
  data: T,
  rateLimit: RateLimitStatus,
  status = 200
): NextResponse {
  const headers: Record<string, string> = {};
  addRateLimitHeaders(headers, rateLimit);

  return NextResponse.json(data, { status, headers });
}

export default {
  validateRequest,
  validateApiKey,
  extractApiKey,
  getApiKeyInfo,
  getRateLimits,
  withRateLimitHeaders,
};

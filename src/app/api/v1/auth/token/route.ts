import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, getApiKeyInfo, getRateLimits } from '@/lib/api-keys';

/**
 * POST /api/v1/auth/token
 *
 * Validate an API key and return token info.
 * This endpoint is useful for client apps to verify their API key is valid.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'apiKey is required',
        },
        { status: 400 }
      );
    }

    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid API key',
          valid: false,
        },
        { status: 401 }
      );
    }

    const keyInfo = getApiKeyInfo(apiKey);
    const rateLimits = getRateLimits(apiKey);

    return NextResponse.json({
      valid: true,
      name: keyInfo.name,
      rateLimits: {
        requestsPerMinute: rateLimits.requestsPerMinute,
        requestsPerDay: rateLimits.requestsPerDay,
      },
      endpoints: {
        analyze: '/api/v1/analyze',
        pricing: '/api/v1/pricing',
        inventory: '/api/v1/inventory',
      },
    });
  } catch (error) {
    console.error('[API v1] auth/token error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/auth/token
 *
 * Return API documentation for authentication.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/auth/token',
    method: 'POST',
    description: 'Validate an API key and get token information',
    request: {
      apiKey: 'string - The API key to validate',
    },
    response: {
      valid: 'boolean - Whether the key is valid',
      name: 'string - Name/identifier for the key',
      rateLimits: {
        requestsPerMinute: 'number',
        requestsPerDay: 'number',
      },
      endpoints: 'object - Available API endpoints',
    },
    authentication: {
      methods: ['x-api-key header', 'Authorization: Bearer token'],
      example: {
        header: 'x-api-key: ck_live_xxxxxxxxxxxxx',
        bearer: 'Authorization: Bearer ck_live_xxxxxxxxxxxxx',
      },
    },
  });
}

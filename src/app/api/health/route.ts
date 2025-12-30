import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/redis';

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    cache?: ServiceStatus;
  };
  environment: string;
}

const startTime = Date.now();

const log = logger.child({ service: 'health' });

async function checkCache(): Promise<ServiceStatus & { type: 'redis' | 'memory' }> {
  const start = Date.now();
  try {
    const health = await cache.health();
    const latencyMs = Date.now() - start;
    log.debug({ latencyMs, type: health.type, size: health.size }, 'Cache health check passed');
    return {
      status: health.available ? 'healthy' : 'degraded',
      latencyMs,
      type: health.type,
      message: health.available ? undefined : 'Cache unavailable, using fallback',
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    log.error({ error, latencyMs }, 'Cache health check failed');
    return {
      status: 'degraded',
      latencyMs,
      type: 'memory',
      message: error instanceof Error ? error.message : 'Cache check failed',
    };
  }
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    log.debug({ latencyMs }, 'Database health check passed');
    return {
      status: 'healthy',
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    log.error({ error, latencyMs }, 'Database health check failed');
    return {
      status: 'unhealthy',
      latencyMs,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

function determineOverallStatus(services: Record<string, ServiceStatus>): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services);

  if (statuses.every(s => s.status === 'healthy')) {
    return 'healthy';
  }

  if (statuses.some(s => s.status === 'unhealthy')) {
    // If critical services are down, overall is unhealthy
    if (services.database?.status === 'unhealthy') {
      return 'unhealthy';
    }
    return 'degraded';
  }

  return 'degraded';
}

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancers.
 * Returns service status and basic diagnostics.
 */
export async function GET() {
  const [database, cacheStatus] = await Promise.all([
    checkDatabase(),
    checkCache(),
  ]);

  const services = {
    database,
    cache: cacheStatus,
  };

  const status = determineOverallStatus(services);

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services,
    environment: process.env.NODE_ENV || 'development',
  };

  // Return 503 for unhealthy, 200 for healthy/degraded
  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * HEAD /api/health
 *
 * Lightweight health check - just returns status code.
 * Useful for load balancer health checks.
 */
export async function HEAD() {
  try {
    await db.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

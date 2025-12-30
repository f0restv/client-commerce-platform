import pino from 'pino';

/**
 * Structured logger for the application.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Payment failed', { orderId: '456', error: err });
 *
 *   // Create a child logger with context
 *   const log = logger.child({ service: 'market-data', provider: 'greysheet' });
 *   log.info('Cache refreshed', { itemCount: 100 });
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Base configuration
const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
    ],
    censor: '[REDACTED]',
  },

  // Add timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Format error objects properly
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}), // Remove pid and hostname in production
  },
};

// Development: pretty print
// Production: JSON for log aggregation
const transport = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  ...baseConfig,
  transport,
});

/**
 * Create a logger for a specific service/module.
 * Adds consistent context to all log messages.
 */
export function createLogger(context: {
  service: string;
  module?: string;
  [key: string]: unknown;
}) {
  return logger.child(context);
}

/**
 * Log levels available:
 * - trace: Very detailed debugging
 * - debug: Debugging information
 * - info: General information (default in production)
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Critical errors that may crash the app
 */

/**
 * Helper for logging API requests with consistent format.
 */
export function logRequest(req: {
  method: string;
  url: string;
  headers?: { [key: string]: string | undefined };
  userId?: string;
}) {
  return logger.child({
    type: 'request',
    method: req.method,
    url: req.url,
    userId: req.userId,
  });
}

/**
 * Helper for logging errors with stack traces.
 */
export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  const errorInfo = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : { error: String(error) };

  logger.error({ ...errorInfo, ...context }, message);
}

/**
 * Performance timing helper.
 *
 * Usage:
 *   const timer = startTimer('database-query');
 *   await db.query(...);
 *   timer.done({ rowCount: 100 });
 */
export function startTimer(operation: string, context?: Record<string, unknown>) {
  const start = Date.now();
  const log = logger.child({ operation, ...context });

  return {
    done: (result?: Record<string, unknown>) => {
      const durationMs = Date.now() - start;
      log.info({ durationMs, ...result }, `${operation} completed`);
    },
    fail: (error: unknown) => {
      const durationMs = Date.now() - start;
      logError(`${operation} failed`, error, { durationMs, ...context });
    },
  };
}

export default logger;

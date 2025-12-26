import { Inngest } from 'inngest';
import prisma from '@/lib/db';
import { scrapeAndSync } from './sync';

/**
 * Source info type for scraping queries
 */
type SourceWithFrequency = {
  id: string;
  name: string;
  scrapeFrequency: number;
  lastScrapedAt: Date | null;
};

type BasicSource = {
  id: string;
  name: string;
};

/**
 * Inngest client for background job processing
 */
export const inngest = new Inngest({
  id: 'client-commerce-platform',
  name: 'Client Commerce Platform',
});

/**
 * Event types for scraper jobs
 */
export interface ScraperEvents {
  'scraper/source.scrape': {
    data: {
      sourceId: string;
      fullRescrape?: boolean;
    };
  };
  'scraper/source.scheduled': {
    data: {
      sourceId: string;
    };
  };
  'scraper/check.due': {
    data: Record<string, never>;
  };
}

/**
 * Scrape a single source on demand
 * Triggered via API or manually
 */
export const scrapeSource = inngest.createFunction(
  {
    id: 'scrape-source',
    name: 'Scrape Client Source',
    retries: 2,
    concurrency: {
      limit: 3, // Limit concurrent scrapes
    },
  },
  { event: 'scraper/source.scrape' },
  async ({ event, step }) => {
    const { sourceId, fullRescrape } = event.data;

    // Validate source exists and is active
    const source = await step.run('validate-source', async () => {
      const s = await prisma.clientSource.findUnique({
        where: { id: sourceId },
        select: {
          id: true,
          name: true,
          isActive: true,
          client: {
            select: { id: true, name: true },
          },
        },
      });

      if (!s) {
        throw new Error(`Source not found: ${sourceId}`);
      }

      if (!s.isActive && !fullRescrape) {
        throw new Error(`Source is inactive: ${sourceId}`);
      }

      return s;
    });

    // Run scrape and sync
    const result = await step.run('scrape-and-sync', async () => {
      const { scrapeResult, syncResult } = await scrapeAndSync(sourceId, {
        dryRun: false,
        markMissingSold: true,
        updatePrices: true,
        createNew: true,
      });

      // Return serializable result with pre-computed error counts
      return {
        scrape: {
          status: scrapeResult.status,
          itemsFound: scrapeResult.itemsFound,
          errorCount: scrapeResult.errors.length,
          duration: scrapeResult.duration,
        },
        sync: {
          itemsNew: syncResult.itemsNew,
          itemsUpdated: syncResult.itemsUpdated,
          itemsRemoved: syncResult.itemsRemoved,
          errorCount: syncResult.errors.length,
        },
      };
    });

    return {
      sourceId,
      sourceName: source.name,
      clientName: source.client.name,
      scrape: result.scrape,
      sync: result.sync,
    };
  }
);

/**
 * Check for sources that are due for scraping
 * Runs on a cron schedule to find and trigger scrapes
 */
export const checkDueSources = inngest.createFunction(
  {
    id: 'check-due-sources',
    name: 'Check Due Sources',
  },
  { cron: '*/5 * * * *' }, // Every 5 minutes
  async ({ step }) => {
    // Find sources due for scraping and trigger them
    const result = await step.run('find-and-trigger-due-sources', async () => {
      const sources = await prisma.clientSource.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          scrapeFrequency: true,
          lastScrapedAt: true,
        },
      });

      const now = new Date();

      const dueSources = sources.filter((source: SourceWithFrequency) => {
        if (!source.lastScrapedAt) {
          // Never scraped, due immediately
          return true;
        }

        const minutesSinceLastScrape =
          (now.getTime() - source.lastScrapedAt.getTime()) / 1000 / 60;

        return minutesSinceLastScrape >= source.scrapeFrequency;
      });

      if (dueSources.length === 0) {
        return { triggered: 0, sources: [] as Array<{ id: string; name: string; frequency: number; lastScraped: Date | null }> };
      }

      // Trigger scrape for each due source
      const events = dueSources.map((source: SourceWithFrequency) => ({
        name: 'scraper/source.scrape' as const,
        data: { sourceId: source.id },
      }));

      await inngest.send(events);

      return {
        triggered: dueSources.length,
        sources: dueSources.map((s: SourceWithFrequency) => ({
          id: s.id,
          name: s.name,
          frequency: s.scrapeFrequency,
          lastScraped: s.lastScrapedAt,
        })),
      };
    });

    return result;
  }
);

/**
 * Scheduled scrape for a specific frequency tier
 * Alternative approach using multiple cron schedules
 */
export const scheduledScrapeHourly = inngest.createFunction(
  {
    id: 'scheduled-scrape-hourly',
    name: 'Hourly Scheduled Scrapes',
  },
  { cron: '0 * * * *' }, // Every hour
  async ({ step }) => {
    return step.run('run-hourly-scrapes', () =>
      findAndTriggerDueSources(60, 120)
    ); // 60-120 minute frequencies
  }
);

export const scheduledScrapeDaily = inngest.createFunction(
  {
    id: 'scheduled-scrape-daily',
    name: 'Daily Scheduled Scrapes',
  },
  { cron: '0 2 * * *' }, // 2 AM daily
  async ({ step }) => {
    return step.run('run-daily-scrapes', () =>
      findAndTriggerDueSources(720, 1440)
    ); // 12-24 hour frequencies
  }
);

export const scheduledScrapeFrequent = inngest.createFunction(
  {
    id: 'scheduled-scrape-frequent',
    name: 'Frequent Scheduled Scrapes',
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    return step.run('run-frequent-scrapes', () =>
      findAndTriggerDueSources(15, 59)
    ); // 15-59 minute frequencies
  }
);

/**
 * Helper to find and trigger scrapes for a frequency range
 */
async function findAndTriggerDueSources(
  minFrequency: number,
  maxFrequency: number
): Promise<{
  triggered: number;
  sources: Array<{ id: string; name: string }>;
}> {
  const now = new Date();

  const sources = await prisma.clientSource.findMany({
    where: {
      isActive: true,
      scrapeFrequency: {
        gte: minFrequency,
        lte: maxFrequency,
      },
    },
    select: {
      id: true,
      name: true,
      scrapeFrequency: true,
      lastScrapedAt: true,
    },
  });

  const dueSources = sources.filter((source: SourceWithFrequency) => {
    if (!source.lastScrapedAt) return true;

    const minutesSince =
      (now.getTime() - source.lastScrapedAt.getTime()) / 1000 / 60;
    return minutesSince >= source.scrapeFrequency;
  });

  if (dueSources.length === 0) {
    return { triggered: 0, sources: [] };
  }

  const events = dueSources.map((source: SourceWithFrequency) => ({
    name: 'scraper/source.scrape' as const,
    data: { sourceId: source.id },
  }));

  await inngest.send(events);

  return {
    triggered: dueSources.length,
    sources: dueSources.map((s: SourceWithFrequency) => ({ id: s.id, name: s.name })),
  };
}

/**
 * Batch scrape all sources for a client
 * Useful for initial sync or manual full refresh
 */
export const scrapeAllClientSources = inngest.createFunction(
  {
    id: 'scrape-all-client-sources',
    name: 'Scrape All Client Sources',
    retries: 1,
  },
  { event: 'scraper/client.scrape-all' },
  async ({ event, step }) => {
    const { clientId } = event.data as { clientId: string };

    // Get all active sources and trigger scrapes
    const result = await step.run('get-and-trigger-sources', async () => {
      const sources = await prisma.clientSource.findMany({
        where: {
          clientId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (sources.length === 0) {
        return {
          clientId,
          message: 'No active sources found',
          triggeredCount: 0,
          sources: [] as Array<{ id: string; name: string }>,
        };
      }

      // Trigger scrape for each source
      const events = sources.map((source: BasicSource) => ({
        name: 'scraper/source.scrape' as const,
        data: { sourceId: source.id },
      }));

      await inngest.send(events);

      return {
        clientId,
        triggeredCount: sources.length,
        sources: sources.map((s: BasicSource) => ({ id: s.id, name: s.name })),
      };
    });

    return result;
  }
);

/**
 * All Inngest functions to register with the serve handler
 */
export const scraperFunctions = [
  scrapeSource,
  checkDueSources,
  scheduledScrapeHourly,
  scheduledScrapeDaily,
  scheduledScrapeFrequent,
  scrapeAllClientSources,
];

/**
 * Helper to manually trigger a scrape
 */
export async function triggerScrape(
  sourceId: string,
  fullRescrape = false
): Promise<void> {
  await inngest.send({
    name: 'scraper/source.scrape',
    data: { sourceId, fullRescrape },
  });
}

/**
 * Helper to trigger scrapes for all client sources
 */
export async function triggerClientScrape(clientId: string): Promise<void> {
  await inngest.send({
    name: 'scraper/client.scrape-all',
    data: { clientId },
  });
}

/**
 * Get scrape job status from recent history
 */
export async function getScrapeStatus(
  sourceId: string
): Promise<{
  isRunning: boolean;
  lastResult: {
    status: string;
    itemsFound: number;
    duration: number;
    completedAt: Date;
  } | null;
}> {
  const history = await prisma.scrapeHistory.findFirst({
    where: { sourceId },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      itemsFound: true,
      duration: true,
      completedAt: true,
    },
  });

  return {
    isRunning: history?.status === 'RUNNING',
    lastResult: history
      ? {
          status: history.status,
          itemsFound: history.itemsFound || 0,
          duration: history.duration || 0,
          completedAt: history.completedAt || new Date(),
        }
      : null,
  };
}

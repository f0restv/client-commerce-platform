// Types
export * from './types';

// Parsers
export {
  EbayParser,
  ebayParser,
  ShopifyParser,
  shopifyParser,
  GenericParser,
  genericParser,
  createGenericParser,
  getParserForUrl,
  getParserForSourceType,
} from './parsers';

// Scraper
export { ClientScraper, createScraper, runScrapeJob } from './scraper';

// Sync
export {
  syncItems,
  compareItems,
  scrapeAndSync,
  getSyncPreview,
  type SyncOptions,
} from './sync';

// Schedulers (Inngest background jobs)
export {
  inngest,
  scraperFunctions,
  scrapeSource,
  checkDueSources,
  scheduledScrapeHourly,
  scheduledScrapeDaily,
  scheduledScrapeFrequent,
  scrapeAllClientSources,
  triggerScrape,
  triggerClientScrape,
  getScrapeStatus,
} from './schedulers';

// Re-export Prisma types for convenience
export { SourceType, JobStatus } from '@prisma/client';

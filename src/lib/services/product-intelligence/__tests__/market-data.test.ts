import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scrapeEbayComps,
  getEbayStats,
  getRedbookPrice,
  getGreysheetPrice,
  findCheapestBuyNow,
  fetchMarketData,
} from '../market-data';

const originalEnv = process.env;

describe('market-data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('scrapeEbayComps', () => {
    it('should return empty array when no OAuth token configured', async () => {
      delete process.env.EBAY_OAUTH_TOKEN;

      const result = await scrapeEbayComps(['1921 Morgan Dollar']);

      expect(result).toEqual([]);
    });

    it('should fetch active listings from eBay API', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                title: '1921 Morgan Silver Dollar',
                price: { value: '250.00' },
                itemWebUrl: 'https://ebay.com/item/1',
                condition: 'Used',
              },
              {
                title: '1921 Morgan Dollar MS-65',
                price: { value: '450.00' },
                itemWebUrl: 'https://ebay.com/item/2',
                condition: 'New',
              },
            ],
          }),
      });

      const result = await scrapeEbayComps(['1921 Morgan Dollar']);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('1921 Morgan Silver Dollar');
      expect(result[0].price).toBe(250);
      expect(result[0].source).toBe('ebay-active');
      expect(result[0].sold).toBe(false);
    });

    it('should fetch sold listings when soldOnly is true', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                title: 'Sold Morgan Dollar',
                price: { value: '200.00' },
                itemWebUrl: 'https://ebay.com/item/1',
                itemEndDate: '2024-01-15T10:00:00Z',
              },
            ],
          }),
      });

      const result = await scrapeEbayComps(['Morgan Dollar'], { soldOnly: true });

      expect(result[0].source).toBe('ebay-sold');
      expect(result[0].sold).toBe(true);
      expect(result[0].soldDate).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('should throw error on API failure', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(scrapeEbayComps(['test'])).rejects.toThrow('eBay API error: 401');
    });

    it('should respect limit parameter', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      });

      await scrapeEbayComps(['test'], { limit: 10 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });
  });

  describe('getEbayStats', () => {
    it('should calculate statistics from sold comparables', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      const mockSoldItems = {
        itemSummaries: [
          { title: 'Item 1', price: { value: '100' }, itemWebUrl: 'url1' },
          { title: 'Item 2', price: { value: '200' }, itemWebUrl: 'url2' },
          { title: 'Item 3', price: { value: '300' }, itemWebUrl: 'url3' },
          { title: 'Item 4', price: { value: '400' }, itemWebUrl: 'url4' },
          { title: 'Item 5', price: { value: '500' }, itemWebUrl: 'url5' },
        ],
      };

      const mockActiveItems = {
        itemSummaries: [
          { title: 'Active 1', price: { value: '250' }, itemWebUrl: 'url6' },
          { title: 'Active 2', price: { value: '350' }, itemWebUrl: 'url7' },
        ],
      };

      let callCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(callCount === 1 ? mockSoldItems : mockActiveItems),
        });
      });

      const result = await getEbayStats(['test search']);

      expect(result).not.toBeNull();
      expect(result!.soldCount).toBe(5);
      expect(result!.soldAverage).toBe(300);
      expect(result!.soldMedian).toBe(300);
      expect(result!.soldLow).toBe(100);
      expect(result!.soldHigh).toBe(500);
      expect(result!.activeListings).toBe(2);
      expect(result!.comparables).toHaveLength(7);
    });

    it('should return null when no sold items found', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      });

      const result = await getEbayStats(['rare item']);

      expect(result).toBeNull();
    });

    it('should calculate correct median for even number of items', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      const mockItems = {
        itemSummaries: [
          { title: 'Item 1', price: { value: '100' }, itemWebUrl: 'url1' },
          { title: 'Item 2', price: { value: '200' }, itemWebUrl: 'url2' },
          { title: 'Item 3', price: { value: '300' }, itemWebUrl: 'url3' },
          { title: 'Item 4', price: { value: '400' }, itemWebUrl: 'url4' },
        ],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockItems),
      });

      const result = await getEbayStats(['test']);

      expect(result!.soldMedian).toBe(250);
    });
  });

  describe('getRedbookPrice', () => {
    it('should return null when API key not configured', async () => {
      delete process.env.REDBOOK_API_KEY;

      const result = await getRedbookPrice(1921, 'Dollar', 'P', 'MS-65');

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch price from Redbook API', async () => {
      process.env.REDBOOK_API_KEY = 'test-key';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: 450 }),
      });

      const result = await getRedbookPrice(1921, 'Dollar', 'P', 'MS-65');

      expect(result).toBe(450);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('year=1921'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
    });

    it('should return null on API error', async () => {
      process.env.REDBOOK_API_KEY = 'test-key';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await getRedbookPrice(1921, 'Dollar', 'P', 'MS-65');

      expect(result).toBeNull();
    });

    it('should handle null year and mint', async () => {
      process.env.REDBOOK_API_KEY = 'test-key';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ price: 100 }),
      });

      await getRedbookPrice(null, 'Dollar', null, 'VF');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('year=&'),
        expect.any(Object)
      );
    });
  });

  describe('getGreysheetPrice', () => {
    it('should return null when API key not configured', async () => {
      delete process.env.GREYSHEET_API_KEY;

      const result = await getGreysheetPrice(1921, 'Dollar', 'P', 'MS-65');

      expect(result).toBeNull();
    });

    it('should fetch bid/ask prices from Greysheet API', async () => {
      process.env.GREYSHEET_API_KEY = 'test-key';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bid: 400, ask: 450 }),
      });

      const result = await getGreysheetPrice(1921, 'Dollar', 'P', 'MS-65');

      expect(result).toEqual({ bid: 400, ask: 450 });
    });

    it('should return null if bid or ask missing', async () => {
      process.env.GREYSHEET_API_KEY = 'test-key';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bid: 400 }),
      });

      const result = await getGreysheetPrice(1921, 'Dollar', 'P', 'MS-65');

      expect(result).toBeNull();
    });
  });

  describe('findCheapestBuyNow', () => {
    it('should return null when no OAuth token', async () => {
      delete process.env.EBAY_OAUTH_TOKEN;

      const result = await findCheapestBuyNow(['test']);

      expect(result).toBeNull();
    });

    it('should return cheapest buy now listing', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                price: { value: '199.99' },
                itemWebUrl: 'https://ebay.com/cheap',
                seller: { username: 'bestseller' },
              },
            ],
          }),
      });

      const result = await findCheapestBuyNow(['Morgan Dollar']);

      expect(result).toEqual({
        price: 199.99,
        url: 'https://ebay.com/cheap',
        seller: 'bestseller',
      });
    });

    it('should return null when no listings found', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      });

      const result = await findCheapestBuyNow(['rare item']);

      expect(result).toBeNull();
    });

    it('should handle missing seller info', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                price: { value: '100' },
                itemWebUrl: 'https://ebay.com/item',
              },
            ],
          }),
      });

      const result = await findCheapestBuyNow(['test']);

      expect(result!.seller).toBe('unknown');
    });
  });

  describe('fetchMarketData', () => {
    it('should aggregate all market data sources', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';
      process.env.REDBOOK_API_KEY = 'redbook-key';
      process.env.GREYSHEET_API_KEY = 'greysheet-key';

      let callCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        callCount++;
        if (url.includes('ebay.com')) {
          if (url.includes('FIXED_PRICE') && url.includes('sort=price')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  itemSummaries: [
                    { price: { value: '180' }, itemWebUrl: 'url', seller: { username: 'seller' } },
                  ],
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                itemSummaries: [
                  { title: 'Item', price: { value: '200' }, itemWebUrl: 'url' },
                ],
              }),
          });
        }
        if (url.includes('redbook')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ price: 225 }),
          });
        }
        if (url.includes('greysheet')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ bid: 210, ask: 240 }),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const result = await fetchMarketData(['1921 Morgan'], {
        year: 1921,
        denomination: 'Dollar',
        mint: 'P',
        grade: 'MS-65',
      });

      expect(result.fetchedAt).toBeInstanceOf(Date);
      expect(result.redbookPrice).toBe(225);
      expect(result.greysheetPrice).toEqual({ bid: 210, ask: 240 });
      expect(result.buyNow).toBeDefined();
    });

    it('should handle missing coin details', async () => {
      process.env.EBAY_OAUTH_TOKEN = 'test-token';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      });

      const result = await fetchMarketData(['baseball card']);

      expect(result.redbookPrice).toBeNull();
      expect(result.greysheetPrice).toBeNull();
    });
  });
});

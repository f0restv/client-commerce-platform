import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../identify', () => ({
  identify: vi.fn(),
}));

vi.mock('../grade', () => ({
  estimateGrade: vi.fn(),
}));

vi.mock('../market-data', () => ({
  fetchMarketData: vi.fn(),
  scrapeEbayComps: vi.fn(),
  getEbayStats: vi.fn(),
  getRedbookPrice: vi.fn(),
  getGreysheetPrice: vi.fn(),
  findCheapestBuyNow: vi.fn(),
}));

vi.mock('../evaluate', () => ({
  evaluate: vi.fn(),
  quickEvaluate: vi.fn(),
}));

import { analyze, analyzeWithImages, analyzeWithBase64 } from '../index';
import { identify } from '../identify';
import { estimateGrade } from '../grade';
import { fetchMarketData } from '../market-data';
import { evaluate } from '../evaluate';
import type { IdentificationResult, GradeEstimate, MarketData, EvaluationResult } from '../types';

describe('analyze pipeline', () => {
  const mockIdentification: IdentificationResult = {
    category: 'coin',
    name: '1921 Morgan Silver Dollar',
    year: 1921,
    mint: 'P',
    player: null,
    set: null,
    certNumber: null,
    searchTerms: ['1921 Morgan Dollar', 'Morgan Silver Dollar'],
    rawDescription: 'A Morgan dollar',
    confidence: 0.9,
  };

  const mockGrade: GradeEstimate = {
    grade: 'MS-65',
    numericGrade: 65,
    confidence: 0.85,
    notes: 'Well struck',
    surfaces: 'Clean',
    centering: 'N/A',
  };

  const mockMarketData: MarketData = {
    ebayStats: {
      soldCount: 15,
      soldAverage: 250,
      soldMedian: 240,
      soldLow: 180,
      soldHigh: 320,
      activeListings: 8,
      comparables: [],
    },
    redbookPrice: 225,
    greysheetPrice: { bid: 210, ask: 250 },
    buyNow: { price: 275, url: 'https://ebay.com/item', seller: 'dealer' },
    unifiedPrices: null,
    estimatedValue: null,
    fetchedAt: new Date(),
  };

  const mockEvaluation: EvaluationResult = {
    suggestedPrice: 240,
    clientPayout: 150,
    margin: 90,
    marginPercent: 37.5,
    recommendation: 'accept',
    reasoning: 'Good margin',
    risks: [],
    marketConfidence: 'high',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (identify as ReturnType<typeof vi.fn>).mockResolvedValue(mockIdentification);
    (estimateGrade as ReturnType<typeof vi.fn>).mockResolvedValue(mockGrade);
    (fetchMarketData as ReturnType<typeof vi.fn>).mockResolvedValue(mockMarketData);
    (evaluate as ReturnType<typeof vi.fn>).mockReturnValue(mockEvaluation);
  });

  describe('analyze', () => {
    it('should run full pipeline with all steps', async () => {
      const result = await analyze(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        { clientPayout: 150 }
      );

      expect(identify).toHaveBeenCalled();
      expect(estimateGrade).toHaveBeenCalled();
      expect(fetchMarketData).toHaveBeenCalled();
      expect(evaluate).toHaveBeenCalled();

      expect(result.identification).toEqual(mockIdentification);
      expect(result.grade).toEqual(mockGrade);
      expect(result.marketData).toEqual(mockMarketData);
      expect(result.evaluation).toEqual(mockEvaluation);
    });

    it('should skip evaluation when no clientPayout provided', async () => {
      const result = await analyze([{ type: 'url', url: 'https://example.com/coin.jpg' }]);

      expect(evaluate).not.toHaveBeenCalled();
      expect(result.evaluation).toBeNull();
    });

    it('should skip evaluation when clientPayout is 0', async () => {
      const result = await analyze(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        { clientPayout: 0 }
      );

      expect(evaluate).not.toHaveBeenCalled();
      expect(result.evaluation).toBeNull();
    });

    it('should skip market data when skipMarketData is true', async () => {
      const result = await analyze(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        { skipMarketData: true }
      );

      expect(fetchMarketData).not.toHaveBeenCalled();
      expect(result.marketData.ebayStats).toBeNull();
      expect(result.marketData.redbookPrice).toBeNull();
      expect(result.marketData.greysheetPrice).toBeNull();
      expect(result.marketData.buyNow).toBeNull();
      expect(result.marketData.unifiedPrices).toBeNull();
      expect(result.marketData.estimatedValue).toBeNull();
    });

    it('should pass coin details to fetchMarketData for coins', async () => {
      await analyze([{ type: 'url', url: 'https://example.com/coin.jpg' }]);

      expect(fetchMarketData).toHaveBeenCalledWith(
        mockIdentification.searchTerms,
        expect.objectContaining({
          year: 1921,
          denomination: '1921 Morgan Silver Dollar',
          mint: 'P',
          grade: 'MS-65',
        }),
        'coin'
      );
    });

    it('should not pass coin details for non-coin categories', async () => {
      const cardIdentification = { ...mockIdentification, category: 'sports-card' as const };
      (identify as ReturnType<typeof vi.fn>).mockResolvedValue(cardIdentification);

      await analyze([{ type: 'url', url: 'https://example.com/card.jpg' }]);

      expect(fetchMarketData).toHaveBeenCalledWith(mockIdentification.searchTerms, undefined, 'sports-card');
    });

    it('should pass grade to evaluate', async () => {
      await analyze(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        { clientPayout: 150 }
      );

      expect(evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          grade: mockGrade,
        })
      );
    });
  });

  describe('analyzeWithImages', () => {
    it('should convert image URLs and call analyze', async () => {
      const result = await analyzeWithImages(
        ['https://example.com/front.jpg', 'https://example.com/back.jpg'],
        200
      );

      expect(identify).toHaveBeenCalledWith([
        { type: 'url', url: 'https://example.com/front.jpg' },
        { type: 'url', url: 'https://example.com/back.jpg' },
      ]);
      expect(result.identification).toBeDefined();
    });

    it('should work without clientPayout', async () => {
      const result = await analyzeWithImages(['https://example.com/item.jpg']);

      expect(result.evaluation).toBeNull();
    });
  });

  describe('analyzeWithBase64', () => {
    it('should convert base64 images and call analyze', async () => {
      const result = await analyzeWithBase64(
        [
          { data: 'base64front', mediaType: 'image/jpeg' },
          { data: 'base64back', mediaType: 'image/jpeg' },
        ],
        150
      );

      expect(identify).toHaveBeenCalledWith([
        { type: 'base64', data: 'base64front', mediaType: 'image/jpeg' },
        { type: 'base64', data: 'base64back', mediaType: 'image/jpeg' },
      ]);
      expect(result.identification).toBeDefined();
    });

    it('should handle different media types', async () => {
      await analyzeWithBase64([
        { data: 'pngdata', mediaType: 'image/png' },
        { data: 'webpdata', mediaType: 'image/webp' },
      ]);

      expect(identify).toHaveBeenCalledWith([
        { type: 'base64', data: 'pngdata', mediaType: 'image/png' },
        { type: 'base64', data: 'webpdata', mediaType: 'image/webp' },
      ]);
    });
  });
});

describe('exports', () => {
  it('should export all types', async () => {
    const exports = await import('../index');

    expect(exports.analyze).toBeDefined();
    expect(exports.analyzeWithImages).toBeDefined();
    expect(exports.analyzeWithBase64).toBeDefined();
    expect(exports.identify).toBeDefined();
    expect(exports.estimateGrade).toBeDefined();
    expect(exports.scrapeEbayComps).toBeDefined();
    expect(exports.getEbayStats).toBeDefined();
    expect(exports.getRedbookPrice).toBeDefined();
    expect(exports.getGreysheetPrice).toBeDefined();
    expect(exports.findCheapestBuyNow).toBeDefined();
    expect(exports.fetchMarketData).toBeDefined();
    expect(exports.evaluate).toBeDefined();
    expect(exports.quickEvaluate).toBeDefined();
  });
});

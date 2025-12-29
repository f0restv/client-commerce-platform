import { describe, it, expect } from 'vitest';
import { evaluate, quickEvaluate } from '../evaluate';
import type { MarketData, GradeEstimate } from '../types';

describe('evaluate', () => {
  const baseMarketData: MarketData = {
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
    buyNow: { price: 275, url: 'https://ebay.com/item/123', seller: 'coindealer' },
    unifiedPrices: null,
    estimatedValue: null,
    fetchedAt: new Date(),
  };

  const baseGrade: GradeEstimate = {
    grade: 'MS-65',
    numericGrade: 65,
    confidence: 0.85,
    notes: 'Nice example',
    surfaces: 'Clean',
    centering: 'N/A',
  };

  describe('recommendation thresholds', () => {
    it('should recommend accept when margin > 15%', () => {
      const result = evaluate({
        clientPayout: 150,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.recommendation).toBe('accept');
      expect(result.marginPercent).toBeGreaterThan(15);
    });

    it('should recommend decline when margin < 5%', () => {
      const result = evaluate({
        clientPayout: 230,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.recommendation).toBe('decline');
      expect(result.marginPercent).toBeLessThan(5);
    });

    it('should recommend review when margin between 5-15%', () => {
      const result = evaluate({
        clientPayout: 200,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.recommendation).toBe('review');
      expect(result.marginPercent).toBeGreaterThanOrEqual(5);
      expect(result.marginPercent).toBeLessThanOrEqual(15);
    });
  });

  describe('suggested price calculation', () => {
    it('should calculate weighted price from all sources', () => {
      const result = evaluate({
        clientPayout: 100,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.suggestedPrice).toBeGreaterThan(200);
      expect(result.suggestedPrice).toBeLessThan(260);
    });

    it('should handle missing price sources gracefully', () => {
      const sparseMarketData: MarketData = {
        ebayStats: {
          soldCount: 3,
          soldAverage: 200,
          soldMedian: 190,
          soldLow: 150,
          soldHigh: 250,
          activeListings: 2,
          comparables: [],
        },
        redbookPrice: null,
        greysheetPrice: null,
        buyNow: null,
        unifiedPrices: null,
        estimatedValue: null,
        fetchedAt: new Date(),
      };

      const result = evaluate({
        clientPayout: 100,
        marketData: sparseMarketData,
        grade: baseGrade,
      });

      expect(result.suggestedPrice).toBeCloseTo(190, 0);
    });

    it('should return 0 suggested price when no data available', () => {
      const emptyMarketData: MarketData = {
        ebayStats: null,
        redbookPrice: null,
        greysheetPrice: null,
        buyNow: null,
        unifiedPrices: null,
        estimatedValue: null,
        fetchedAt: new Date(),
      };

      const result = evaluate({
        clientPayout: 100,
        marketData: emptyMarketData,
        grade: baseGrade,
      });

      expect(result.suggestedPrice).toBe(0);
      expect(result.recommendation).toBe('decline');
    });
  });

  describe('margin calculation', () => {
    it('should correctly calculate margin and margin percent', () => {
      const result = evaluate({
        clientPayout: 100,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.clientPayout).toBe(100);
      expect(result.margin).toBe(result.suggestedPrice - 100);
      expect(result.marginPercent).toBeCloseTo((result.margin / result.suggestedPrice) * 100, 1);
    });
  });

  describe('risk identification', () => {
    it('should identify limited sales data risk', () => {
      const lowVolumeData: MarketData = {
        ...baseMarketData,
        ebayStats: {
          ...baseMarketData.ebayStats!,
          soldCount: 3,
        },
      };

      const result = evaluate({
        clientPayout: 150,
        marketData: lowVolumeData,
        grade: baseGrade,
      });

      expect(result.risks).toContain('Limited sales data - price volatility risk');
    });

    it('should identify high price variance risk', () => {
      const highVarianceData: MarketData = {
        ...baseMarketData,
        ebayStats: {
          ...baseMarketData.ebayStats!,
          soldLow: 100,
          soldHigh: 400,
          soldMedian: 200,
        },
      };

      const result = evaluate({
        clientPayout: 100,
        marketData: highVarianceData,
        grade: baseGrade,
      });

      expect(result.risks).toContain('High price variance in comparables');
    });

    it('should identify low grade confidence risk', () => {
      const lowConfidenceGrade: GradeEstimate = {
        ...baseGrade,
        confidence: 0.5,
      };

      const result = evaluate({
        clientPayout: 150,
        marketData: baseMarketData,
        grade: lowConfidenceGrade,
      });

      expect(result.risks).toContain('Grade estimate has low confidence - consider professional grading');
    });

    it('should identify thin margin risk', () => {
      const result = evaluate({
        clientPayout: 215,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.risks).toContain('Thin margin leaves little room for error');
    });

    it('should identify high supply risk', () => {
      const highSupplyData: MarketData = {
        ...baseMarketData,
        ebayStats: {
          ...baseMarketData.ebayStats!,
          soldCount: 5,
          activeListings: 20,
        },
      };

      const result = evaluate({
        clientPayout: 150,
        marketData: highSupplyData,
        grade: baseGrade,
      });

      expect(result.risks).toContain('High supply - many active listings relative to sales');
    });
  });

  describe('market confidence assessment', () => {
    it('should return high confidence with abundant data', () => {
      const result = evaluate({
        clientPayout: 150,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.marketConfidence).toBe('high');
    });

    it('should return low confidence with minimal data', () => {
      const minimalData: MarketData = {
        ebayStats: {
          soldCount: 2,
          soldAverage: 200,
          soldMedian: 200,
          soldLow: 180,
          soldHigh: 220,
          activeListings: 1,
          comparables: [],
        },
        redbookPrice: null,
        greysheetPrice: null,
        buyNow: null,
        unifiedPrices: null,
        estimatedValue: null,
        fetchedAt: new Date(),
      };

      const result = evaluate({
        clientPayout: 150,
        marketData: minimalData,
        grade: baseGrade,
      });

      expect(result.marketConfidence).toBe('low');
    });
  });

  describe('reasoning generation', () => {
    it('should include price sources in reasoning', () => {
      const result = evaluate({
        clientPayout: 150,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.reasoning).toContain('eBay median');
      expect(result.reasoning).toContain('Greysheet');
      expect(result.reasoning).toContain('Redbook');
    });

    it('should include margin percentage in reasoning', () => {
      const result = evaluate({
        clientPayout: 150,
        marketData: baseMarketData,
        grade: baseGrade,
      });

      expect(result.reasoning).toMatch(/\d+\.\d+% margin/);
    });
  });
});

describe('quickEvaluate', () => {
  it('should return accept for high margin', () => {
    expect(quickEvaluate(100, 200)).toBe('accept');
  });

  it('should return decline for low margin', () => {
    expect(quickEvaluate(195, 200)).toBe('decline');
  });

  it('should return review for medium margin', () => {
    expect(quickEvaluate(175, 200)).toBe('review');
  });

  it('should return decline when estimated value is 0', () => {
    expect(quickEvaluate(100, 0)).toBe('decline');
  });
});

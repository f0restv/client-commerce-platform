import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      };
    },
  };
});

import { identify } from '../identify';

describe('identify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful identification', () => {
    it('should identify a coin correctly', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'coin',
              name: '1921 Morgan Silver Dollar',
              year: 1921,
              mint: 'Philadelphia',
              player: null,
              set: null,
              certNumber: 'NGC-123456',
              searchTerms: ['1921 Morgan Dollar', 'Morgan Silver Dollar MS'],
              rawDescription: 'A beautiful 1921 Morgan Silver Dollar',
              confidence: 0.95,
            }),
          },
        ],
      });

      const result = await identify([{ type: 'url', url: 'https://example.com/coin.jpg' }]);

      expect(result.category).toBe('coin');
      expect(result.name).toBe('1921 Morgan Silver Dollar');
      expect(result.year).toBe(1921);
      expect(result.mint).toBe('Philadelphia');
      expect(result.certNumber).toBe('NGC-123456');
      expect(result.searchTerms).toHaveLength(2);
      expect(result.confidence).toBe(0.95);
    });

    it('should identify a sports card correctly', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'sports-card',
              name: '2020 Topps Chrome Mike Trout',
              year: 2020,
              mint: null,
              player: 'Mike Trout',
              set: 'Topps Chrome',
              certNumber: 'PSA-87654321',
              searchTerms: ['2020 Topps Chrome Mike Trout', 'Mike Trout PSA 10'],
              rawDescription: 'A 2020 Topps Chrome Mike Trout baseball card',
              confidence: 0.88,
            }),
          },
        ],
      });

      const result = await identify([{ type: 'url', url: 'https://example.com/card.jpg' }]);

      expect(result.category).toBe('sports-card');
      expect(result.player).toBe('Mike Trout');
      expect(result.set).toBe('Topps Chrome');
      expect(result.year).toBe(2020);
    });

    it('should handle base64 images', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'coin',
              name: 'Test Coin',
              year: 2000,
              mint: null,
              player: null,
              set: null,
              certNumber: null,
              searchTerms: ['test coin'],
              rawDescription: 'A test coin',
              confidence: 0.7,
            }),
          },
        ],
      });

      const result = await identify([
        { type: 'base64', data: 'base64data', mediaType: 'image/jpeg' },
      ]);

      expect(result.category).toBe('coin');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image',
                  source: expect.objectContaining({
                    type: 'base64',
                    data: 'base64data',
                  }),
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should handle multiple images', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'coin',
              name: 'Double Sided Coin',
              year: 1999,
              mint: 'D',
              player: null,
              set: null,
              certNumber: null,
              searchTerms: ['coin 1999'],
              rawDescription: 'Front and back of coin',
              confidence: 0.9,
            }),
          },
        ],
      });

      const result = await identify([
        { type: 'url', url: 'https://example.com/front.jpg' },
        { type: 'url', url: 'https://example.com/back.jpg' },
      ]);

      expect(result.name).toBe('Double Sided Coin');
    });
  });

  describe('error handling', () => {
    it('should throw error when no images provided', async () => {
      await expect(identify([])).rejects.toThrow('At least one image is required');
    });

    it('should throw error when no text response received', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      await expect(
        identify([{ type: 'url', url: 'https://example.com/coin.jpg' }])
      ).rejects.toThrow('No text response received from Claude');
    });

    it('should throw error when response is not valid JSON', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is not JSON',
          },
        ],
      });

      await expect(
        identify([{ type: 'url', url: 'https://example.com/coin.jpg' }])
      ).rejects.toThrow('Failed to parse identification response as JSON');
    });
  });

  describe('data validation', () => {
    it('should default category to unknown for invalid values', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'invalid-category',
              name: 'Test',
              searchTerms: [],
              confidence: 0.5,
            }),
          },
        ],
      });

      const result = await identify([{ type: 'url', url: 'https://example.com/item.jpg' }]);
      expect(result.category).toBe('unknown');
    });

    it('should clamp confidence to valid range', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'coin',
              name: 'Test',
              confidence: 1.5,
              searchTerms: [],
            }),
          },
        ],
      });

      const result = await identify([{ type: 'url', url: 'https://example.com/item.jpg' }]);
      expect(result.confidence).toBe(1);
    });

    it('should handle missing optional fields', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              category: 'coin',
              name: 'Simple Coin',
            }),
          },
        ],
      });

      const result = await identify([{ type: 'url', url: 'https://example.com/item.jpg' }]);

      expect(result.year).toBeNull();
      expect(result.mint).toBeNull();
      expect(result.player).toBeNull();
      expect(result.set).toBeNull();
      expect(result.certNumber).toBeNull();
      expect(result.searchTerms).toEqual([]);
      expect(result.confidence).toBe(0.5);
    });
  });
});

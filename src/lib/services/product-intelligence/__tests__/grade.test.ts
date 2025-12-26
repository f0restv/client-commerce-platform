import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      };
    },
  };
});

import { estimateGrade } from '../grade';

describe('estimateGrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('coin grading', () => {
    it('should grade a coin using Sheldon scale', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'MS-65',
              numericGrade: 65,
              confidence: 0.85,
              notes: 'Well struck with full luster',
              surfaces: 'Minor contact marks in fields',
              centering: 'N/A',
              strike: 'Sharp details on eagle feathers',
              luster: 'Full cartwheel luster present',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        'coin'
      );

      expect(result.grade).toBe('MS-65');
      expect(result.numericGrade).toBe(65);
      expect(result.confidence).toBe(0.85);
      expect(result.strike).toBe('Sharp details on eagle feathers');
      expect(result.luster).toBe('Full cartwheel luster present');
    });

    it('should handle circulated coin grades', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'VF-30',
              numericGrade: 30,
              confidence: 0.75,
              notes: 'Even wear across high points',
              surfaces: 'Light scratches visible',
              centering: 'N/A',
              strike: 'Moderate wear on details',
              luster: 'No remaining luster',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        'coin'
      );

      expect(result.grade).toBe('VF-30');
      expect(result.numericGrade).toBe(30);
    });
  });

  describe('sports card grading', () => {
    it('should grade a sports card with PSA-style grading', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'PSA 9',
              numericGrade: 9,
              confidence: 0.8,
              notes: 'Near mint condition with minor centering issue',
              surfaces: 'Clean print, no scratches',
              centering: '55/45 left-right, 50/50 top-bottom',
              corners: 'Sharp on all four corners',
              edges: 'Clean edges with no chipping',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/card.jpg' }],
        'sports-card'
      );

      expect(result.grade).toBe('PSA 9');
      expect(result.numericGrade).toBe(9);
      expect(result.centering).toBe('55/45 left-right, 50/50 top-bottom');
      expect(result.corners).toBe('Sharp on all four corners');
      expect(result.edges).toBe('Clean edges with no chipping');
    });

    it('should handle BGS-style grading', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'BGS 9.5',
              numericGrade: 9.5,
              confidence: 0.9,
              notes: 'Gem mint with perfect subgrades',
              surfaces: 'Pristine',
              centering: '50/50 both axes',
              corners: '9.5 - Near perfect',
              edges: '9.5 - Clean',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/card.jpg' }],
        'sports-card'
      );

      expect(result.grade).toBe('BGS 9.5');
      expect(result.numericGrade).toBe(9.5);
    });
  });

  describe('other collectible types', () => {
    it('should use default grading for unknown categories', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'Very Fine',
              numericGrade: null,
              confidence: 0.7,
              notes: 'Good condition for age',
              surfaces: 'Minor wear',
              centering: 'N/A',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/item.jpg' }],
        'memorabilia'
      );

      expect(result.grade).toBe('Very Fine');
      expect(result.numericGrade).toBeNull();
    });

    it('should grade trading cards', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'CGC 9.8',
              numericGrade: 9.8,
              confidence: 0.85,
              notes: 'Near mint/mint condition',
              surfaces: 'Excellent print quality',
              centering: '50/50',
              corners: 'Sharp',
              edges: 'Clean',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/card.jpg' }],
        'trading-card'
      );

      expect(result.grade).toBe('CGC 9.8');
    });
  });

  describe('error handling', () => {
    it('should throw error when no images provided', async () => {
      await expect(estimateGrade([], 'coin')).rejects.toThrow(
        'At least one image is required for grading'
      );
    });

    it('should throw error when no text response received', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      await expect(
        estimateGrade([{ type: 'url', url: 'https://example.com/coin.jpg' }], 'coin')
      ).rejects.toThrow('No text response received from Claude');
    });

    it('should throw error for invalid JSON response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Not valid JSON response',
          },
        ],
      });

      await expect(
        estimateGrade([{ type: 'url', url: 'https://example.com/coin.jpg' }], 'coin')
      ).rejects.toThrow('Failed to parse grading response as JSON');
    });
  });

  describe('data validation', () => {
    it('should handle missing optional fields', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'MS-63',
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        'coin'
      );

      expect(result.grade).toBe('MS-63');
      expect(result.numericGrade).toBeNull();
      expect(result.confidence).toBe(0.5);
      expect(result.notes).toBe('');
      expect(result.surfaces).toBe('');
      expect(result.centering).toBe('N/A');
    });

    it('should clamp confidence values', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'MS-70',
              confidence: 2.0,
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        'coin'
      );

      expect(result.confidence).toBe(1);
    });

    it('should handle negative confidence', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'Poor',
              confidence: -0.5,
            }),
          },
        ],
      });

      const result = await estimateGrade(
        [{ type: 'url', url: 'https://example.com/coin.jpg' }],
        'coin'
      );

      expect(result.confidence).toBe(0);
    });
  });

  describe('base64 image handling', () => {
    it('should correctly pass base64 images to API', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              grade: 'MS-65',
              numericGrade: 65,
              confidence: 0.8,
              notes: 'Test',
              surfaces: 'Clean',
              centering: 'N/A',
            }),
          },
        ],
      });

      await estimateGrade(
        [{ type: 'base64', data: 'testbase64data', mediaType: 'image/png' }],
        'coin'
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image',
                  source: expect.objectContaining({
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'testbase64data',
                  }),
                }),
              ]),
            }),
          ]),
        })
      );
    });
  });
});

export interface ImageIssue {
  type: 'dust' | 'scratch' | 'lighting' | 'background' | 'color_cast';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ImageAnalysis {
  issues: ImageIssue[];
  overallQuality: 'poor' | 'fair' | 'good' | 'excellent';
  recommendations: string[];
}

export interface EnhancementOptions {
  autoLevels?: boolean;
  whiteBalance?: boolean;
  denoise?: boolean;
  sharpen?: boolean;
  removeBackground?: boolean;
}

export interface StandardSizes {
  thumbnail: { width: 300; height: 300 };
  card: { width: 600; height: 600 };
  detail: { width: 1200; height: 1200 };
  original: { maxDimension: 2400 };
}

export const STANDARD_SIZES: StandardSizes = {
  thumbnail: { width: 300, height: 300 },
  card: { width: 600, height: 600 },
  detail: { width: 1200, height: 1200 },
  original: { maxDimension: 2400 },
};

export interface ProcessedImage {
  originalUrl: string;
  thumbnailUrl: string;
  cardUrl: string;
  detailUrl: string;
  fullUrl: string;
  analysis: ImageAnalysis;
  enhancementsApplied: EnhancementOptions;
  metadata: {
    originalWidth: number;
    originalHeight: number;
    format: string;
    fileSize: number;
    processedAt: string;
  };
}

export interface ImageProcessingResult {
  success: boolean;
  data?: ProcessedImage;
  error?: string;
}

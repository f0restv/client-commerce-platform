import { analyzeImage, recommendEnhancements } from './analyze';
import { applyEnhancements } from './enhance';
import { resizeImage, getImageMetadata } from './resize';
import { uploadImageVersions } from './upload';
import {
  ProcessedImage,
  ImageProcessingResult,
  EnhancementOptions,
} from './types';
import { randomUUID } from 'crypto';

export interface ProcessImageOptions {
  folder?: string;
  customEnhancements?: EnhancementOptions;
  skipAnalysis?: boolean;
}

/**
 * Complete image processing pipeline
 * 1. Upload original
 * 2. Analyze for issues
 * 3. Apply recommended enhancements
 * 4. Generate all standard sizes
 * 5. Upload all versions
 */
export async function processImage(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg',
  options: ProcessImageOptions = {}
): Promise<ImageProcessingResult> {
  try {
    const imageId = randomUUID();
    const folder = options.folder || 'products';

    // Step 1: Get original metadata
    const originalMetadata = await getImageMetadata(imageBuffer);

    // Step 2: Analyze image (unless skipped)
    let analysisResult;
    let enhancements: EnhancementOptions;

    if (options.skipAnalysis) {
      analysisResult = {
        success: true,
        data: {
          issues: [],
          overallQuality: 'good' as const,
          recommendations: ['Analysis skipped'],
        },
      };
      enhancements = options.customEnhancements || {
        autoLevels: false,
        whiteBalance: false,
        denoise: false,
        sharpen: true,
        removeBackground: false,
      };
    } else {
      analysisResult = await analyzeImage(imageBuffer, mimeType);
      
      // If analysis fails and no custom enhancements provided, fail early
      if (!analysisResult.success && !options.customEnhancements) {
        return {
          success: false,
          error: `Image analysis failed: ${analysisResult.error}`,
        };
      }
      
      enhancements = options.customEnhancements || recommendEnhancements(analysisResult);
    }

    // Step 3: Apply enhancements
    const enhancedBuffer = await applyEnhancements(imageBuffer, enhancements);

    // Step 4: Generate all standard sizes
    const resizedImages = await resizeImage(enhancedBuffer);

    // Step 5: Upload all versions to S3
    const versions = [
      {
        buffer: resizedImages.thumbnail,
        size: 'thumbnail',
        key: `${imageId}-thumbnail.jpg`,
      },
      {
        buffer: resizedImages.card,
        size: 'card',
        key: `${imageId}-card.jpg`,
      },
      {
        buffer: resizedImages.detail,
        size: 'detail',
        key: `${imageId}-detail.jpg`,
      },
      {
        buffer: resizedImages.full,
        size: 'full',
        key: `${imageId}-full.jpg`,
      },
    ];

    const urls = await uploadImageVersions(versions, folder);

    // Step 6: Build result
    const result: ProcessedImage = {
      originalUrl: urls.full, // Use full as the original reference
      thumbnailUrl: urls.thumbnail,
      cardUrl: urls.card,
      detailUrl: urls.detail,
      fullUrl: urls.full,
      analysis: analysisResult.data || {
        issues: [],
        overallQuality: 'good',
        recommendations: ['Analysis unavailable'],
      },
      enhancementsApplied: enhancements,
      metadata: {
        originalWidth: originalMetadata.width,
        originalHeight: originalMetadata.height,
        format: originalMetadata.format,
        fileSize: originalMetadata.size,
        processedAt: new Date().toISOString(),
      },
    };

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process multiple images in parallel
 */
export async function processImages(
  images: Array<{ buffer: Buffer; mimeType?: string }>,
  options: ProcessImageOptions = {}
): Promise<ImageProcessingResult[]> {
  return await Promise.all(
    images.map((image) => processImage(image.buffer, image.mimeType, options))
  );
}

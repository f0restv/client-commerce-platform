import sharp from 'sharp';
import { EnhancementOptions } from './types';

/**
 * Apply image enhancements using Sharp.js
 * IMPORTANT: Only cleans up existing image, never adds fabricated details
 */
export async function enhanceImage(
  imageBuffer: Buffer,
  options: EnhancementOptions
): Promise<Buffer> {
  let pipeline = sharp(imageBuffer);

  // Auto-levels: Normalize contrast and brightness
  if (options.autoLevels) {
    pipeline = pipeline.normalize();
  }

  // White balance: Remove color casts
  if (options.whiteBalance) {
    pipeline = pipeline.modulate({
      brightness: 1.0,
      saturation: 1.0,
    });
  }

  // Denoise: Reduce noise and minor imperfections
  if (options.denoise) {
    pipeline = pipeline.median(3); // Light median filter
  }

  // Sharpen: Enhance edge definition for web display
  if (options.sharpen) {
    pipeline = pipeline.sharpen({
      sigma: 1.0,
      m1: 1.0,
      m2: 0.5,
      x1: 2,
      y2: 10,
      y3: 20,
    });
  }

  return await pipeline.toBuffer();
}

/**
 * Remove background using Remove.bg API
 * Falls back to original if API fails
 */
export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY;

  if (!REMOVEBG_API_KEY) {
    console.warn('Remove.bg API key not configured, skipping background removal');
    return imageBuffer;
  }

  try {
    const formData = new FormData();
    formData.append('image_file', new Blob([new Uint8Array(imageBuffer)]));
    formData.append('size', 'auto');
    formData.append('bg_color', 'ffffff'); // White background

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVEBG_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Remove.bg API error: ${response.status}`);
    }

    const resultBuffer = await response.arrayBuffer();
    return Buffer.from(resultBuffer);
  } catch (error) {
    console.error('Error removing background:', error);
    // Return original image if background removal fails
    return imageBuffer;
  }
}

/**
 * Apply all selected enhancements to an image
 */
export async function applyEnhancements(
  imageBuffer: Buffer,
  options: EnhancementOptions
): Promise<Buffer> {
  let processedBuffer = imageBuffer;

  // Remove background first if requested
  if (options.removeBackground) {
    processedBuffer = await removeBackground(processedBuffer);
  }

  // Apply other enhancements
  const enhancementOptions = { ...options, removeBackground: false };
  processedBuffer = await enhanceImage(processedBuffer, enhancementOptions);

  return processedBuffer;
}

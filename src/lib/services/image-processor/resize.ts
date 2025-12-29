import sharp from 'sharp';
import { STANDARD_SIZES } from './types';

export interface ResizedImages {
  thumbnail: Buffer;
  card: Buffer;
  detail: Buffer;
  full: Buffer;
}

/**
 * Resize image to fit within dimensions while maintaining aspect ratio
 * Pads with white background to achieve exact dimensions
 */
async function resizeWithPadding(
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return await sharp(imageBuffer)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/**
 * Crop image to square from center
 */
async function cropToSquare(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  const size = Math.min(metadata.width, metadata.height);

  return await sharp(imageBuffer)
    .extract({
      left: Math.floor((metadata.width - size) / 2),
      top: Math.floor((metadata.height - size) / 2),
      width: size,
      height: size,
    })
    .toBuffer();
}

/**
 * Strip EXIF data for privacy
 */
async function stripMetadata(imageBuffer: Buffer): Promise<Buffer> {
  return await sharp(imageBuffer)
    .withMetadata({
      orientation: undefined,
      exif: {},
      icc: 'srgb',
    })
    .toBuffer();
}

/**
 * Generate all standard image sizes
 */
export async function resizeImage(imageBuffer: Buffer): Promise<ResizedImages> {
  // Strip metadata first
  let processedBuffer = await stripMetadata(imageBuffer);

  // Crop to square from center
  const squareBuffer = await cropToSquare(processedBuffer);

  // Generate all sizes
  const [thumbnail, card, detail] = await Promise.all([
    resizeWithPadding(
      squareBuffer,
      STANDARD_SIZES.thumbnail.width,
      STANDARD_SIZES.thumbnail.height
    ),
    resizeWithPadding(
      squareBuffer,
      STANDARD_SIZES.card.width,
      STANDARD_SIZES.card.height
    ),
    resizeWithPadding(
      squareBuffer,
      STANDARD_SIZES.detail.width,
      STANDARD_SIZES.detail.height
    ),
  ]);

  // For full size, limit to max dimension
  const metadata = await sharp(squareBuffer).metadata();
  const maxDimension = STANDARD_SIZES.original.maxDimension;
  
  let full: Buffer;
  if (
    metadata.width &&
    metadata.height &&
    Math.max(metadata.width, metadata.height) > maxDimension
  ) {
    full = await sharp(squareBuffer)
      .resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } else {
    full = await sharp(squareBuffer)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  }

  return {
    thumbnail,
    card,
    detail,
    full,
  };
}

/**
 * Get image metadata
 */
export async function getImageMetadata(imageBuffer: Buffer) {
  const metadata = await sharp(imageBuffer).metadata();
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: imageBuffer.length,
  };
}

// Main exports
export { processImage, processImages } from './pipeline';
export { analyzeImage, recommendEnhancements } from './analyze';
export type { AnalysisResult } from './analyze';
export { enhanceImage, removeBackground, applyEnhancements } from './enhance';
export { resizeImage, getImageMetadata } from './resize';
export {
  uploadImage,
  uploadImageVersions,
  generatePresignedUploadUrl,
  getImageUrl,
} from './upload';
export type { PresignedUploadUrl } from './upload';

// Type exports
export type {
  ImageIssue,
  ImageAnalysis,
  EnhancementOptions,
  ProcessedImage,
  ImageProcessingResult,
  StandardSizes,
} from './types';

export { STANDARD_SIZES } from './types';

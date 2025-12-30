/**
 * Visual Grading Reference Image Service
 *
 * Loads and manages reference images from PCGS Photograde and other sources
 * for use in AI-powered visual coin grading. This mimics how professional
 * graders learn by comparing coins to known graded examples.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CoinType } from './grading-criteria';

const REFERENCE_DIR = path.join(process.cwd(), 'data/grading-reference');

export interface ReferenceImage {
  grade: string;
  numericGrade: number;
  obversePath: string | null;
  reversePath: string | null;
  obverseBase64?: string;
  reverseBase64?: string;
}

export interface SeriesReferenceData {
  series: string;
  displayName: string;
  grades: ReferenceImage[];
  lastUpdated: string;
}

export interface ReferenceImageSet {
  coinType: CoinType;
  displayName: string;
  referenceImages: ReferenceImage[];
  selectedGrades: string[];
}

// Grade ranges for comparison - we don't need every single grade, just key benchmarks
const COMPARISON_GRADES = {
  circulated: ['G-4', 'VG-8', 'F-12', 'VF-20', 'VF-30', 'EF-40', 'EF-45', 'AU-50', 'AU-55', 'AU-58'],
  mintState: ['MS-60', 'MS-62', 'MS-63', 'MS-64', 'MS-65', 'MS-66', 'MS-67'],
  all: [
    'AG-3', 'G-4', 'VG-8', 'F-12', 'VF-20', 'VF-30', 'EF-40', 'EF-45',
    'AU-50', 'AU-55', 'AU-58', 'MS-60', 'MS-62', 'MS-63', 'MS-64', 'MS-65', 'MS-66', 'MS-67'
  ],
};

// Map coin types to their reference image directory names
const COIN_TYPE_TO_DIR: Record<CoinType, string> = {
  'morgan-dollar': 'morgan-dollar',
  'peace-dollar': 'peace-dollar',
  'walking-liberty-half': 'walking-liberty-half',
  'saint-gaudens-double-eagle': 'saint-gaudens-double-eagle',
  'buffalo-nickel': 'buffalo-nickel',
  'mercury-dime': 'mercury-dime',
  'lincoln-wheat-cent': 'lincoln-wheat-cent',
  'barber-quarter': 'barber-quarter',
  'barber-half': 'barber-half',
  'barber-dime': 'barber-dime',
  'standing-liberty-quarter': 'standing-liberty-quarter',
  'franklin-half': 'franklin-half',
  'kennedy-half': 'kennedy-half',
  'washington-quarter': 'washington-quarter',
  'roosevelt-dime': 'roosevelt-dime',
  'jefferson-nickel': 'jefferson-nickel',
  'indian-head-cent': 'indian-head-cent',
  'seated-liberty': 'seated-liberty-dollar',
  'trade-dollar': 'trade-dollar',
  'generic-silver': 'morgan-dollar', // Use Morgan as generic silver reference
  'generic-gold': 'saint-gaudens-double-eagle', // Use Saint-Gaudens as generic gold reference
  'generic': 'morgan-dollar',
};

/**
 * Check if reference images are available for a coin type
 */
export function hasReferenceImages(coinType: CoinType): boolean {
  const dirName = COIN_TYPE_TO_DIR[coinType];
  if (!dirName) return false;

  const seriesDir = path.join(REFERENCE_DIR, dirName);
  const metadataPath = path.join(seriesDir, 'metadata.json');

  return fs.existsSync(metadataPath);
}

/**
 * Get available coin series with reference images
 */
export function getAvailableSeries(): string[] {
  if (!fs.existsSync(REFERENCE_DIR)) return [];

  return fs.readdirSync(REFERENCE_DIR)
    .filter(item => {
      const itemPath = path.join(REFERENCE_DIR, item);
      return fs.statSync(itemPath).isDirectory() &&
             fs.existsSync(path.join(itemPath, 'metadata.json'));
    });
}

/**
 * Load metadata for a series
 */
export function loadSeriesMetadata(seriesName: string): SeriesReferenceData | null {
  const metadataPath = path.join(REFERENCE_DIR, seriesName, 'metadata.json');

  if (!fs.existsSync(metadataPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    return {
      series: data.series,
      displayName: data.displayName,
      grades: data.grades.map((g: Record<string, unknown>) => ({
        grade: g.grade as string,
        numericGrade: g.numericGrade as number,
        obversePath: g.obversePath as string | null,
        reversePath: g.reversePath as string | null,
      })),
      lastUpdated: data.scrapedAt,
    };
  } catch {
    console.error(`Failed to load metadata for ${seriesName}`);
    return null;
  }
}

/**
 * Read an image file and convert to base64
 */
function imageToBase64(imagePath: string): string | null {
  if (!imagePath || !fs.existsSync(imagePath)) return null;

  try {
    const buffer = fs.readFileSync(imagePath);
    return buffer.toString('base64');
  } catch {
    console.error(`Failed to read image: ${imagePath}`);
    return null;
  }
}

/**
 * Get media type from file extension
 */
function getMediaType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

/**
 * Load reference images for a coin type
 *
 * @param coinType - The type of coin
 * @param options - Options for which grades to load
 * @returns Reference image set or null if not available
 */
export function loadReferenceImages(
  coinType: CoinType,
  options: {
    gradeRange?: 'circulated' | 'mintState' | 'all' | 'nearby';
    nearbyGrade?: number; // If gradeRange is 'nearby', load grades around this value
    includeBase64?: boolean; // Whether to load images as base64 (for API calls)
    maxImages?: number; // Maximum number of reference images to load
  } = {}
): ReferenceImageSet | null {
  const {
    gradeRange = 'all',
    nearbyGrade,
    includeBase64 = true,
    maxImages = 8,
  } = options;

  const dirName = COIN_TYPE_TO_DIR[coinType];
  if (!dirName) return null;

  const metadata = loadSeriesMetadata(dirName);
  if (!metadata) return null;

  // Determine which grades to load
  let targetGrades: string[];

  if (gradeRange === 'nearby' && nearbyGrade !== undefined) {
    // Load grades within ±10 points of the target
    targetGrades = metadata.grades
      .filter(g => Math.abs(g.numericGrade - nearbyGrade) <= 10)
      .map(g => g.grade);
  } else if (gradeRange === 'nearby') {
    // Nearby without a grade specified, use all
    targetGrades = COMPARISON_GRADES.all;
  } else {
    targetGrades = COMPARISON_GRADES[gradeRange];
  }

  // Filter to available grades
  const availableGrades = metadata.grades.filter(g => targetGrades.includes(g.grade));

  // Limit number of images
  const selectedGrades = availableGrades.slice(0, maxImages);

  // Load base64 data if requested
  const referenceImages: ReferenceImage[] = selectedGrades.map(grade => {
    const ref: ReferenceImage = {
      grade: grade.grade,
      numericGrade: grade.numericGrade,
      obversePath: grade.obversePath,
      reversePath: grade.reversePath,
    };

    if (includeBase64) {
      if (grade.obversePath) {
        ref.obverseBase64 = imageToBase64(grade.obversePath) || undefined;
      }
      if (grade.reversePath) {
        ref.reverseBase64 = imageToBase64(grade.reversePath) || undefined;
      }
    }

    return ref;
  });

  return {
    coinType,
    displayName: metadata.displayName,
    referenceImages: referenceImages.filter(r => r.obverseBase64 || r.reverseBase64),
    selectedGrades: selectedGrades.map(g => g.grade),
  };
}

/**
 * Select optimal reference images for comparison
 *
 * Given a preliminary grade estimate, selects the most useful reference images
 * for comparison (grades above and below the estimate).
 */
export function selectComparisonImages(
  coinType: CoinType,
  estimatedGrade: number,
  count: number = 5
): ReferenceImageSet | null {
  const dirName = COIN_TYPE_TO_DIR[coinType];
  if (!dirName) return null;

  const metadata = loadSeriesMetadata(dirName);
  if (!metadata) return null;

  // Sort grades by distance from estimated grade
  const sortedGrades = [...metadata.grades].sort((a, b) => {
    return Math.abs(a.numericGrade - estimatedGrade) - Math.abs(b.numericGrade - estimatedGrade);
  });

  // Select closest grades, ensuring we have some above and below
  const belowGrades = sortedGrades.filter(g => g.numericGrade < estimatedGrade).slice(0, Math.ceil(count / 2));
  const aboveGrades = sortedGrades.filter(g => g.numericGrade >= estimatedGrade).slice(0, Math.ceil(count / 2));

  const selectedGrades = [...belowGrades, ...aboveGrades]
    .sort((a, b) => a.numericGrade - b.numericGrade)
    .slice(0, count);

  // Load base64 data
  const referenceImages: ReferenceImage[] = selectedGrades.map(grade => ({
    grade: grade.grade,
    numericGrade: grade.numericGrade,
    obversePath: grade.obversePath,
    reversePath: grade.reversePath,
    obverseBase64: grade.obversePath ? imageToBase64(grade.obversePath) || undefined : undefined,
    reverseBase64: grade.reversePath ? imageToBase64(grade.reversePath) || undefined : undefined,
  }));

  return {
    coinType,
    displayName: metadata.displayName,
    referenceImages: referenceImages.filter(r => r.obverseBase64 || r.reverseBase64),
    selectedGrades: selectedGrades.map(g => g.grade),
  };
}

/**
 * Build Anthropic image blocks from reference images
 *
 * Returns an array of image blocks suitable for the Claude Vision API,
 * along with labels for each image.
 */
export function buildReferenceImageBlocks(
  referenceSet: ReferenceImageSet
): Array<{
  imageBlock: {
    type: 'image';
    source: {
      type: 'base64';
      media_type: 'image/jpeg' | 'image/png' | 'image/webp';
      data: string;
    };
  };
  label: string;
}> {
  const blocks: Array<{
    imageBlock: {
      type: 'image';
      source: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/webp';
        data: string;
      };
    };
    label: string;
  }> = [];

  for (const ref of referenceSet.referenceImages) {
    if (ref.obverseBase64 && ref.obversePath) {
      blocks.push({
        imageBlock: {
          type: 'image',
          source: {
            type: 'base64',
            media_type: getMediaType(ref.obversePath) as 'image/jpeg' | 'image/png' | 'image/webp',
            data: ref.obverseBase64,
          },
        },
        label: `Reference: ${ref.grade} Obverse`,
      });
    }

    // Only include reverse for key grade transitions
    if (ref.reverseBase64 && ref.reversePath && ['AU-58', 'MS-63', 'MS-65'].includes(ref.grade)) {
      blocks.push({
        imageBlock: {
          type: 'image',
          source: {
            type: 'base64',
            media_type: getMediaType(ref.reversePath) as 'image/jpeg' | 'image/png' | 'image/webp',
            data: ref.reverseBase64,
          },
        },
        label: `Reference: ${ref.grade} Reverse`,
      });
    }
  }

  return blocks;
}

/**
 * Generate a visual comparison prompt section
 */
export function generateReferenceComparisonSection(referenceSet: ReferenceImageSet): string {
  const gradeList = referenceSet.selectedGrades.join(', ');

  return `
VISUAL REFERENCE COMPARISON
===========================
You have been provided with PCGS Photograde reference images for ${referenceSet.displayName}.
Reference grades included: ${gradeList}

COMPARISON METHODOLOGY:
1. First examine the SUBMITTED coin's wear points and surfaces
2. Compare SYSTEMATICALLY to each reference image:
   - Which reference shows similar wear on the high points?
   - Which reference shows similar luster characteristics?
   - Which reference shows similar surface quality?

3. Identify the TWO closest reference grades (one above, one below)
4. Determine which the submitted coin most closely matches
5. Consider if it falls between grades (e.g., "closer to VF-25 than VF-20")

CRITICAL: Base your grade on VISUAL COMPARISON to these authenticated references.
Do not rely solely on written criteria - the images show exactly what each grade looks like.
`;
}

/**
 * Get statistics about available reference images
 */
export function getReferenceImageStats(): {
  totalSeries: number;
  totalImages: number;
  seriesDetails: Array<{ name: string; gradeCount: number }>;
} {
  const series = getAvailableSeries();
  let totalImages = 0;
  const seriesDetails: Array<{ name: string; gradeCount: number }> = [];

  for (const seriesName of series) {
    const metadata = loadSeriesMetadata(seriesName);
    if (metadata) {
      const imageCount = metadata.grades.reduce((sum, g) => {
        return sum + (g.obversePath ? 1 : 0) + (g.reversePath ? 1 : 0);
      }, 0);
      totalImages += imageCount;
      seriesDetails.push({ name: metadata.displayName, gradeCount: metadata.grades.length });
    }
  }

  return {
    totalSeries: series.length,
    totalImages,
    seriesDetails,
  };
}

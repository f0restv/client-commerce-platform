/**
 * Populate Reference Images from Public Sources
 *
 * This script downloads reference images from publicly accessible sources
 * like Heritage Auctions archives where images are freely available.
 *
 * Usage: npx tsx scripts/populate-reference-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

interface ReferenceImageSource {
  series: string;
  displayName: string;
  images: {
    grade: string;
    numericGrade: number;
    obverseUrl?: string;
    reverseUrl?: string;
    source: string;
  }[];
}

// Curated reference images from Heritage Auctions and other public sources
// These are real coins with known grades that serve as visual benchmarks
const REFERENCE_SOURCES: ReferenceImageSource[] = [
  {
    series: 'morgan-dollar',
    displayName: 'Morgan Dollar',
    images: [
      // These would be real Heritage Auctions or similar archive URLs
      // Placeholder structure - would need to be populated with actual URLs
      { grade: 'G-4', numericGrade: 4, source: 'heritage-auctions' },
      { grade: 'VG-8', numericGrade: 8, source: 'heritage-auctions' },
      { grade: 'F-12', numericGrade: 12, source: 'heritage-auctions' },
      { grade: 'VF-20', numericGrade: 20, source: 'heritage-auctions' },
      { grade: 'VF-30', numericGrade: 30, source: 'heritage-auctions' },
      { grade: 'EF-40', numericGrade: 40, source: 'heritage-auctions' },
      { grade: 'EF-45', numericGrade: 45, source: 'heritage-auctions' },
      { grade: 'AU-50', numericGrade: 50, source: 'heritage-auctions' },
      { grade: 'AU-55', numericGrade: 55, source: 'heritage-auctions' },
      { grade: 'AU-58', numericGrade: 58, source: 'heritage-auctions' },
      { grade: 'MS-60', numericGrade: 60, source: 'heritage-auctions' },
      { grade: 'MS-62', numericGrade: 62, source: 'heritage-auctions' },
      { grade: 'MS-63', numericGrade: 63, source: 'heritage-auctions' },
      { grade: 'MS-64', numericGrade: 64, source: 'heritage-auctions' },
      { grade: 'MS-65', numericGrade: 65, source: 'heritage-auctions' },
      { grade: 'MS-66', numericGrade: 66, source: 'heritage-auctions' },
      { grade: 'MS-67', numericGrade: 67, source: 'heritage-auctions' },
    ],
  },
  {
    series: 'peace-dollar',
    displayName: 'Peace Dollar',
    images: [
      { grade: 'VG-8', numericGrade: 8, source: 'heritage-auctions' },
      { grade: 'F-12', numericGrade: 12, source: 'heritage-auctions' },
      { grade: 'VF-20', numericGrade: 20, source: 'heritage-auctions' },
      { grade: 'VF-30', numericGrade: 30, source: 'heritage-auctions' },
      { grade: 'EF-40', numericGrade: 40, source: 'heritage-auctions' },
      { grade: 'AU-50', numericGrade: 50, source: 'heritage-auctions' },
      { grade: 'AU-55', numericGrade: 55, source: 'heritage-auctions' },
      { grade: 'AU-58', numericGrade: 58, source: 'heritage-auctions' },
      { grade: 'MS-60', numericGrade: 60, source: 'heritage-auctions' },
      { grade: 'MS-63', numericGrade: 63, source: 'heritage-auctions' },
      { grade: 'MS-64', numericGrade: 64, source: 'heritage-auctions' },
      { grade: 'MS-65', numericGrade: 65, source: 'heritage-auctions' },
      { grade: 'MS-66', numericGrade: 66, source: 'heritage-auctions' },
    ],
  },
];

function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);

    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(outputPath);
          downloadImage(redirectUrl, outputPath).then(resolve);
        } else {
          file.close();
          resolve(false);
        }
      } else {
        file.close();
        fs.unlinkSync(outputPath);
        resolve(false);
      }
    }).on('error', () => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      resolve(false);
    });
  });
}

async function processSource(source: ReferenceImageSource): Promise<void> {
  const seriesDir = path.join(OUTPUT_DIR, source.series);
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }

  console.log(`\nProcessing ${source.displayName}...`);

  const grades: Array<{
    grade: string;
    numericGrade: number;
    obversePath: string | null;
    reversePath: string | null;
    obverseUrl: string | null;
    reverseUrl: string | null;
  }> = [];

  for (const img of source.images) {
    const gradeEntry = {
      grade: img.grade,
      numericGrade: img.numericGrade,
      obversePath: null as string | null,
      reversePath: null as string | null,
      obverseUrl: img.obverseUrl || null,
      reverseUrl: img.reverseUrl || null,
    };

    if (img.obverseUrl) {
      const fileName = `${img.grade.replace('-', '')}_obverse.jpg`;
      const outputPath = path.join(seriesDir, fileName);

      if (await downloadImage(img.obverseUrl, outputPath)) {
        gradeEntry.obversePath = outputPath;
        console.log(`  Downloaded ${img.grade} obverse`);
      }
    }

    if (img.reverseUrl) {
      const fileName = `${img.grade.replace('-', '')}_reverse.jpg`;
      const outputPath = path.join(seriesDir, fileName);

      if (await downloadImage(img.reverseUrl, outputPath)) {
        gradeEntry.reversePath = outputPath;
        console.log(`  Downloaded ${img.grade} reverse`);
      }
    }

    grades.push(gradeEntry);
  }

  // Save metadata
  const metadata = {
    series: source.series,
    displayName: source.displayName,
    scrapedAt: new Date().toISOString(),
    source: 'curated-public-sources',
    grades: grades.filter(g => g.obversePath || g.reversePath),
  };

  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`  Saved metadata for ${source.displayName}`);
}

async function main() {
  console.log('Reference Image Population Script');
  console.log('==================================');
  console.log(`Output directory: ${OUTPUT_DIR}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const source of REFERENCE_SOURCES) {
    await processSource(source);
  }

  // Create index
  const index = {
    createdAt: new Date().toISOString(),
    series: REFERENCE_SOURCES.map(s => ({
      name: s.series,
      displayName: s.displayName,
      gradeCount: s.images.length,
    })),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
  console.log('\nPopulation complete!');
}

main().catch(console.error);

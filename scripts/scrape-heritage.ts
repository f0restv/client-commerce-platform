/**
 * Heritage Auctions Reference Image Scraper
 *
 * Heritage Auctions has a massive public archive of coin images
 * with certified grades. This scraper fetches reference images
 * from their archive.
 *
 * Usage: npx tsx scripts/scrape-heritage.ts [--series morgan-dollar]
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

// Heritage Auctions search URLs for graded coins
const COIN_SERIES: Record<string, {
  searchTerms: string;
  name: string;
  displayName: string;
}> = {
  'morgan-dollar': {
    searchTerms: 'Morgan Dollar PCGS',
    name: 'morgan-dollar',
    displayName: 'Morgan Dollar',
  },
  'peace-dollar': {
    searchTerms: 'Peace Dollar PCGS',
    name: 'peace-dollar',
    displayName: 'Peace Dollar',
  },
  'walking-liberty-half': {
    searchTerms: 'Walking Liberty Half PCGS',
    name: 'walking-liberty-half',
    displayName: 'Walking Liberty Half Dollar',
  },
};

// Target grades to find examples for
const TARGET_GRADES = [
  { grade: 'G-4', numericGrade: 4, searchTerm: 'G4' },
  { grade: 'VG-8', numericGrade: 8, searchTerm: 'VG8' },
  { grade: 'F-12', numericGrade: 12, searchTerm: 'F12' },
  { grade: 'VF-20', numericGrade: 20, searchTerm: 'VF20' },
  { grade: 'VF-30', numericGrade: 30, searchTerm: 'VF30' },
  { grade: 'EF-40', numericGrade: 40, searchTerm: 'EF40' },
  { grade: 'EF-45', numericGrade: 45, searchTerm: 'EF45' },
  { grade: 'AU-50', numericGrade: 50, searchTerm: 'AU50' },
  { grade: 'AU-55', numericGrade: 55, searchTerm: 'AU55' },
  { grade: 'AU-58', numericGrade: 58, searchTerm: 'AU58' },
  { grade: 'MS-60', numericGrade: 60, searchTerm: 'MS60' },
  { grade: 'MS-62', numericGrade: 62, searchTerm: 'MS62' },
  { grade: 'MS-63', numericGrade: 63, searchTerm: 'MS63' },
  { grade: 'MS-64', numericGrade: 64, searchTerm: 'MS64' },
  { grade: 'MS-65', numericGrade: 65, searchTerm: 'MS65' },
  { grade: 'MS-66', numericGrade: 66, searchTerm: 'MS66' },
];

interface GradeImage {
  grade: string;
  numericGrade: number;
  obverseUrl: string | null;
  reverseUrl: string | null;
  obversePath: string | null;
  reversePath: string | null;
  sourceUrl?: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(page: Page, url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await page.request.get(url, {
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://coins.ha.com/',
      }
    });

    if (!response.ok()) {
      console.error(`  Download failed: ${response.status()}`);
      return false;
    }

    const buffer = await response.body();
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.error(`  Error downloading:`, error);
    return false;
  }
}

async function findGradeExample(
  page: Page,
  seriesName: string,
  gradeInfo: { grade: string; numericGrade: number; searchTerm: string }
): Promise<{ imageUrl: string; lotUrl: string } | null> {
  const searchUrl = `https://coins.ha.com/c/search.zx?N=790+231+792&Ntt=${encodeURIComponent(seriesName + ' ' + gradeInfo.searchTerm)}&type=surl-sold`;

  console.log(`  Searching for ${gradeInfo.grade}...`);

  try {
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    // Look for lot images
    const lotImage = await page.$('.thumb-image img, .lot-image img, [data-lot-image] img');

    if (lotImage) {
      const src = await lotImage.getAttribute('src');
      const lotLink = await page.$('.lot-title a, .item-title a');
      const lotUrl = lotLink ? await lotLink.getAttribute('href') : null;

      if (src) {
        // Heritage uses different image sizes - get the larger version
        const largeUrl = src.replace(/\/s\//, '/l/').replace(/_s\./, '_l.');
        return {
          imageUrl: largeUrl.startsWith('http') ? largeUrl : `https://coins.ha.com${largeUrl}`,
          lotUrl: lotUrl ? `https://coins.ha.com${lotUrl}` : searchUrl,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`  Search error:`, error);
    return null;
  }
}

async function scrapeSeries(page: Page, seriesKey: string): Promise<void> {
  const series = COIN_SERIES[seriesKey];
  if (!series) {
    console.error(`Unknown series: ${seriesKey}`);
    return;
  }

  const seriesDir = path.join(OUTPUT_DIR, series.name);
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }

  console.log(`\nScraping ${series.displayName} from Heritage Auctions...`);

  const grades: GradeImage[] = [];

  for (const gradeInfo of TARGET_GRADES) {
    const result = await findGradeExample(page, series.searchTerms, gradeInfo);

    if (result) {
      const fileName = `${gradeInfo.grade.replace('-', '')}_obverse.jpg`;
      const outputPath = path.join(seriesDir, fileName);

      if (await downloadImage(page, result.imageUrl, outputPath)) {
        console.log(`    Downloaded ${gradeInfo.grade}`);
        grades.push({
          grade: gradeInfo.grade,
          numericGrade: gradeInfo.numericGrade,
          obverseUrl: result.imageUrl,
          reverseUrl: null,
          obversePath: outputPath,
          reversePath: null,
          sourceUrl: result.lotUrl,
        });
      }
    }

    await delay(1500); // Rate limiting
  }

  // Save metadata
  const metadata = {
    series: series.name,
    displayName: series.displayName,
    scrapedAt: new Date().toISOString(),
    source: 'heritage-auctions',
    grades,
  };

  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`  Saved ${grades.length} grades for ${series.displayName}`);
}

async function main() {
  const args = process.argv.slice(2);
  let seriesToScrape: string[] = [];

  const seriesIndex = args.indexOf('--series');
  const allFlag = args.includes('--all');

  if (allFlag) {
    seriesToScrape = Object.keys(COIN_SERIES);
  } else if (seriesIndex !== -1 && args[seriesIndex + 1]) {
    seriesToScrape = [args[seriesIndex + 1]];
  } else {
    seriesToScrape = ['morgan-dollar'];
  }

  console.log('Heritage Auctions Reference Image Scraper');
  console.log('==========================================');
  console.log(`Output directory: ${OUTPUT_DIR}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  for (const seriesKey of seriesToScrape) {
    await scrapeSeries(page, seriesKey);
    await delay(2000);
  }

  await browser.close();
  console.log('\nScraping complete!');
}

main().catch(console.error);

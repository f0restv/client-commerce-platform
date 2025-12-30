/**
 * PCGS Photograde Reference Image Scraper
 *
 * Scrapes high-quality reference images from PCGS Photograde for use in AI visual grading.
 * These images serve as benchmarks for comparing submitted coin photos.
 *
 * Usage: npx tsx scripts/scrape-photograde.ts [--series morgan-dollar] [--all]
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.pcgs.com/photograde';
const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

// PCGS Photograde series IDs and their folder names
const COIN_SERIES: Record<string, { id: number; name: string; displayName: string }> = {
  'morgan-dollar': { id: 7, name: 'morgan-dollar', displayName: 'Morgan Dollar' },
  'peace-dollar': { id: 8, name: 'peace-dollar', displayName: 'Peace Dollar' },
  'walking-liberty-half': { id: 30, name: 'walking-liberty-half', displayName: 'Walking Liberty Half' },
  'franklin-half': { id: 31, name: 'franklin-half', displayName: 'Franklin Half Dollar' },
  'kennedy-half': { id: 32, name: 'kennedy-half', displayName: 'Kennedy Half Dollar' },
  'barber-quarter': { id: 24, name: 'barber-quarter', displayName: 'Barber Quarter' },
  'standing-liberty-quarter': { id: 25, name: 'standing-liberty-quarter', displayName: 'Standing Liberty Quarter' },
  'washington-quarter': { id: 26, name: 'washington-quarter', displayName: 'Washington Quarter' },
  'barber-dime': { id: 17, name: 'barber-dime', displayName: 'Barber Dime' },
  'mercury-dime': { id: 18, name: 'mercury-dime', displayName: 'Mercury Dime' },
  'roosevelt-dime': { id: 19, name: 'roosevelt-dime', displayName: 'Roosevelt Dime' },
  'buffalo-nickel': { id: 12, name: 'buffalo-nickel', displayName: 'Buffalo Nickel' },
  'jefferson-nickel': { id: 13, name: 'jefferson-nickel', displayName: 'Jefferson Nickel' },
  'indian-head-cent': { id: 2, name: 'indian-head-cent', displayName: 'Indian Head Cent' },
  'lincoln-wheat-cent': { id: 3, name: 'lincoln-wheat-cent', displayName: 'Lincoln Wheat Cent' },
  'saint-gaudens-double-eagle': { id: 60, name: 'saint-gaudens-double-eagle', displayName: 'Saint-Gaudens $20' },
  'liberty-head-double-eagle': { id: 59, name: 'liberty-head-double-eagle', displayName: 'Liberty Head $20' },
  'indian-head-eagle': { id: 56, name: 'indian-head-eagle', displayName: 'Indian Head $10' },
  'liberty-head-eagle': { id: 55, name: 'liberty-head-eagle', displayName: 'Liberty Head $10' },
  'indian-head-half-eagle': { id: 52, name: 'indian-head-half-eagle', displayName: 'Indian Head $5' },
  'liberty-head-half-eagle': { id: 51, name: 'liberty-head-half-eagle', displayName: 'Liberty Head $5' },
  'trade-dollar': { id: 9, name: 'trade-dollar', displayName: 'Trade Dollar' },
  'seated-liberty-dollar': { id: 6, name: 'seated-liberty-dollar', displayName: 'Seated Liberty Dollar' },
};

// Standard grade levels for reference
const GRADES = [
  'AG-3', 'G-4', 'G-6', 'VG-8', 'VG-10',
  'F-12', 'F-15', 'VF-20', 'VF-25', 'VF-30', 'VF-35',
  'EF-40', 'EF-45', 'AU-50', 'AU-53', 'AU-55', 'AU-58',
  'MS-60', 'MS-61', 'MS-62', 'MS-63', 'MS-64', 'MS-65', 'MS-66', 'MS-67', 'MS-68', 'MS-69', 'MS-70'
];

interface GradeImage {
  grade: string;
  numericGrade: number;
  obverseUrl: string;
  reverseUrl: string;
  obversePath: string;
  reversePath: string;
}

interface SeriesData {
  series: string;
  displayName: string;
  scrapedAt: string;
  grades: GradeImage[];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(page: Page, url: string, outputPath: string): Promise<boolean> {
  try {
    // Use page context to fetch the image (maintains cookies/session)
    const response = await page.request.get(url);
    if (!response.ok()) {
      console.error(`Failed to download ${url}: ${response.status()}`);
      return false;
    }

    const buffer = await response.body();
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.error(`Error downloading ${url}:`, error);
    return false;
  }
}

async function scrapeSeriesFromPage(page: Page, seriesKey: string): Promise<SeriesData | null> {
  const series = COIN_SERIES[seriesKey];
  if (!series) {
    console.error(`Unknown series: ${seriesKey}`);
    return null;
  }

  const seriesDir = path.join(OUTPUT_DIR, series.name);
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }

  console.log(`\nScraping ${series.displayName}...`);

  // Navigate to the series page
  const url = `${BASE_URL}/${series.name}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await delay(2000); // Wait for images to load

  const grades: GradeImage[] = [];

  // Find all grade elements on the page
  // PCGS Photograde uses a grid of grade images
  const gradeElements = await page.$$('[data-grade], .photograde-item, .grade-item');

  if (gradeElements.length === 0) {
    // Try alternative selectors - the page structure may vary
    console.log('Trying alternative selector approach...');

    // Look for image containers
    const images = await page.$$('img[src*="photograde"], img[src*="Photograde"]');
    console.log(`Found ${images.length} potential grade images`);

    for (const img of images) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt') || '';

      // Try to extract grade from alt text or URL
      const gradeMatch = alt.match(/(AG|G|VG|F|VF|EF|AU|MS|PF)-?(\d+)/i) ||
                         src?.match(/grade[_-]?(AG|G|VG|F|VF|EF|AU|MS|PF)-?(\d+)/i);

      if (gradeMatch && src) {
        const gradeStr = `${gradeMatch[1].toUpperCase()}-${gradeMatch[2]}`;
        const numericGrade = parseInt(gradeMatch[2]);

        // Determine if obverse or reverse
        const isReverse = alt.toLowerCase().includes('reverse') ||
                         src.toLowerCase().includes('reverse') ||
                         src.toLowerCase().includes('rev');

        const side = isReverse ? 'reverse' : 'obverse';
        const fileName = `${gradeStr.replace('-', '')}_${side}.jpg`;
        const outputPath = path.join(seriesDir, fileName);

        // Download the image
        if (await downloadImage(page, src, outputPath)) {
          // Find or create grade entry
          let gradeEntry = grades.find(g => g.grade === gradeStr);
          if (!gradeEntry) {
            gradeEntry = {
              grade: gradeStr,
              numericGrade,
              obverseUrl: '',
              reverseUrl: '',
              obversePath: '',
              reversePath: '',
            };
            grades.push(gradeEntry);
          }

          if (isReverse) {
            gradeEntry.reverseUrl = src;
            gradeEntry.reversePath = outputPath;
          } else {
            gradeEntry.obverseUrl = src;
            gradeEntry.obversePath = outputPath;
          }

          console.log(`  Downloaded ${gradeStr} ${side}`);
        }
      }
    }
  } else {
    // Process structured grade elements
    for (const element of gradeElements) {
      const gradeAttr = await element.getAttribute('data-grade');
      const gradeText = await element.textContent();

      // Extract grade from attribute or text
      const gradeMatch = (gradeAttr || gradeText || '').match(/(AG|G|VG|F|VF|EF|AU|MS|PF)-?(\d+)/i);
      if (!gradeMatch) continue;

      const gradeStr = `${gradeMatch[1].toUpperCase()}-${gradeMatch[2]}`;
      const numericGrade = parseInt(gradeMatch[2]);

      // Find images within this grade element
      const obverseImg = await element.$('img.obverse, img[alt*="obverse"], img:first-child');
      const reverseImg = await element.$('img.reverse, img[alt*="reverse"], img:last-child');

      const gradeEntry: GradeImage = {
        grade: gradeStr,
        numericGrade,
        obverseUrl: '',
        reverseUrl: '',
        obversePath: '',
        reversePath: '',
      };

      if (obverseImg) {
        const src = await obverseImg.getAttribute('src');
        if (src) {
          gradeEntry.obverseUrl = src;
          const fileName = `${gradeStr.replace('-', '')}_obverse.jpg`;
          gradeEntry.obversePath = path.join(seriesDir, fileName);
          await downloadImage(page, src, gradeEntry.obversePath);
          console.log(`  Downloaded ${gradeStr} obverse`);
        }
      }

      if (reverseImg) {
        const src = await reverseImg.getAttribute('src');
        if (src) {
          gradeEntry.reverseUrl = src;
          const fileName = `${gradeStr.replace('-', '')}_reverse.jpg`;
          gradeEntry.reversePath = path.join(seriesDir, fileName);
          await downloadImage(page, src, gradeEntry.reversePath);
          console.log(`  Downloaded ${gradeStr} reverse`);
        }
      }

      if (gradeEntry.obverseUrl || gradeEntry.reverseUrl) {
        grades.push(gradeEntry);
      }
    }
  }

  // Sort grades by numeric value
  grades.sort((a, b) => a.numericGrade - b.numericGrade);

  const seriesData: SeriesData = {
    series: series.name,
    displayName: series.displayName,
    scrapedAt: new Date().toISOString(),
    grades,
  };

  // Save metadata
  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(seriesData, null, 2));
  console.log(`  Saved ${grades.length} grades for ${series.displayName}`);

  return seriesData;
}

async function scrapeViaNetworkIntercept(page: Page, seriesKey: string): Promise<SeriesData | null> {
  /**
   * Alternative approach: intercept network requests to capture image URLs
   * This is more reliable as it catches dynamically loaded images
   */
  const series = COIN_SERIES[seriesKey];
  if (!series) {
    console.error(`Unknown series: ${seriesKey}`);
    return null;
  }

  const seriesDir = path.join(OUTPUT_DIR, series.name);
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }

  console.log(`\nScraping ${series.displayName} via network intercept...`);

  const capturedImages: Map<string, string> = new Map();

  // Intercept image requests
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('photograde') && (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.webp'))) {
      capturedImages.set(url, url);
    }
  });

  // Navigate to the series page
  const url = `${BASE_URL}/${series.name}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await delay(3000);

  // Scroll through the page to trigger lazy loading
  await page.evaluate(async () => {
    const scrollStep = 300;
    const scrollDelay = 100;
    const maxScroll = document.body.scrollHeight;

    for (let scrollPos = 0; scrollPos < maxScroll; scrollPos += scrollStep) {
      window.scrollTo(0, scrollPos);
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  });

  await delay(2000);

  console.log(`  Captured ${capturedImages.size} image URLs`);

  const grades: GradeImage[] = [];

  // Download captured images and organize by grade
  for (const [imageUrl] of capturedImages) {
    // Extract grade from URL
    const gradeMatch = imageUrl.match(/(AG|G|VG|F|VF|EF|AU|MS|PF)[_-]?(\d+)/i);
    if (!gradeMatch) continue;

    const gradeStr = `${gradeMatch[1].toUpperCase()}-${gradeMatch[2]}`;
    const numericGrade = parseInt(gradeMatch[2]);

    // Determine side
    const isReverse = imageUrl.toLowerCase().includes('reverse') ||
                      imageUrl.toLowerCase().includes('rev') ||
                      imageUrl.toLowerCase().includes('_r.');

    const side = isReverse ? 'reverse' : 'obverse';
    const ext = path.extname(imageUrl) || '.jpg';
    const fileName = `${gradeStr.replace('-', '')}_${side}${ext}`;
    const outputPath = path.join(seriesDir, fileName);

    if (await downloadImage(page, imageUrl, outputPath)) {
      let gradeEntry = grades.find(g => g.grade === gradeStr);
      if (!gradeEntry) {
        gradeEntry = {
          grade: gradeStr,
          numericGrade,
          obverseUrl: '',
          reverseUrl: '',
          obversePath: '',
          reversePath: '',
        };
        grades.push(gradeEntry);
      }

      if (isReverse) {
        gradeEntry.reverseUrl = imageUrl;
        gradeEntry.reversePath = outputPath;
      } else {
        gradeEntry.obverseUrl = imageUrl;
        gradeEntry.obversePath = outputPath;
      }

      console.log(`  Downloaded ${gradeStr} ${side}`);
    }
  }

  grades.sort((a, b) => a.numericGrade - b.numericGrade);

  const seriesData: SeriesData = {
    series: series.name,
    displayName: series.displayName,
    scrapedAt: new Date().toISOString(),
    grades,
  };

  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(seriesData, null, 2));
  console.log(`  Saved ${grades.length} grades for ${series.displayName}`);

  return seriesData;
}

async function scrapeWithDirectUrls(page: Page, seriesKey: string): Promise<SeriesData | null> {
  /**
   * Approach 3: Use known PCGS Photograde URL patterns
   * PCGS images typically follow patterns like:
   * https://images.pcgs.com/photograde/[series]/[grade]-[side].jpg
   */
  const series = COIN_SERIES[seriesKey];
  if (!series) {
    console.error(`Unknown series: ${seriesKey}`);
    return null;
  }

  const seriesDir = path.join(OUTPUT_DIR, series.name);
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }

  console.log(`\nScraping ${series.displayName} using direct URL patterns...`);

  // First, navigate to the page to establish session
  const url = `${BASE_URL}/${series.name}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await delay(1500);

  // Get all image sources from the page
  const imageSources = await page.evaluate(() => {
    const images = document.querySelectorAll('img');
    return Array.from(images).map(img => ({
      src: img.src,
      alt: img.alt,
      dataSrc: img.getAttribute('data-src'),
    }));
  });

  const grades: GradeImage[] = [];

  for (const imgData of imageSources) {
    const src = imgData.dataSrc || imgData.src;
    if (!src || !src.includes('pcgs')) continue;

    // Extract grade info
    const gradeMatch = src.match(/(AG|G|VG|F|VF|EF|AU|MS|PF)[_-]?(\d+)/i) ||
                       imgData.alt.match(/(AG|G|VG|F|VF|EF|AU|MS|PF)[_-]?(\d+)/i);

    if (!gradeMatch) continue;

    const gradeStr = `${gradeMatch[1].toUpperCase()}-${gradeMatch[2]}`;
    const numericGrade = parseInt(gradeMatch[2]);

    const isReverse = src.toLowerCase().includes('reverse') ||
                      src.toLowerCase().includes('_r') ||
                      imgData.alt.toLowerCase().includes('reverse');

    const side = isReverse ? 'reverse' : 'obverse';
    const fileName = `${gradeStr.replace('-', '')}_${side}.jpg`;
    const outputPath = path.join(seriesDir, fileName);

    if (!fs.existsSync(outputPath)) {
      if (await downloadImage(page, src, outputPath)) {
        console.log(`  Downloaded ${gradeStr} ${side}`);
      }
    }

    let gradeEntry = grades.find(g => g.grade === gradeStr);
    if (!gradeEntry) {
      gradeEntry = {
        grade: gradeStr,
        numericGrade,
        obverseUrl: '',
        reverseUrl: '',
        obversePath: '',
        reversePath: '',
      };
      grades.push(gradeEntry);
    }

    if (isReverse) {
      gradeEntry.reverseUrl = src;
      gradeEntry.reversePath = outputPath;
    } else {
      gradeEntry.obverseUrl = src;
      gradeEntry.obversePath = outputPath;
    }
  }

  grades.sort((a, b) => a.numericGrade - b.numericGrade);

  const seriesData: SeriesData = {
    series: series.name,
    displayName: series.displayName,
    scrapedAt: new Date().toISOString(),
    grades,
  };

  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(seriesData, null, 2));
  console.log(`  Saved ${grades.length} grades for ${series.displayName}`);

  return seriesData;
}

async function main() {
  const args = process.argv.slice(2);
  let seriesToScrape: string[] = [];

  // Parse arguments
  const seriesIndex = args.indexOf('--series');
  const allFlag = args.includes('--all');

  if (allFlag) {
    seriesToScrape = Object.keys(COIN_SERIES);
  } else if (seriesIndex !== -1 && args[seriesIndex + 1]) {
    seriesToScrape = [args[seriesIndex + 1]];
  } else {
    // Default: scrape major series
    seriesToScrape = [
      'morgan-dollar',
      'peace-dollar',
      'walking-liberty-half',
      'mercury-dime',
      'buffalo-nickel',
      'lincoln-wheat-cent',
      'saint-gaudens-double-eagle',
    ];
  }

  console.log('PCGS Photograde Reference Image Scraper');
  console.log('========================================');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Series to scrape: ${seriesToScrape.join(', ')}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Launch browser
  const browser: Browser = await chromium.launch({
    headless: false, // Use visible browser to handle any challenges
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Initial navigation to establish session
  console.log('\nNavigating to PCGS Photograde...');
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);
  } catch (error) {
    console.log('PCGS navigation slow, continuing anyway...');
  }

  const allSeriesData: SeriesData[] = [];

  for (const seriesKey of seriesToScrape) {
    try {
      // Try multiple scraping approaches
      let seriesData = await scrapeWithDirectUrls(page, seriesKey);

      if (!seriesData || seriesData.grades.length === 0) {
        console.log('  Direct URL approach failed, trying network intercept...');
        seriesData = await scrapeViaNetworkIntercept(page, seriesKey);
      }

      if (!seriesData || seriesData.grades.length === 0) {
        console.log('  Network intercept failed, trying DOM scraping...');
        seriesData = await scrapeSeriesFromPage(page, seriesKey);
      }

      if (seriesData && seriesData.grades.length > 0) {
        allSeriesData.push(seriesData);
      } else {
        console.log(`  Warning: No images found for ${seriesKey}`);
      }

      // Rate limiting
      await delay(2000);
    } catch (error) {
      console.error(`Error scraping ${seriesKey}:`, error);
    }
  }

  // Save summary
  const summaryPath = path.join(OUTPUT_DIR, 'index.json');
  const summary = {
    scrapedAt: new Date().toISOString(),
    source: 'PCGS Photograde',
    totalSeries: allSeriesData.length,
    totalGrades: allSeriesData.reduce((sum, s) => sum + s.grades.length, 0),
    series: allSeriesData.map(s => ({
      name: s.series,
      displayName: s.displayName,
      gradeCount: s.grades.length,
    })),
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n========================================');
  console.log('Scraping complete!');
  console.log(`Total series: ${summary.totalSeries}`);
  console.log(`Total grade images: ${summary.totalGrades}`);
  console.log(`Summary saved to: ${summaryPath}`);

  await browser.close();
}

main().catch(console.error);

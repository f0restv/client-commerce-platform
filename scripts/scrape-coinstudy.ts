/**
 * CoinStudy Reference Image Scraper
 *
 * CoinStudy.com has excellent grading guides with comparison images
 * that are more accessible than PCGS Photograde.
 *
 * Usage: npx tsx scripts/scrape-coinstudy.ts [--series morgan-dollar]
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

// CoinStudy grading guide URLs
const COIN_SERIES: Record<string, { url: string; name: string; displayName: string }> = {
  'morgan-dollar': {
    url: 'https://www.coinstudy.com/morgan-silver-dollar-value.html',
    name: 'morgan-dollar',
    displayName: 'Morgan Dollar',
  },
  'peace-dollar': {
    url: 'https://www.coinstudy.com/peace-dollar-value.html',
    name: 'peace-dollar',
    displayName: 'Peace Dollar',
  },
  'walking-liberty-half': {
    url: 'https://www.coinstudy.com/walking-liberty-half-dollar-value.html',
    name: 'walking-liberty-half',
    displayName: 'Walking Liberty Half Dollar',
  },
  'mercury-dime': {
    url: 'https://www.coinstudy.com/mercury-dime-value.html',
    name: 'mercury-dime',
    displayName: 'Mercury Dime',
  },
  'buffalo-nickel': {
    url: 'https://www.coinstudy.com/buffalo-nickel-value.html',
    name: 'buffalo-nickel',
    displayName: 'Buffalo Nickel',
  },
  'lincoln-wheat-cent': {
    url: 'https://www.coinstudy.com/lincoln-penny-value.html',
    name: 'lincoln-wheat-cent',
    displayName: 'Lincoln Wheat Cent',
  },
  'barber-quarter': {
    url: 'https://www.coinstudy.com/barber-quarter-value.html',
    name: 'barber-quarter',
    displayName: 'Barber Quarter',
  },
  'standing-liberty-quarter': {
    url: 'https://www.coinstudy.com/standing-liberty-quarter-value.html',
    name: 'standing-liberty-quarter',
    displayName: 'Standing Liberty Quarter',
  },
  'washington-quarter': {
    url: 'https://www.coinstudy.com/washington-quarter-value.html',
    name: 'washington-quarter',
    displayName: 'Washington Quarter',
  },
  'franklin-half': {
    url: 'https://www.coinstudy.com/franklin-half-dollar-value.html',
    name: 'franklin-half',
    displayName: 'Franklin Half Dollar',
  },
  'indian-head-cent': {
    url: 'https://www.coinstudy.com/indian-head-penny-value.html',
    name: 'indian-head-cent',
    displayName: 'Indian Head Cent',
  },
};

interface GradeImage {
  grade: string;
  numericGrade: number;
  obverseUrl: string | null;
  reverseUrl: string | null;
  obversePath: string | null;
  reversePath: string | null;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(page: Page, url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await page.request.get(url);
    if (!response.ok()) {
      console.error(`  Failed to download: ${response.status()}`);
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

function parseGradeFromText(text: string): { grade: string; numericGrade: number } | null {
  // Match patterns like "Good", "Very Good", "Fine", "Very Fine", "Extremely Fine",
  // "About Uncirculated", "Mint State", "MS-65", "VF-30", etc.
  const patterns = [
    { regex: /mint\s*state\s*(\d+)|MS[- ]?(\d+)/i, prefix: 'MS' },
    { regex: /about\s*uncirculated\s*(\d+)?|AU[- ]?(\d+)/i, prefix: 'AU', default: 50 },
    { regex: /extremely\s*fine\s*(\d+)?|EF[- ]?(\d+)|XF[- ]?(\d+)/i, prefix: 'EF', default: 40 },
    { regex: /very\s*fine\s*(\d+)?|VF[- ]?(\d+)/i, prefix: 'VF', default: 20 },
    { regex: /fine\s*(\d+)?|F[- ]?(\d+)/i, prefix: 'F', default: 12 },
    { regex: /very\s*good\s*(\d+)?|VG[- ]?(\d+)/i, prefix: 'VG', default: 8 },
    { regex: /good\s*(\d+)?|G[- ]?(\d+)/i, prefix: 'G', default: 4 },
  ];

  for (const { regex, prefix, default: defaultNum } of patterns) {
    const match = text.match(regex);
    if (match) {
      const num = parseInt(match[1] || match[2] || match[3]) || defaultNum || 0;
      if (num > 0) {
        return { grade: `${prefix}-${num}`, numericGrade: num };
      }
    }
  }

  return null;
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

  console.log(`\nScraping ${series.displayName} from CoinStudy...`);
  console.log(`URL: ${series.url}`);

  try {
    await page.goto(series.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);
  } catch (error) {
    console.error(`Failed to load page: ${error}`);
    return;
  }

  const grades: GradeImage[] = [];

  // Find all images on the page
  const images = await page.$$('img');
  console.log(`  Found ${images.length} images on page`);

  for (const img of images) {
    try {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt') || '';
      const title = await img.getAttribute('title') || '';

      if (!src) continue;

      // Skip non-coin images
      if (src.includes('logo') || src.includes('banner') || src.includes('ad') ||
          src.includes('icon') || src.includes('button')) continue;

      // Try to extract grade from alt text or surrounding context
      const gradeInfo = parseGradeFromText(alt) || parseGradeFromText(title);

      if (!gradeInfo) continue;

      // Make URL absolute
      const absoluteUrl = src.startsWith('http') ? src : new URL(src, series.url).href;

      // Determine if obverse or reverse
      const isReverse = alt.toLowerCase().includes('reverse') ||
                        alt.toLowerCase().includes('back') ||
                        title.toLowerCase().includes('reverse');

      const side = isReverse ? 'reverse' : 'obverse';
      const fileName = `${gradeInfo.grade.replace('-', '')}_${side}.jpg`;
      const outputPath = path.join(seriesDir, fileName);

      // Check if we already have this grade
      let gradeEntry = grades.find(g => g.grade === gradeInfo.grade);
      if (!gradeEntry) {
        gradeEntry = {
          grade: gradeInfo.grade,
          numericGrade: gradeInfo.numericGrade,
          obverseUrl: null,
          reverseUrl: null,
          obversePath: null,
          reversePath: null,
        };
        grades.push(gradeEntry);
      }

      // Download the image
      if (!fs.existsSync(outputPath)) {
        if (await downloadImage(page, absoluteUrl, outputPath)) {
          console.log(`  Downloaded ${gradeInfo.grade} ${side}`);
          if (isReverse) {
            gradeEntry.reverseUrl = absoluteUrl;
            gradeEntry.reversePath = outputPath;
          } else {
            gradeEntry.obverseUrl = absoluteUrl;
            gradeEntry.obversePath = outputPath;
          }
        }
      } else {
        if (isReverse) {
          gradeEntry.reverseUrl = absoluteUrl;
          gradeEntry.reversePath = outputPath;
        } else {
          gradeEntry.obverseUrl = absoluteUrl;
          gradeEntry.obversePath = outputPath;
        }
      }
    } catch (error) {
      // Continue with next image
    }
  }

  // Also try to find images in grading sections
  // CoinStudy often has sections like "Grading Morgan Silver Dollars"
  const gradingSections = await page.$$('h2, h3, .grading, [class*="grade"]');

  for (const section of gradingSections) {
    const text = await section.textContent() || '';
    const gradeInfo = parseGradeFromText(text);

    if (gradeInfo) {
      // Look for nearby images
      const parent = await section.evaluateHandle(el => el.parentElement);
      const nearbyImages = await (parent as any).$$('img');

      for (const img of nearbyImages) {
        const src = await img.getAttribute('src');
        if (!src) continue;

        const absoluteUrl = src.startsWith('http') ? src : new URL(src, series.url).href;
        const fileName = `${gradeInfo.grade.replace('-', '')}_obverse.jpg`;
        const outputPath = path.join(seriesDir, fileName);

        let gradeEntry = grades.find(g => g.grade === gradeInfo.grade);
        if (!gradeEntry) {
          gradeEntry = {
            grade: gradeInfo.grade,
            numericGrade: gradeInfo.numericGrade,
            obverseUrl: null,
            reverseUrl: null,
            obversePath: null,
            reversePath: null,
          };
          grades.push(gradeEntry);
        }

        if (!gradeEntry.obversePath && !fs.existsSync(outputPath)) {
          if (await downloadImage(page, absoluteUrl, outputPath)) {
            console.log(`  Downloaded ${gradeInfo.grade} from section`);
            gradeEntry.obverseUrl = absoluteUrl;
            gradeEntry.obversePath = outputPath;
          }
        }
      }
    }
  }

  // Sort grades by numeric value
  grades.sort((a, b) => a.numericGrade - b.numericGrade);

  // Save metadata
  const metadata = {
    series: series.name,
    displayName: series.displayName,
    scrapedAt: new Date().toISOString(),
    source: 'coinstudy.com',
    sourceUrl: series.url,
    grades: grades.filter(g => g.obversePath || g.reversePath),
  };

  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`  Saved ${metadata.grades.length} grades for ${series.displayName}`);
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
    seriesToScrape = [
      'morgan-dollar',
      'peace-dollar',
      'walking-liberty-half',
      'mercury-dime',
      'buffalo-nickel',
      'lincoln-wheat-cent',
    ];
  }

  console.log('CoinStudy Reference Image Scraper');
  console.log('==================================');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Series to scrape: ${seriesToScrape.join(', ')}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true, // CoinStudy works with headless
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  for (const seriesKey of seriesToScrape) {
    try {
      await scrapeSeries(page, seriesKey);
      await delay(2000); // Rate limiting
    } catch (error) {
      console.error(`Error scraping ${seriesKey}:`, error);
    }
  }

  // Update index
  const series = fs.readdirSync(OUTPUT_DIR)
    .filter(item => {
      const itemPath = path.join(OUTPUT_DIR, item);
      return fs.statSync(itemPath).isDirectory() &&
             fs.existsSync(path.join(itemPath, 'metadata.json'));
    })
    .map(dir => {
      const metadata = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, dir, 'metadata.json'), 'utf-8'));
      return {
        name: dir,
        displayName: metadata.displayName,
        gradeCount: metadata.grades?.length || 0,
        source: metadata.source,
      };
    });

  const index = {
    updatedAt: new Date().toISOString(),
    totalSeries: series.length,
    totalGrades: series.reduce((sum, s) => sum + s.gradeCount, 0),
    series,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  console.log('\n==================================');
  console.log('Scraping complete!');
  console.log(`Total series: ${index.totalSeries}`);
  console.log(`Total grades: ${index.totalGrades}`);

  await browser.close();
}

main().catch(console.error);

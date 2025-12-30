/**
 * eBay PCGS TrueView & NGC Photo Vision Scraper
 *
 * TrueView photos are standardized, high-quality photos taken by PCGS during grading.
 * They are the gold standard for coin photography and perfect training data.
 *
 * Usage:
 *   npx tsx scripts/scrape-ebay-trueview.ts [options]
 *
 * Options:
 *   --series <name>     Scrape specific series (default: morgan-dollar)
 *   --all               Scrape all priority series
 *   --grades <range>    Grade range like "MS60-MS67" or "AU50-MS65"
 *   --limit <n>         Max images per grade (default: 10)
 *   --dry-run           Show what would be scraped without downloading
 *
 * Examples:
 *   npx tsx scripts/scrape-ebay-trueview.ts --series morgan-dollar
 *   npx tsx scripts/scrape-ebay-trueview.ts --all --limit 20
 *   npx tsx scripts/scrape-ebay-trueview.ts --series peace-dollar --grades MS60-MS67
 */

import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

// Priority coin series with TrueView search patterns
// Search patterns go from most specific (TrueView) to broader (just PCGS/NGC graded)
const COIN_SERIES: Record<string, {
  name: string;
  displayName: string;
  searchPatterns: string[];
}> = {
  'morgan-dollar': {
    name: 'morgan-dollar',
    displayName: 'Morgan Dollar',
    searchPatterns: [
      'Morgan Dollar TrueView PCGS',
      'Morgan Dollar PCGS',
      'Morgan Dollar NGC',
    ],
  },
  'peace-dollar': {
    name: 'peace-dollar',
    displayName: 'Peace Dollar',
    searchPatterns: [
      'Peace Dollar TrueView PCGS',
      'Peace Dollar PCGS',
      'Peace Dollar NGC',
    ],
  },
  'walking-liberty-half': {
    name: 'walking-liberty-half',
    displayName: 'Walking Liberty Half Dollar',
    searchPatterns: [
      'Walking Liberty Half TrueView PCGS',
      'Walking Liberty Half PCGS',
      'Walking Liberty Half NGC',
    ],
  },
  'saint-gaudens-double-eagle': {
    name: 'saint-gaudens-double-eagle',
    displayName: 'Saint-Gaudens Double Eagle',
    searchPatterns: [
      'Saint Gaudens $20 TrueView PCGS',
      'Saint Gaudens $20 PCGS',
      'Saint Gaudens Double Eagle NGC',
    ],
  },
  'liberty-head-gold': {
    name: 'liberty-head-gold',
    displayName: 'Liberty Head Gold',
    searchPatterns: [
      'Liberty Head Gold TrueView PCGS',
      'Liberty Head Gold Eagle PCGS',
      'Liberty Head Gold NGC',
    ],
  },
  'indian-head-gold': {
    name: 'indian-head-gold',
    displayName: 'Indian Head Gold',
    searchPatterns: [
      'Indian Head Gold TrueView PCGS',
      'Indian Head Gold Eagle PCGS',
      'Indian Head Gold NGC',
    ],
  },
  'buffalo-nickel': {
    name: 'buffalo-nickel',
    displayName: 'Buffalo Nickel',
    searchPatterns: [
      'Buffalo Nickel TrueView PCGS',
      'Buffalo Nickel PCGS',
      'Buffalo Nickel NGC',
    ],
  },
  'mercury-dime': {
    name: 'mercury-dime',
    displayName: 'Mercury Dime',
    searchPatterns: [
      'Mercury Dime TrueView PCGS',
      'Mercury Dime PCGS',
      'Mercury Dime NGC',
    ],
  },
  'lincoln-wheat-cent': {
    name: 'lincoln-wheat-cent',
    displayName: 'Lincoln Wheat Cent',
    searchPatterns: [
      'Lincoln Wheat Cent TrueView PCGS',
      'Lincoln Wheat Cent PCGS',
      'Lincoln Wheat Cent NGC',
    ],
  },
  'indian-head-cent': {
    name: 'indian-head-cent',
    displayName: 'Indian Head Cent',
    searchPatterns: [
      'Indian Cent PCGS TrueView',
      'Indian Cent PCGS 1c',
      'Indian Head Penny PCGS',
    ],
  },
};

// Grade definitions for coin grading scale
const GRADES = [
  { grade: 'G-4', numericGrade: 4, searchTerms: ['G4', 'G 4', 'Good 4'] },
  { grade: 'VG-8', numericGrade: 8, searchTerms: ['VG8', 'VG 8', 'VG-8'] },
  { grade: 'F-12', numericGrade: 12, searchTerms: ['F12', 'F 12', 'F-12'] },
  { grade: 'VF-20', numericGrade: 20, searchTerms: ['VF20', 'VF 20', 'VF-20'] },
  { grade: 'VF-25', numericGrade: 25, searchTerms: ['VF25', 'VF 25', 'VF-25'] },
  { grade: 'VF-30', numericGrade: 30, searchTerms: ['VF30', 'VF 30', 'VF-30'] },
  { grade: 'VF-35', numericGrade: 35, searchTerms: ['VF35', 'VF 35', 'VF-35'] },
  { grade: 'EF-40', numericGrade: 40, searchTerms: ['EF40', 'EF 40', 'XF40', 'EF-40', 'XF-40'] },
  { grade: 'EF-45', numericGrade: 45, searchTerms: ['EF45', 'EF 45', 'XF45', 'EF-45', 'XF-45'] },
  { grade: 'AU-50', numericGrade: 50, searchTerms: ['AU50', 'AU 50', 'AU-50'] },
  { grade: 'AU-53', numericGrade: 53, searchTerms: ['AU53', 'AU 53', 'AU-53'] },
  { grade: 'AU-55', numericGrade: 55, searchTerms: ['AU55', 'AU 55', 'AU-55'] },
  { grade: 'AU-58', numericGrade: 58, searchTerms: ['AU58', 'AU 58', 'AU-58'] },
  { grade: 'MS-60', numericGrade: 60, searchTerms: ['MS60', 'MS 60', 'MS-60'] },
  { grade: 'MS-61', numericGrade: 61, searchTerms: ['MS61', 'MS 61', 'MS-61'] },
  { grade: 'MS-62', numericGrade: 62, searchTerms: ['MS62', 'MS 62', 'MS-62'] },
  { grade: 'MS-63', numericGrade: 63, searchTerms: ['MS63', 'MS 63', 'MS-63'] },
  { grade: 'MS-64', numericGrade: 64, searchTerms: ['MS64', 'MS 64', 'MS-64'] },
  { grade: 'MS-65', numericGrade: 65, searchTerms: ['MS65', 'MS 65', 'MS-65'] },
  { grade: 'MS-66', numericGrade: 66, searchTerms: ['MS66', 'MS 66', 'MS-66'] },
  { grade: 'MS-67', numericGrade: 67, searchTerms: ['MS67', 'MS 67', 'MS-67'] },
  { grade: 'MS-68', numericGrade: 68, searchTerms: ['MS68', 'MS 68', 'MS-68'] },
  { grade: 'MS-69', numericGrade: 69, searchTerms: ['MS69', 'MS 69', 'MS-69'] },
  { grade: 'MS-70', numericGrade: 70, searchTerms: ['MS70', 'MS 70', 'MS-70'] },
  // Proof grades
  { grade: 'PR-63', numericGrade: 63, searchTerms: ['PR63', 'PF63', 'PR 63', 'PF 63'] },
  { grade: 'PR-64', numericGrade: 64, searchTerms: ['PR64', 'PF64', 'PR 64', 'PF 64'] },
  { grade: 'PR-65', numericGrade: 65, searchTerms: ['PR65', 'PF65', 'PR 65', 'PF 65'] },
  { grade: 'PR-66', numericGrade: 66, searchTerms: ['PR66', 'PF66', 'PR 66', 'PF 66'] },
  { grade: 'PR-67', numericGrade: 67, searchTerms: ['PR67', 'PF67', 'PR 67', 'PF 67'] },
  { grade: 'PR-68', numericGrade: 68, searchTerms: ['PR68', 'PF68', 'PR 68', 'PF 68'] },
  { grade: 'PR-69', numericGrade: 69, searchTerms: ['PR69', 'PF69', 'PR 69', 'PF 69'] },
  { grade: 'PR-70', numericGrade: 70, searchTerms: ['PR70', 'PF70', 'PR 70', 'PF 70'] },
];

interface ScrapedImage {
  id: string;
  grade: string;
  numericGrade: number;
  series: string;
  source: 'ebay';
  sourceUrl: string;
  lotNumber: string;
  year?: string;
  mint?: string;
  certService?: 'PCGS' | 'NGC' | 'CAC';
  trueView: boolean;
  imagePath: string;
  downloadedAt: string;
}

interface SeriesMetadata {
  series: string;
  displayName: string;
  scrapedAt: string;
  source: string;
  sources: string[];
  grades: Array<{
    grade: string;
    numericGrade: number;
    obversePath: string | null;
    reversePath: string | null;
    obverseUrl: string | null;
    reverseUrl: string | null;
  }>;
  images: ScrapedImage[];
  gradeStats: Record<string, number>;
  updatedAt: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return crypto.randomBytes(6).toString('hex');
}

/**
 * Parse grade from listing title
 */
function parseGrade(title: string): { grade: string; numericGrade: number } | null {
  const normalizedTitle = title.toUpperCase();

  for (const gradeInfo of GRADES) {
    for (const searchTerm of gradeInfo.searchTerms) {
      // Check for exact match with word boundaries
      const regex = new RegExp(`\\b${searchTerm.replace(/-/g, '[-\\s]?')}\\b`, 'i');
      if (regex.test(normalizedTitle)) {
        return { grade: gradeInfo.grade.replace('-', ''), numericGrade: gradeInfo.numericGrade };
      }
    }
  }

  // Fallback: try to extract grade pattern directly
  const gradeMatch = normalizedTitle.match(/\b(MS|AU|EF|XF|VF|F|VG|G|PR|PF)\s?[-]?\s?(\d{1,2})\b/i);
  if (gradeMatch) {
    const prefix = gradeMatch[1].toUpperCase().replace('XF', 'EF').replace('PF', 'PR');
    const num = parseInt(gradeMatch[2], 10);
    if (num >= 1 && num <= 70) {
      return { grade: `${prefix}${num}`, numericGrade: num };
    }
  }

  return null;
}

/**
 * Parse year from listing title
 */
function parseYear(title: string): string | undefined {
  const yearMatch = title.match(/\b(1[89]\d{2}|20[012]\d)\b/);
  return yearMatch ? yearMatch[1] : undefined;
}

/**
 * Parse mint mark from listing title
 */
function parseMint(title: string): string | undefined {
  const mintPatterns = [
    { pattern: /\b(\d{4})\s*-?\s*CC\b/i, mint: 'CC' },
    { pattern: /\b(\d{4})\s*-?\s*S\b/i, mint: 'S' },
    { pattern: /\b(\d{4})\s*-?\s*O\b/i, mint: 'O' },
    { pattern: /\b(\d{4})\s*-?\s*D\b/i, mint: 'D' },
    { pattern: /\bCarson City\b/i, mint: 'CC' },
    { pattern: /\bSan Francisco\b/i, mint: 'S' },
    { pattern: /\bNew Orleans\b/i, mint: 'O' },
    { pattern: /\bDenver\b/i, mint: 'D' },
  ];

  for (const { pattern, mint } of mintPatterns) {
    if (pattern.test(title)) {
      return mint;
    }
  }

  return undefined;
}

/**
 * Parse certification service from title
 */
function parseCertService(title: string): 'PCGS' | 'NGC' | 'CAC' | undefined {
  const upper = title.toUpperCase();
  if (upper.includes('PCGS')) return 'PCGS';
  if (upper.includes('NGC')) return 'NGC';
  if (upper.includes('CAC')) return 'CAC';
  return undefined;
}

/**
 * Check if listing appears to have TrueView photos
 */
function isTrueView(title: string): boolean {
  const upper = title.toUpperCase();
  return (
    upper.includes('TRUEVIEW') ||
    upper.includes('TRUE VIEW') ||
    upper.includes('PHOTO VISION') ||
    upper.includes('PHOTOVISION')
  );
}

/**
 * Clean and upgrade eBay image URL to highest resolution
 */
function cleanImageUrl(url: string): string {
  return url
    .replace(/s-l\d+/, 's-l1600')
    .replace(/\/thumbs\//, '/images/')
    .split('?')[0];
}

/**
 * Download image from URL
 */
async function downloadImage(
  page: Page,
  url: string,
  outputPath: string
): Promise<boolean> {
  try {
    const response = await page.request.get(url, {
      headers: {
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.ebay.com/',
      },
    });

    if (!response.ok()) {
      console.error(`  Download failed: ${response.status()} for ${url}`);
      return false;
    }

    const buffer = await response.body();

    // Validate it's actually an image (check magic bytes)
    if (buffer.length < 100) {
      console.error(`  Downloaded file too small: ${buffer.length} bytes`);
      return false;
    }

    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.error(`  Error downloading:`, error);
    return false;
  }
}

interface EbayListing {
  title: string;
  url: string;
  imageUrl: string;
  itemId: string;
  price?: number;
}

/**
 * Search eBay and extract listings
 */
async function searchEbay(
  page: Page,
  searchQuery: string,
  grade: string
): Promise<EbayListing[]> {
  const fullQuery = `${searchQuery} ${grade}`;
  // Category 11116 = Coins & Paper Money
  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(fullQuery)}&_sacat=11116&LH_TitleDesc=1&_sop=16`;

  console.log(`  Searching: "${fullQuery}"`);

  try {
    // Check if page is still valid
    try {
      await page.evaluate(() => window.location.href);
    } catch {
      console.log(`    Page closed, skipping search`);
      return [];
    }

    await page.goto(searchUrl, { waitUntil: 'load', timeout: 45000 });
    await delay(4000); // Extra wait for dynamic content

    // Wait for either search results or "no results" message
    await Promise.race([
      page.waitForSelector('.s-item', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('.srp-save-null-search', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('[data-testid="srp-river-main"]', { timeout: 15000 }).catch(() => null),
    ]);

    const listings: EbayListing[] = [];

    // Try multiple selector patterns for robustness
    const itemSelectors = [
      '.srp-results .s-item',
      '.s-item',
      'li.s-item',
      '[data-viewport] .s-item',
    ];

    let items: any[] = [];
    for (const selector of itemSelectors) {
      items = await page.$$(selector);
      if (items.length > 1) break; // Found items (skip if only 1, usually the header)
    }

    if (items.length <= 1) {
      // Check if page loaded properly
      const pageContent = await page.content();
      if (
        pageContent.includes('captcha') ||
        pageContent.includes('robot') ||
        pageContent.includes('verify') ||
        pageContent.includes('security check')
      ) {
        console.log(`    CAPTCHA detected! Solve it in browser window...`);
        console.log(`    Waiting 45 seconds for manual solve...`);
        await delay(45000);

        // Reload the page and try again
        await page.reload({ waitUntil: 'load' });
        await delay(4000);

        // Try to get items again after CAPTCHA solve
        for (const selector of itemSelectors) {
          items = await page.$$(selector);
          if (items.length > 1) break;
        }
      }
    }

    for (const item of items) {
      try {
        // Try multiple selector patterns for title/link
        const titleEl = await item.$('.s-item__title') || await item.$('.lvtitle');
        const linkEl = await item.$('.s-item__link') || await item.$('a.s-item__link');
        const imgEl = await item.$('.s-item__image-img') || await item.$('img');

        if (!titleEl || !linkEl) continue;

        const title = await titleEl.textContent();
        const url = await linkEl.getAttribute('href');
        let imgSrc = await imgEl?.getAttribute('src');
        if (!imgSrc) {
          imgSrc = await imgEl?.getAttribute('data-src');
        }

        if (!title || !url) continue;
        if (title.toLowerCase().includes('shop on ebay')) continue;
        if (title.toLowerCase().includes('results matching fewer')) continue;

        // Extract item ID from URL
        const itemIdMatch = url.match(/\/itm\/(\d+)/);
        if (!itemIdMatch) continue;

        listings.push({
          title: title.trim(),
          url,
          imageUrl: imgSrc ? cleanImageUrl(imgSrc) : '',
          itemId: itemIdMatch[1],
        });
      } catch {
        // Skip items that fail to parse
      }
    }

    return listings;
  } catch (error) {
    console.error(`  Search error:`, error);
    return [];
  }
}

/**
 * Get high-res images from listing detail page
 */
async function getListingImages(page: Page, listingUrl: string): Promise<string[]> {
  try {
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(1500);

    const images: string[] = [];

    // Try multiple selectors for images
    const imageSelectors = [
      '#icImg',
      '.ux-image-carousel-item img',
      '[data-zoom-src]',
      '.ux-image-magnify img',
    ];

    for (const selector of imageSelectors) {
      const imgElements = await page.$$(selector);
      for (const img of imgElements) {
        let src = await img.getAttribute('src');
        if (!src) src = await img.getAttribute('data-zoom-src');
        if (!src) src = await img.getAttribute('data-src');

        if (src && src.includes('ebayimg.com') && !src.includes('s-l64')) {
          images.push(cleanImageUrl(src));
        }
      }
    }

    // Also check gallery thumbnails for additional images
    const thumbs = await page.$$('img[id^="icThumbs"]');
    for (const thumb of thumbs) {
      const src = await thumb.getAttribute('src');
      if (src) {
        images.push(cleanImageUrl(src));
      }
    }

    // Dedupe
    return [...new Set(images)];
  } catch (error) {
    console.error(`  Error getting listing images:`, error);
    return [];
  }
}

/**
 * Load existing metadata for a series
 */
function loadMetadata(seriesDir: string): SeriesMetadata | null {
  const metadataPath = path.join(seriesDir, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save metadata for a series
 */
function saveMetadata(seriesDir: string, metadata: SeriesMetadata): void {
  const metadataPath = path.join(seriesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Scrape TrueView images for a coin series
 */
async function scrapeSeries(
  page: Page,
  seriesKey: string,
  options: {
    grades: string[];
    limit: number;
    dryRun: boolean;
  }
): Promise<void> {
  const series = COIN_SERIES[seriesKey];
  if (!series) {
    console.error(`Unknown series: ${seriesKey}`);
    return;
  }

  const seriesDir = path.join(OUTPUT_DIR, series.name);
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping ${series.displayName} TrueView images`);
  console.log(`${'='.repeat(60)}`);

  // Load existing metadata
  let metadata = loadMetadata(seriesDir);
  if (!metadata) {
    metadata = {
      series: series.name,
      displayName: series.displayName,
      scrapedAt: new Date().toISOString(),
      source: 'ebay',
      sources: ['ebay'],
      grades: [],
      images: [],
      gradeStats: {},
      updatedAt: new Date().toISOString(),
    };
  }

  // Track existing image IDs to avoid duplicates
  const existingIds = new Set(metadata.images.map((img) => img.lotNumber));

  for (const gradeStr of options.grades) {
    const gradeInfo = GRADES.find(
      (g) => g.grade.replace('-', '') === gradeStr || g.grade === gradeStr
    );
    if (!gradeInfo) {
      console.log(`  Skipping unknown grade: ${gradeStr}`);
      continue;
    }

    const normalizedGrade = gradeInfo.grade.replace('-', '');
    const currentCount = metadata.gradeStats[normalizedGrade] || 0;

    if (currentCount >= options.limit) {
      console.log(`  ${normalizedGrade}: Already have ${currentCount} images (limit: ${options.limit})`);
      continue;
    }

    const needed = options.limit - currentCount;
    console.log(`\n  ${normalizedGrade}: Need ${needed} more images (have ${currentCount})`);

    let downloaded = 0;

    for (const searchPattern of series.searchPatterns) {
      if (downloaded >= needed) break;

      const listings = await searchEbay(page, searchPattern, normalizedGrade);
      console.log(`    Found ${listings.length} listings for "${searchPattern} ${normalizedGrade}"`);

      for (const listing of listings) {
        if (downloaded >= needed) break;
        if (existingIds.has(listing.itemId)) {
          continue; // Skip duplicates
        }

        // Parse grade from title to verify
        const parsedGrade = parseGrade(listing.title);
        if (!parsedGrade || parsedGrade.numericGrade !== gradeInfo.numericGrade) {
          continue; // Grade doesn't match
        }

        // Check if it's a TrueView listing (preferable)
        const hasTrueView = isTrueView(listing.title);

        if (options.dryRun) {
          console.log(`    [DRY RUN] Would download: ${listing.title.substring(0, 60)}...`);
          downloaded++;
          continue;
        }

        // Get high-res images from listing page
        const images = await getListingImages(page, listing.url);
        if (images.length === 0) {
          console.log(`    No images found for listing ${listing.itemId}`);
          continue;
        }

        // Download first (main) image
        const imageUrl = images[0];
        const imageId = generateId();
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `${dateStr}-${normalizedGrade}-ebay-${imageId}.jpg`;
        const outputPath = path.join(seriesDir, fileName);

        const success = await downloadImage(page, imageUrl, outputPath);
        if (success) {
          const imageRecord: ScrapedImage = {
            id: imageId,
            grade: normalizedGrade,
            numericGrade: gradeInfo.numericGrade,
            series: series.name,
            source: 'ebay',
            sourceUrl: listing.url,
            lotNumber: listing.itemId,
            year: parseYear(listing.title),
            mint: parseMint(listing.title),
            certService: parseCertService(listing.title),
            trueView: hasTrueView,
            imagePath: fileName,
            downloadedAt: new Date().toISOString(),
          };

          // Remove undefined fields
          Object.keys(imageRecord).forEach(key => {
            if ((imageRecord as any)[key] === undefined) {
              delete (imageRecord as any)[key];
            }
          });

          metadata.images.push(imageRecord);
          metadata.gradeStats[normalizedGrade] = (metadata.gradeStats[normalizedGrade] || 0) + 1;
          existingIds.add(listing.itemId);
          downloaded++;

          console.log(`    Downloaded: ${normalizedGrade} ${hasTrueView ? '[TrueView]' : ''} - ${listing.title.substring(0, 50)}...`);
        }

        await delay(1500); // Rate limiting between downloads
      }

      await delay(2000); // Rate limiting between searches
    }

    console.log(`    ${normalizedGrade}: Downloaded ${downloaded} new images`);
  }

  // Update and save metadata
  metadata.updatedAt = new Date().toISOString();
  if (!metadata.sources.includes('ebay')) {
    metadata.sources.push('ebay');
  }

  saveMetadata(seriesDir, metadata);

  // Print summary
  console.log(`\n  Summary for ${series.displayName}:`);
  console.log(`  Total images: ${metadata.images.length}`);
  console.log(`  Grade distribution:`);
  for (const [grade, count] of Object.entries(metadata.gradeStats).sort(
    (a, b) => parseInt(a[0].replace(/\D/g, '')) - parseInt(b[0].replace(/\D/g, ''))
  )) {
    console.log(`    ${grade}: ${count}`);
  }
}

/**
 * Parse grade range like "MS60-MS67" into array
 */
function parseGradeRange(range: string): string[] {
  if (!range.includes('-')) {
    return [range.toUpperCase()];
  }

  const [start, end] = range.split('-');
  const startMatch = start.match(/([A-Z]+)(\d+)/i);
  const endMatch = end.match(/([A-Z]+)(\d+)/i);

  if (!startMatch || !endMatch) {
    return [range.toUpperCase()];
  }

  const prefix = startMatch[1].toUpperCase();
  const startNum = parseInt(startMatch[2], 10);
  const endNum = parseInt(endMatch[2], 10);

  const grades: string[] = [];
  for (const gradeInfo of GRADES) {
    if (
      gradeInfo.grade.startsWith(prefix) &&
      gradeInfo.numericGrade >= startNum &&
      gradeInfo.numericGrade <= endNum
    ) {
      grades.push(gradeInfo.grade.replace('-', ''));
    }
  }

  return grades;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const seriesIndex = args.indexOf('--series');
  const allFlag = args.includes('--all');
  const gradesIndex = args.indexOf('--grades');
  const limitIndex = args.indexOf('--limit');
  const dryRun = args.includes('--dry-run');
  const skipLogin = args.includes('--skip-login');

  let seriesToScrape: string[] = [];
  if (allFlag) {
    // Priority order for scraping
    seriesToScrape = [
      'morgan-dollar',
      'peace-dollar',
      'walking-liberty-half',
      'saint-gaudens-double-eagle',
      'liberty-head-gold',
      'indian-head-gold',
      'buffalo-nickel',
      'mercury-dime',
      'lincoln-wheat-cent',
    ];
  } else if (seriesIndex !== -1 && args[seriesIndex + 1]) {
    seriesToScrape = [args[seriesIndex + 1]];
  } else {
    seriesToScrape = ['morgan-dollar'];
  }

  // Default to MS60-MS67 for TrueView (most common grades for high-quality photos)
  let grades: string[] = ['MS60', 'MS61', 'MS62', 'MS63', 'MS64', 'MS65', 'MS66', 'MS67'];
  if (gradesIndex !== -1 && args[gradesIndex + 1]) {
    grades = parseGradeRange(args[gradesIndex + 1]);
  }

  const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1], 10) : 10;

  console.log('eBay PCGS TrueView & NGC Photo Vision Scraper');
  console.log('='.repeat(50));
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Series to scrape: ${seriesToScrape.join(', ')}`);
  console.log(`Grades: ${grades.join(', ')}`);
  console.log(`Limit per grade: ${limit}`);
  console.log(`Dry run: ${dryRun}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100, // Slow down actions so you can see them
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--start-maximized',
    ],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Remove automation detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  const page = await context.newPage();

  // Interactive login step - navigate to eBay and wait for user to solve any CAPTCHAs
  if (!skipLogin && !dryRun) {
    console.log('\n>>> Opening eBay - solve any CAPTCHAs in the browser window <<<');
    console.log('>>> Auto-continuing in 45 seconds (or press Enter to continue now) <<<\n');

    await page.goto('https://www.ebay.com/sch/i.html?_nkw=PCGS+coin&_sacat=11116', {
      waitUntil: 'load',
      timeout: 60000,
    });

    // Bring window to front
    await page.bringToFront();

    // Wait for user to press Enter or auto-continue after 45s
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Auto-continuing...');
        resolve();
      }, 45000);

      // Try to read stdin if available
      if (process.stdin.isTTY) {
        process.stdin.once('data', () => {
          clearTimeout(timeout);
          resolve();
        });
      }
    });

    console.log('Continuing with scrape...\n');
  }

  try {
    for (const seriesKey of seriesToScrape) {
      await scrapeSeries(page, seriesKey, { grades, limit, dryRun });
      await delay(3000); // Pause between series
    }

    console.log('\n' + '='.repeat(50));
    console.log('Scraping complete!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

#!/usr/bin/env npx tsx
/**
 * Grading Reference Photo Collection Builder
 *
 * Builds a reference photo collection from PUBLIC auction archives:
 * - Heritage Auctions (coins.ha.com) - Public sold archive
 * - eBay Sold Listings - Public sold listings
 *
 * Usage:
 *   npx tsx scripts/build-grading-reference.ts --series morgan-dollar --grades MS60-MS67
 *   npx tsx scripts/build-grading-reference.ts --all --min-per-grade 10
 *   npx tsx scripts/build-grading-reference.ts --source heritage --series peace-dollar
 *   npx tsx scripts/build-grading-reference.ts --source ebay --series walking-liberty-half
 */

import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

const COIN_SERIES: Record<string, {
  name: string;
  displayName: string;
  heritageSearch: string;
  ebaySearch: string;
}> = {
  'morgan-dollar': {
    name: 'morgan-dollar',
    displayName: 'Morgan Dollar',
    heritageSearch: 'Morgan Dollar',
    ebaySearch: 'morgan dollar',
  },
  'peace-dollar': {
    name: 'peace-dollar',
    displayName: 'Peace Dollar',
    heritageSearch: 'Peace Dollar',
    ebaySearch: 'peace dollar',
  },
  'walking-liberty-half': {
    name: 'walking-liberty-half',
    displayName: 'Walking Liberty Half Dollar',
    heritageSearch: 'Walking Liberty Half',
    ebaySearch: 'walking liberty half dollar',
  },
};

// Target mint state grades (MS60-MS67)
const MINT_STATE_GRADES = [
  { grade: 'MS60', numericGrade: 60 },
  { grade: 'MS61', numericGrade: 61 },
  { grade: 'MS62', numericGrade: 62 },
  { grade: 'MS63', numericGrade: 63 },
  { grade: 'MS64', numericGrade: 64 },
  { grade: 'MS65', numericGrade: 65 },
  { grade: 'MS66', numericGrade: 66 },
  { grade: 'MS67', numericGrade: 67 },
];

// Extended grades for full coverage
const ALL_GRADES = [
  { grade: 'G4', numericGrade: 4 },
  { grade: 'VG8', numericGrade: 8 },
  { grade: 'F12', numericGrade: 12 },
  { grade: 'VF20', numericGrade: 20 },
  { grade: 'VF25', numericGrade: 25 },
  { grade: 'VF30', numericGrade: 30 },
  { grade: 'VF35', numericGrade: 35 },
  { grade: 'EF40', numericGrade: 40 },
  { grade: 'EF45', numericGrade: 45 },
  { grade: 'AU50', numericGrade: 50 },
  { grade: 'AU53', numericGrade: 53 },
  { grade: 'AU55', numericGrade: 55 },
  { grade: 'AU58', numericGrade: 58 },
  ...MINT_STATE_GRADES,
];

interface ReferenceImage {
  id: string;
  grade: string;
  numericGrade: number;
  series: string;
  source: 'heritage' | 'ebay';
  sourceUrl: string;
  lotNumber?: string;
  year?: string;
  mint?: string;
  certNumber?: string;
  certService?: 'PCGS' | 'NGC' | 'CAC' | 'ANACS';
  imagePath: string;
  downloadedAt: string;
}

interface SeriesMetadata {
  series: string;
  displayName: string;
  updatedAt: string;
  sources: string[];
  images: ReferenceImage[];
  gradeStats: Record<string, number>;
}

// ============================================================================
// Utilities
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateId(): string {
  return crypto.randomBytes(6).toString('hex');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function parseGradeFromTitle(title: string): { grade: string; numericGrade: number; certService?: string } | null {
  // Normalize the title - remove extra spaces, handle various formats
  const normalizedTitle = title.toUpperCase();

  // Match patterns like "PCGS MS65", "NGC AU 58", "MS-65", "MS 65", etc.
  const patterns = [
    // With cert service: "PCGS MS65", "NGC MS 65", "PCGS MS-65"
    /\b(PCGS|NGC|CAC|ANACS)\s+(MS|AU|EF|XF|VF|F|VG|G|PR|PF)[-\s]*(\d+)/i,
    // Without cert service: "MS65", "MS 65", "MS-65"
    /\b(MS|AU|EF|XF|VF|F|VG|G|PR|PF)[-\s]*(\d+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedTitle.match(pattern);
    if (match) {
      if (match.length === 4) {
        // Pattern with cert service
        const certService = match[1].toUpperCase();
        const gradePrefix = match[2].toUpperCase();
        const gradeNum = parseInt(match[3], 10);
        return {
          grade: `${gradePrefix}${gradeNum}`,
          numericGrade: gradeNum,
          certService: certService as 'PCGS' | 'NGC' | 'CAC' | 'ANACS',
        };
      } else if (match.length === 3) {
        // Pattern without cert service
        const gradePrefix = match[1].toUpperCase();
        const gradeNum = parseInt(match[2], 10);
        return {
          grade: `${gradePrefix}${gradeNum}`,
          numericGrade: gradeNum,
        };
      }
    }
  }
  return null;
}

function parseYearFromTitle(title: string): { year: string; mint?: string } | null {
  // Match patterns like "1881-S", "1921 D", "1889", etc.
  const match = title.match(/\b(18[7-9]\d|19[0-2]\d)[-\s]?([SDOCC](?:C)?)?/i);
  if (match) {
    return {
      year: match[1],
      mint: match[2]?.toUpperCase(),
    };
  }
  return null;
}

// ============================================================================
// Heritage Auctions Scraper
// ============================================================================

async function scrapeHeritageAuctions(
  page: Page,
  series: typeof COIN_SERIES[string],
  grades: typeof MINT_STATE_GRADES,
  minPerGrade: number
): Promise<ReferenceImage[]> {
  const images: ReferenceImage[] = [];

  console.log(`\n Heritage Auctions for ${series.displayName}...`);

  for (const gradeInfo of grades) {
    console.log(`\n  Searching for ${gradeInfo.grade}...`);

    const searchTerms = [
      `${series.heritageSearch} PCGS ${gradeInfo.grade}`,
      `${series.heritageSearch} NGC ${gradeInfo.grade}`,
    ];

    let foundForGrade = 0;

    for (const searchTerm of searchTerms) {
      if (foundForGrade >= minPerGrade) break;

      // Heritage search URL for sold coins - updated URL format
      const searchUrl = `https://coins.ha.com/c/search-results.zx?N=790+231&Ntt=${encodeURIComponent(searchTerm)}&ic4=SoldArchive-Header-211206`;

      try {
        console.log(`    Searching: "${searchTerm}"`);
        await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45000 });
        await delay(3000);

        // Debug: log page title and check if we landed on the right page
        const pageTitle = await page.title();
        console.log(`    Page title: ${pageTitle}`);

        // Heritage uses various selectors - try multiple approaches
        // Look for lot containers with images
        const lotSelectors = [
          '.lot-container',
          '.search-item',
          '.lotBlock',
          '[class*="lot"]',
          '.gallery-item',
          'article',
          '.product-item',
          'li[class*="item"]',
        ];

        let lotItems: any[] = [];
        for (const selector of lotSelectors) {
          lotItems = await page.$$(selector);
          if (lotItems.length > 0) {
            console.log(`    Found ${lotItems.length} items with selector: ${selector}`);
            break;
          }
        }

        // If no containers found, try getting all images with links
        if (lotItems.length === 0) {
          console.log(`    No containers found, trying direct image extraction...`);

          // Get all links with images that look like coin listings
          const allImages = await page.$$eval('a img', (imgs) => {
            return imgs.map(img => {
              const link = img.closest('a');
              return {
                src: img.getAttribute('src') || img.getAttribute('data-src'),
                href: link?.getAttribute('href'),
                alt: img.getAttribute('alt'),
              };
            }).filter(item => item.src && item.href);
          });

          console.log(`    Found ${allImages.length} linked images`);

          for (const imgData of allImages.slice(0, 30)) {
            if (foundForGrade >= minPerGrade) break;
            if (!imgData.src || !imgData.href) continue;

            // Skip non-coin images
            if (imgData.src.includes('logo') || imgData.src.includes('icon')) continue;

            // Check if the alt text or link contains the grade we want
            const textToCheck = `${imgData.alt || ''} ${imgData.href || ''}`;
            const parsedGrade = parseGradeFromTitle(textToCheck);

            // Get larger image URL
            let largeImgUrl = imgData.src
              .replace(/\/s\//, '/l/')
              .replace(/_s\./, '_l.')
              .replace(/\/t\//, '/l/')
              .replace(/_t\./, '_l.')
              .replace(/\?.*$/, '');

            const fullImgUrl = largeImgUrl.startsWith('http')
              ? largeImgUrl
              : `https://coins.ha.com${largeImgUrl}`;

            const lotUrl = imgData.href?.startsWith('http')
              ? imgData.href
              : `https://coins.ha.com${imgData.href}`;

            // Extract lot number if available
            const lotMatch = lotUrl.match(/lot\/(\d+)/) || lotUrl.match(/a\/(\d+)/);
            const lotNumber = lotMatch ? lotMatch[1] : undefined;

            // Parse year info
            const yearInfo = parseYearFromTitle(textToCheck);

            // Generate filename: {date}-{grade}-{source}.jpg
            const dateStr = new Date().toISOString().split('T')[0];
            const id = generateId();
            const filename = `${dateStr}-${gradeInfo.grade}-heritage-${id}.jpg`;
            const outputPath = path.join(OUTPUT_DIR, series.name, filename);

            // Download image
            const downloaded = await downloadImage(page, fullImgUrl, outputPath);

            if (downloaded) {
              foundForGrade++;
              images.push({
                id,
                grade: gradeInfo.grade,
                numericGrade: gradeInfo.numericGrade,
                series: series.name,
                source: 'heritage',
                sourceUrl: lotUrl,
                lotNumber,
                year: yearInfo?.year,
                mint: yearInfo?.mint,
                certService: parsedGrade?.certService as ReferenceImage['certService'],
                imagePath: filename,
                downloadedAt: new Date().toISOString(),
              });
              console.log(`    Downloaded: ${filename} (${foundForGrade}/${minPerGrade})`);
            }

            await delay(300);
          }
        }

        for (const lotItem of lotItems.slice(0, Math.min(20, minPerGrade - foundForGrade + 5))) {
          if (foundForGrade >= minPerGrade) break;

          try {
            // Get lot link and image - try multiple selectors
            const lotImage = await lotItem.$('img');
            if (!lotImage) continue;

            const imgSrc = await lotImage.getAttribute('src') || await lotImage.getAttribute('data-src');

            // Get title and link
            const lotLink = await lotItem.$('a[href*="/itm/"], a[href*="/lot/"], a[href*="/a/"]');
            const lotHref = lotLink ? await lotLink.getAttribute('href') : null;

            const titleEl = await lotItem.$('.lot-title, .item-title, h3, h4, [class*="title"], a');
            const title = titleEl ? await titleEl.textContent() : '';

            if (!imgSrc) continue;

            // Parse grade from title to verify it matches
            const parsedGrade = parseGradeFromTitle(title || '');

            // Parse year info
            const yearInfo = parseYearFromTitle(title || '');

            // Get larger image URL
            let largeImgUrl = imgSrc
              .replace(/\/s\//, '/l/')
              .replace(/_s\./, '_l.')
              .replace(/\/t\//, '/l/')
              .replace(/_t\./, '_l.')
              .replace(/\?.*$/, '');

            const fullImgUrl = largeImgUrl.startsWith('http')
              ? largeImgUrl
              : `https://coins.ha.com${largeImgUrl}`;

            const lotUrl = lotHref
              ? (lotHref.startsWith('http') ? lotHref : `https://coins.ha.com${lotHref}`)
              : searchUrl;

            // Extract lot number if available
            const lotMatch = lotUrl.match(/lot\/(\d+)/) || lotUrl.match(/a\/(\d+)/);
            const lotNumber = lotMatch ? lotMatch[1] : undefined;

            // Generate filename: {date}-{grade}-{source}.jpg
            const dateStr = new Date().toISOString().split('T')[0];
            const id = generateId();
            const filename = `${dateStr}-${gradeInfo.grade}-heritage-${id}.jpg`;
            const outputPath = path.join(OUTPUT_DIR, series.name, filename);

            // Download image
            const downloaded = await downloadImage(page, fullImgUrl, outputPath);

            if (downloaded) {
              foundForGrade++;
              images.push({
                id,
                grade: gradeInfo.grade,
                numericGrade: gradeInfo.numericGrade,
                series: series.name,
                source: 'heritage',
                sourceUrl: lotUrl,
                lotNumber,
                year: yearInfo?.year,
                mint: yearInfo?.mint,
                certService: parsedGrade?.certService as ReferenceImage['certService'],
                imagePath: filename,
                downloadedAt: new Date().toISOString(),
              });
              console.log(`    Downloaded: ${filename} (${foundForGrade}/${minPerGrade})`);
            }

            await delay(300); // Rate limiting between items
          } catch (err) {
            // Continue to next item
          }
        }

        await delay(1500); // Rate limiting between searches
      } catch (err) {
        console.error(`    Search error:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`    Total for ${gradeInfo.grade}: ${foundForGrade} images`);
  }

  return images;
}

// ============================================================================
// eBay Sold Listings Scraper
// ============================================================================

async function scrapeEbaySoldListings(
  page: Page,
  series: typeof COIN_SERIES[string],
  grades: typeof MINT_STATE_GRADES,
  minPerGrade: number
): Promise<ReferenceImage[]> {
  const images: ReferenceImage[] = [];

  console.log(`\n eBay Sold Listings for ${series.displayName}...`);

  for (const gradeInfo of grades) {
    console.log(`\n  Searching for ${gradeInfo.grade}...`);

    const searchTerms = [
      `${series.ebaySearch} PCGS ${gradeInfo.grade}`,
      `${series.ebaySearch} NGC ${gradeInfo.grade}`,
    ];

    let foundForGrade = 0;

    for (const searchTerm of searchTerms) {
      if (foundForGrade >= minPerGrade) break;

      // eBay sold listings search
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}&LH_Complete=1&LH_Sold=1&_ipg=60`;

      try {
        console.log(`    Searching: "${searchTerm}"`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for items to load and scroll to trigger lazy loading
        await delay(2000);
        await page.evaluate(() => window.scrollTo(0, 1000));
        await delay(1500);

        // Wait for content to load
        try {
          await page.waitForSelector('.s-item, .srp-results', { timeout: 10000 });
        } catch {
          console.log(`    No items loaded, checking page...`);
        }

        // Debug: save screenshot and HTML for first search
        if (gradeInfo.grade === 'MS60' && searchTerm.includes('PCGS')) {
          const html = await page.content();
          fs.writeFileSync('/tmp/ebay-debug.html', html);
          console.log(`    [Debug] Saved HTML to /tmp/ebay-debug.html`);
        }

        // Extract all listings directly from the DOM - try multiple selectors
        const allListings = await page.evaluate(() => {
          const results: Array<{
            src: string | null;
            href: string | null;
            title: string | null;
          }> = [];

          // Try multiple selector strategies
          const selectors = [
            '.s-item',
            '[data-component-type="s-search-results"] li',
            '.srp-results li',
            'ul.srp-results li',
            '[class*="s-item"]',
          ];

          let items: NodeListOf<Element> | null = null;
          for (const sel of selectors) {
            items = document.querySelectorAll(sel);
            if (items.length > 0) break;
          }

          if (!items) return results;

          items.forEach((item) => {
            // Try multiple image selectors
            let img = item.querySelector('img') as HTMLImageElement;
            if (!img) img = item.querySelector('[class*="image"] img') as HTMLImageElement;

            // Try multiple link selectors
            let link = item.querySelector('a[href*="/itm/"]') as HTMLAnchorElement;
            if (!link) link = item.querySelector('a') as HTMLAnchorElement;

            // Try multiple title selectors
            let titleEl = item.querySelector('.s-item__title');
            if (!titleEl) titleEl = item.querySelector('[class*="title"]');
            if (!titleEl) titleEl = item.querySelector('h3');

            if (img && titleEl) {
              const src = img.src || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0];
              results.push({
                src: src || null,
                href: link?.href || null,
                title: titleEl.textContent?.trim() || null,
              });
            }
          });

          return results;
        });

        console.log(`    Found ${allListings.length} listings`);

        // Show first few for debug
        for (let i = 0; i < Math.min(3, allListings.length); i++) {
          const listing = allListings[i];
          console.log(`    [Sample ${i + 1}] Title: ${listing.title?.substring(0, 50)}...`);
        }

        for (const listing of allListings) {
          if (foundForGrade >= minPerGrade) break;
          if (!listing.src || !listing.title) continue;

          // Skip placeholder images
          if (listing.src.includes('s-l64') || listing.src.includes('.gif') || listing.src.includes('ebaystatic.com/rs')) continue;

          // Parse grade from title
          const parsedGrade = parseGradeFromTitle(listing.title);
          if (!parsedGrade || parsedGrade.grade !== gradeInfo.grade) continue;

          // Parse year info
          const yearInfo = parseYearFromTitle(listing.title);

          // Get larger image URL - eBay uses s-l140, s-l225, s-l300, s-l500, s-l1600
          let largeImgUrl = listing.src
            .replace(/s-l\d+\./, 's-l500.')
            .replace(/\/thumbs\//, '/images/');

          // If URL doesn't have size indicator, try adding it
          if (!largeImgUrl.includes('s-l')) {
            largeImgUrl = largeImgUrl.replace(/\.jpg/i, '~s-l500.jpg');
          }

          // Generate filename
          const dateStr = new Date().toISOString().split('T')[0];
          const id = generateId();
          const filename = `${dateStr}-${gradeInfo.grade}-ebay-${id}.jpg`;
          const outputPath = path.join(OUTPUT_DIR, series.name, filename);

          // Download image
          const downloaded = await downloadImage(page, largeImgUrl, outputPath);

          if (downloaded) {
            foundForGrade++;

            // Extract eBay item ID from URL
            const itemIdMatch = listing.href?.match(/\/itm\/(\d+)/);
            const itemId = itemIdMatch ? itemIdMatch[1] : undefined;

            images.push({
              id,
              grade: gradeInfo.grade,
              numericGrade: gradeInfo.numericGrade,
              series: series.name,
              source: 'ebay',
              sourceUrl: listing.href || searchUrl,
              lotNumber: itemId,
              year: yearInfo?.year,
              mint: yearInfo?.mint,
              certService: parsedGrade.certService as ReferenceImage['certService'],
              imagePath: filename,
              downloadedAt: new Date().toISOString(),
            });
            console.log(`    Downloaded: ${filename} (${foundForGrade}/${minPerGrade})`);
          }

          await delay(200);
        }

        await delay(1000); // Rate limiting between searches
      } catch (err) {
        console.error(`    Search error:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`    Total for ${gradeInfo.grade}: ${foundForGrade} images`);
  }

  return images;
}

// ============================================================================
// Image Download
// ============================================================================

async function downloadImage(page: Page, url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await page.request.get(url, {
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    if (!response.ok()) {
      return false;
    }

    const buffer = await response.body();

    // Verify it's actually an image (check magic bytes)
    if (buffer.length < 100) return false;

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Metadata Management
// ============================================================================

function loadSeriesMetadata(seriesName: string): SeriesMetadata | null {
  const metadataPath = path.join(OUTPUT_DIR, seriesName, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    try {
      const data = fs.readFileSync(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

function saveSeriesMetadata(metadata: SeriesMetadata): void {
  const metadataPath = path.join(OUTPUT_DIR, metadata.series, 'metadata.json');

  // Ensure directory exists
  const dir = path.dirname(metadataPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Calculate grade stats
  metadata.gradeStats = {};
  for (const img of metadata.images) {
    metadata.gradeStats[img.grade] = (metadata.gradeStats[img.grade] || 0) + 1;
  }

  // Update timestamp
  metadata.updatedAt = new Date().toISOString();

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

function updateMasterIndex(): void {
  const seriesDirs = fs.readdirSync(OUTPUT_DIR).filter(d => {
    const stat = fs.statSync(path.join(OUTPUT_DIR, d));
    return stat.isDirectory();
  });

  const seriesList: Array<{ name: string; displayName: string; gradeCount: number; imageCount: number }> = [];

  for (const seriesDir of seriesDirs) {
    const metadataPath = path.join(OUTPUT_DIR, seriesDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        seriesList.push({
          name: data.series || seriesDir,
          displayName: data.displayName || seriesDir,
          gradeCount: Object.keys(data.gradeStats || {}).length,
          imageCount: data.images?.length || 0,
        });
      } catch {
        // Skip invalid metadata
      }
    }
  }

  const index = {
    updatedAt: new Date().toISOString(),
    sources: ['heritage', 'ebay'],
    totalSeries: seriesList.length,
    totalImages: seriesList.reduce((sum, s) => sum + s.imageCount, 0),
    series: seriesList,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const seriesArg = args.includes('--series') ? args[args.indexOf('--series') + 1] : null;
  const sourceArg = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
  const minPerGradeArg = args.includes('--min-per-grade') ? parseInt(args[args.indexOf('--min-per-grade') + 1], 10) : 10;
  const allSeries = args.includes('--all');
  const msOnly = args.includes('--ms-only') || (!args.includes('--all-grades'));

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      Grading Reference Photo Collection Builder                ║');
  console.log('║      Sources: Heritage Auctions (Public), eBay Sold Listings   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Min images per grade: ${minPerGradeArg}`);
  console.log(`Grade range: ${msOnly ? 'MS60-MS67' : 'G4-MS67'}`);

  // Determine which series to scrape
  let seriesToScrape: string[] = [];
  if (allSeries) {
    seriesToScrape = Object.keys(COIN_SERIES);
  } else if (seriesArg && COIN_SERIES[seriesArg]) {
    seriesToScrape = [seriesArg];
  } else {
    // Default: Morgan, Peace, Walking Liberty
    seriesToScrape = ['morgan-dollar', 'peace-dollar', 'walking-liberty-half'];
  }

  // Determine which sources to use
  let sources: Array<'heritage' | 'ebay'> = [];
  if (sourceArg === 'heritage') {
    sources = ['heritage'];
  } else if (sourceArg === 'ebay') {
    sources = ['ebay'];
  } else {
    sources = ['heritage', 'ebay'];
  }

  // Determine grades
  const grades = msOnly ? MINT_STATE_GRADES : ALL_GRADES;

  console.log(`Series to scrape: ${seriesToScrape.join(', ')}`);
  console.log(`Sources: ${sources.join(', ')}`);
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: true, // Run headless for automation
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    for (const seriesKey of seriesToScrape) {
      const series = COIN_SERIES[seriesKey];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📀 Processing: ${series.displayName}`);
      console.log(`${'='.repeat(60)}`);

      // Load or create metadata
      let metadata = loadSeriesMetadata(series.name);
      if (!metadata) {
        metadata = {
          series: series.name,
          displayName: series.displayName,
          updatedAt: new Date().toISOString(),
          sources: [],
          images: [],
          gradeStats: {},
        };
      }

      // Scrape from each source
      const newImages: ReferenceImage[] = [];

      // Ensure arrays exist
      if (!metadata.sources) {
        metadata.sources = [];
      }
      if (!metadata.images) {
        metadata.images = [];
      }

      if (sources.includes('heritage')) {
        const heritageImages = await scrapeHeritageAuctions(page, series, grades, Math.ceil(minPerGradeArg / 2));
        newImages.push(...heritageImages);
        if (!metadata.sources.includes('heritage')) {
          metadata.sources.push('heritage');
        }
      }

      if (sources.includes('ebay')) {
        const ebayImages = await scrapeEbaySoldListings(page, series, grades, Math.ceil(minPerGradeArg / 2));
        newImages.push(...ebayImages);
        if (!metadata.sources.includes('ebay')) {
          metadata.sources.push('ebay');
        }
      }

      // Merge with existing images (avoid duplicates by sourceUrl)
      const existingUrls = new Set(metadata.images.map(img => img.sourceUrl));
      for (const img of newImages) {
        if (!existingUrls.has(img.sourceUrl)) {
          metadata.images.push(img);
          existingUrls.add(img.sourceUrl);
        }
      }

      // Save metadata
      saveSeriesMetadata(metadata);

      // Print summary
      console.log(`\n📊 Summary for ${series.displayName}:`);
      console.log(`   Total images: ${metadata.images.length}`);
      for (const [grade, count] of Object.entries(metadata.gradeStats)) {
        console.log(`   ${grade}: ${count} images`);
      }

      await delay(2000); // Between series
    }
  } finally {
    await browser.close();
  }

  // Update master index
  updateMasterIndex();

  console.log('\n✅ Grading reference collection complete!');
  console.log(`📁 Output: ${OUTPUT_DIR}`);
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

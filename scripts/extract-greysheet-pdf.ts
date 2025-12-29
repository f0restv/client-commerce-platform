#!/usr/bin/env npx tsx
/**
 * Greysheet PDF Extractor
 *
 * Uses Playwright with saved browser session to:
 * 1. Navigate to the PDF viewer
 * 2. Extract text content from each page
 * 3. Parse pricing tables
 * 4. Save to data/greysheet-prices.json
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BROWSER_DATA_PATH = path.join(process.cwd(), 'data', 'greysheet-browser-data');
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'greysheet-prices.json');
const PDF_URL = 'https://www.greysheet.com/pdfdl/gymo202601';

interface PriceEntry {
  year: string;
  mintmark: string;
  variety: string;
  grades: Record<string, number>;
}

interface CoinSeries {
  name: string;
  type: 'MS' | 'PF' | 'AU' | 'XF' | 'VF' | 'F' | 'G';
  prices: PriceEntry[];
}

interface GreysheetPdfData {
  source: string;
  pdfName: string;
  extractedAt: string;
  pageCount: number;
  series: CoinSeries[];
  rawText: string[];
}

async function extractPdfText(): Promise<GreysheetPdfData> {
  console.log('Starting Greysheet PDF extraction...');
  console.log('Browser data path:', BROWSER_DATA_PATH);

  // Check if browser data exists
  if (!fs.existsSync(BROWSER_DATA_PATH)) {
    throw new Error(
      'No saved browser session found. Please run the login first:\n' +
      '  npx tsx src/lib/services/market-data/providers/greysheet.ts login'
    );
  }

  let context: BrowserContext | null = null;

  try {
    // Use persistent context to reuse login session
    console.log('Launching browser with saved session...');
    context = await chromium.launchPersistentContext(BROWSER_DATA_PATH, {
      headless: false, // Show browser to see what's happening
      viewport: { width: 1920, height: 1080 },
      timeout: 60000,
    });

    const page = await context.newPage();

    // Navigate to the PDF viewer
    console.log('Navigating to PDF:', PDF_URL);
    await page.goto(PDF_URL, {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Wait for either the DocuVieware viewer to load or redirect to login
    console.log('Waiting for page to load...');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Check if we're redirected to login
    if (currentUrl.includes('login')) {
      console.log('\n⚠️  Session expired. Please log in manually in the browser window...');
      console.log('Waiting up to 2 minutes for login...');

      // Wait for user to login
      await page.waitForFunction(
        () => !window.location.href.includes('login'),
        { timeout: 120000 }
      ).catch(() => {
        throw new Error('Login timeout. Please try again.');
      });

      // Navigate back to PDF after login
      console.log('Login detected. Navigating back to PDF...');
      await page.goto(PDF_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);
    }

    // Wait for DocuVieware viewer to load
    console.log('Waiting for PDF viewer to load...');
    await page.waitForSelector('#DocuVieware1, .dv-main', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Get page count
    const pageCountText = await page.locator('#pageCountBoxDocuVieware1, #pageCountBoxMobileDocuVieware1').first().textContent();
    const pageCount = parseInt(pageCountText || '0') || 1;
    console.log(`PDF has ${pageCount} pages`);

    const rawText: string[] = [];
    const series: CoinSeries[] = [];

    // Extract text from each page
    for (let pageNum = 1; pageNum <= Math.min(pageCount, 50); pageNum++) { // Limit to 50 pages for testing
      console.log(`Extracting page ${pageNum}/${pageCount}...`);

      // Navigate to page
      if (pageNum > 1) {
        // Set page number
        await page.locator('#pageNavBoxDocuVieware1').fill(pageNum.toString());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
      }

      // Try to get text content from the viewer
      // DocuVieware renders PDF as images with text overlay
      const pageText = await page.evaluate(() => {
        // Try to get text from various possible selectors
        const textLayers = document.querySelectorAll('.dv-text-layer, .textLayer, [data-page-content], .page-content');
        let text = '';
        textLayers.forEach(layer => {
          text += layer.textContent + '\n';
        });

        // Also try getting from any visible text elements
        if (!text.trim()) {
          const allText = document.body.innerText;
          text = allText;
        }

        return text;
      });

      if (pageText.trim()) {
        rawText.push(`--- PAGE ${pageNum} ---\n${pageText}`);

        // Parse the page text for pricing data
        const parsedSeries = parsePageText(pageText, pageNum);
        if (parsedSeries) {
          series.push(...parsedSeries);
        }
      }
    }

    // Try alternative approach: Use DocuVieware's search/export if available
    console.log('\nAttempting to use viewer search functionality...');

    // Look for search button
    const searchButton = await page.locator('#DocuVieware1_snapin_button_search').first();
    if (await searchButton.isVisible()) {
      console.log('Search panel available');
      // Could search for specific coin types
    }

    // Try to get thumbnails text
    const thumbnailsButton = await page.locator('#DocuVieware1_snapin_button_thumbnails').first();
    if (await thumbnailsButton.isVisible()) {
      await thumbnailsButton.click();
      await page.waitForTimeout(1000);
    }

    // Take screenshots of each page as backup
    console.log('\nTaking screenshots of pages...');
    const screenshotDir = path.join(process.cwd(), 'data', 'greysheet-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    for (let pageNum = 1; pageNum <= Math.min(pageCount, 10); pageNum++) {
      // Navigate to page
      await page.locator('#pageNavBoxDocuVieware1').fill(pageNum.toString());
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: path.join(screenshotDir, `page-${pageNum.toString().padStart(3, '0')}.png`),
        fullPage: false
      });
      console.log(`  Screenshot saved: page-${pageNum.toString().padStart(3, '0')}.png`);
    }

    const result: GreysheetPdfData = {
      source: 'greysheet.com',
      pdfName: 'Monthly Greysheet January 2026',
      extractedAt: new Date().toISOString(),
      pageCount,
      series,
      rawText
    };

    return result;

  } finally {
    if (context) {
      await context.close();
    }
  }
}

function parsePageText(text: string, _pageNum: number): CoinSeries[] {
  const series: CoinSeries[] = [];

  // Common patterns in Greysheet pricing tables
  const patterns = {
    // Year patterns
    year: /\b(1[89]\d{2}|20[0-2]\d)\b/g,
    // Mintmark patterns
    mintmark: /\b([SDOPW]|CC)\b/g,
    // Grade patterns
    grade: /\b(MS|PF|PR|AU|XF|EF|VF|F|VG|G|AG|FR|PO)\s*[-]?\s*(\d{1,2})\b/gi,
    // Price patterns (with $ or just numbers)
    price: /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    // Series headers
    seriesHeader: /(MORGAN|PEACE|WALKING|LIBERTY|EAGLE|BUFFALO|MERCURY|BARBER|SEATED|FLYING)/gi,
  };

  // Find series headers
  const seriesMatches = text.match(patterns.seriesHeader);
  if (seriesMatches) {
    console.log(`    Found series references: ${[...new Set(seriesMatches)].join(', ')}`);
  }

  // Find years and grades
  const years = text.match(patterns.year) || [];
  const grades = text.match(patterns.grade) || [];
  const prices = text.match(patterns.price) || [];

  if (years.length > 0 || grades.length > 0) {
    console.log(`    Found ${years.length} years, ${grades.length} grades, ${prices.length} prices`);
  }

  // Extract structured data (simplified - real implementation would be more complex)
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const yearMatch = line.match(/\b(1[89]\d{2}|20[0-2]\d)(-[SDOPW]|CC)?\b/);
    if (yearMatch) {
      const gradeMatches = [...line.matchAll(/\b(MS|PF|AU)\s*[-]?\s*(\d{1,2})\b/gi)];
      const priceMatches = [...line.matchAll(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g)];

      if (gradeMatches.length > 0 && priceMatches.length > 0) {
        // Could build structured data here
      }
    }
  }

  return series;
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Greysheet PDF Extractor');
    console.log('='.repeat(60));
    console.log('');

    const data = await extractPdfText();

    // Save results
    console.log('\nSaving results to:', OUTPUT_PATH);
    const dir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('Extraction complete!');
    console.log(`  Pages processed: ${data.pageCount}`);
    console.log(`  Series found: ${data.series.length}`);
    console.log(`  Raw text pages: ${data.rawText.length}`);
    console.log(`  Output: ${OUTPUT_PATH}`);

    if (data.rawText.length === 0) {
      console.log('\n⚠️  No text was extracted from the PDF.');
      console.log('The DocuVieware viewer may render the PDF as images only.');
      console.log('Check the screenshots in data/greysheet-screenshots/ for visual data.');
      console.log('\nAlternative approaches:');
      console.log('  1. Use OCR on the screenshots');
      console.log('  2. Scrape individual coin pages from greysheet.com/prices');
      console.log('  3. Use the existing greysheet.ts scraper with fresh login');
    }

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    console.log('\nTroubleshooting:');
    console.log('  1. Make sure you are logged into Greysheet');
    console.log('  2. Run: npx tsx src/lib/services/market-data/providers/greysheet.ts login');
    console.log('  3. Check if the PDF URL is correct');
    process.exit(1);
  }
}

main();

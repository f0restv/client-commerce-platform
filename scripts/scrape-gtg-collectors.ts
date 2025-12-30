#!/usr/bin/env npx ts-node
/**
 * Collectors Universe "Guess the Grade" Scraper
 *
 * Scrapes GTG threads from PCGS/NGC official forums.
 * These have the best revealed grades since they're TPG-related.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { chromium, type Page } from 'playwright';

// Configuration
const CONFIG = {
  baseUrl: 'https://forums.collectors.com',
  // Direct forum search for GTG content
  forumUrls: [
    'https://forums.collectors.com/categories/grading-opinion',
  ],
  outputDir: 'data/training/guess-the-grade/collectors-universe',
  metadataPath: 'data/training/guess-the-grade/metadata.json',
  delayBetweenRequests: 3000,
  maxThreads: 100,
};

// Types
interface GTGMetadata {
  image: string;
  source: 'reddit' | 'cointalk' | 'collectors-universe' | 'youtube';
  sourceUrl: string;
  postId: string;
  postTitle: string;
  coinType: string | null;
  revealedGrade: string | null;
  grader: string | null;
  guesses: string[];
  author: string;
  createdAt: string;
  extractedAt: string;
}

interface ScrapedThread {
  id: string;
  title: string;
  author: string;
  url: string;
  imageUrls: string[];
  opPosts: string[];
  replies: string[];
  createdAt: string;
}

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      console.log(`    Invalid URL: ${url.substring(0, 100)}`);
      resolve(false);
      return;
    }
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': CONFIG.baseUrl,
      },
    };

    const req = client.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, outputPath).then(resolve);
          return;
        }
      }

      if (res.statusCode !== 200) {
        console.log(`    Failed to download image: HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
      });
      fileStream.on('error', () => {
        fs.unlink(outputPath, () => {});
        resolve(false);
      });
    });

    req.on('error', () => resolve(false));
    req.setTimeout(30000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Grade extraction patterns
const GRADE_PATTERNS = [
  /\b(MS|PR|PF|AU|XF|EF|VF|F|VG|G|AG|FR|PO|SP|CA)[-\s]?(\d{1,2})(\+)?(?:\s*(RD|RB|BN|PL|DMPL|DCAM|CAM|UC|FB|FH|FT|FSB))?\b/gi,
  /\b(Mint State|Proof|About Uncirculated|Extremely Fine|Very Fine|Fine|Very Good|Good|About Good|Fair|Poor)[-\s]?(\d{1,2})\b/gi,
];

const GRADER_PATTERNS = [
  /\b(PCGS|NGC|ANACS|ICG|CAC)\b/gi,
];

const COIN_TYPE_PATTERNS = [
  /\b(morgan|peace|walking liberty|seated liberty|barber|mercury|roosevelt|washington|kennedy|franklin|buffalo|indian head|lincoln|wheat|memorial|shield|flying eagle|braided hair|coronet|liberty head|saint.gaudens|double eagle|half eagle|quarter eagle|trade dollar|flowing hair|draped bust|capped bust)\b/gi,
  /\b(dollar|half dollar|quarter|dime|nickel|cent|penny|eagle)\b/gi,
];

function extractGrades(text: string): string[] {
  const grades: string[] = [];
  for (const pattern of GRADE_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      let grade = match[0].toUpperCase().replace(/\s+/g, '');
      grade = grade.replace(/^(MS|PR|PF|AU|XF|EF|VF|F|VG|G|AG|FR|PO|SP|CA)-?(\d)/, '$1$2');
      if (!grades.includes(grade)) {
        grades.push(grade);
      }
    }
  }
  return grades;
}

function extractGrader(text: string): string | null {
  for (const pattern of GRADER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0].toUpperCase();
    }
  }
  return null;
}

function extractCoinType(text: string): string | null {
  const types: string[] = [];
  for (const pattern of COIN_TYPE_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      const type = match[0].toLowerCase().replace(/\s+/g, '-');
      if (!types.includes(type)) {
        types.push(type);
      }
    }
  }
  return types.length > 0 ? types.join('-') : null;
}

function isGTGThread(title: string): boolean {
  const titleLower = title.toLowerCase();
  const gtgPatterns = [
    /guess\s+the\s+grade/i,
    /\bgtg\b/i,
    /guess\s+grade/i,
    /grade\s+this/i,
    /what\s+grade/i,
  ];
  return gtgPatterns.some(p => p.test(titleLower));
}

async function loadExistingMetadata(): Promise<GTGMetadata[]> {
  try {
    if (fs.existsSync(CONFIG.metadataPath)) {
      const data = fs.readFileSync(CONFIG.metadataPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading existing metadata:', error);
  }
  return [];
}

function saveMetadata(metadata: GTGMetadata[]): void {
  fs.writeFileSync(CONFIG.metadataPath, JSON.stringify(metadata, null, 2));
}

// Collectors Universe scraping functions
async function browseForums(page: Page): Promise<string[]> {
  const threadUrls: string[] = [];
  console.log('Browsing Collectors Universe forums for GTG threads...');

  try {
    // Go to the grading opinion forum
    for (const forumUrl of CONFIG.forumUrls) {
      console.log(`  Visiting: ${forumUrl}`);
      await page.goto(forumUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);

      // Debug page
      const title = await page.title();
      console.log(`    Page title: ${title}`);

      // Look for discussion links
      const selectors = [
        'a[href*="/discussion/"]',
        '.Title a',
        '.ItemDiscussion a',
        '.DataBox a[href*="discussion"]',
        'h2 a, h3 a',
      ];

      for (const selector of selectors) {
        const links = await page.$$eval(selector, (els) =>
          els.map(el => ({
            href: el.getAttribute('href'),
            text: el.textContent?.trim() || '',
          })).filter(l => l.href)
        ).catch(() => []);

        if (links.length > 0) {
          console.log(`    Found ${links.length} links with: ${selector}`);

          for (const { href, text } of links) {
            // Check if it's a GTG thread by title
            if (href && isGTGThread(text)) {
              const fullUrl = href.startsWith('http') ? href : `${CONFIG.baseUrl}${href}`;
              if (!threadUrls.includes(fullUrl)) {
                threadUrls.push(fullUrl);
                console.log(`      GTG: ${text.substring(0, 50)}...`);
              }
            }
          }
        }
      }

      // Try scrolling to load more
      for (let scroll = 0; scroll < 3; scroll++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(2000);
      }
    }
  } catch (error) {
    console.error('Error browsing forums:', error);
  }

  console.log(`  Total GTG threads found: ${threadUrls.length}`);
  return threadUrls;
}

async function scrapeThread(page: Page, url: string): Promise<ScrapedThread | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Extract thread ID from URL
    const idMatch = url.match(/discussion\/(\d+)/);
    if (!idMatch) {
      // Try alternate pattern
      const altMatch = url.match(/\/(\d+)$/);
      if (!altMatch) return null;
    }
    const threadId = idMatch ? idMatch[1] : url.split('/').pop() || 'unknown';

    // Get title
    const title = await page.$eval('h1, .PageTitle h1, .Discussion h1',
      el => el.textContent?.trim() || '').catch(() => '');
    if (!title) return null;

    // Get author
    const author = await page.$eval('.Item:first-child .Author, .MessageList .Item:first-child .Username',
      el => el.textContent?.trim() || '').catch(() => 'unknown');

    // Get images from OP post
    const imageUrls: string[] = [];
    const postImages = await page.$$eval('.Item:first-child img, .Message:first-child img',
      (els) => els.map(el => (el as HTMLImageElement).src).filter(src =>
        src && !src.includes('avatar') && !src.includes('icon') && !src.includes('emoji')
      )
    ).catch(() => []);
    imageUrls.push(...postImages);

    // Get all posts content
    const allPosts = await page.$$eval('.Item .Message, .Comment .Message, .MessageBody',
      (els) => els.map(el => el.textContent?.trim() || '').filter(Boolean)
    ).catch(() => []);

    const opPosts = allPosts.slice(0, 1);
    const replies = allPosts.slice(1);

    // Get OP's follow-up posts (replies by the same author)
    // This is tricky - look for replies where author mentions "reveal" or the grade
    for (const reply of replies) {
      if (reply.toLowerCase().includes('reveal') ||
          reply.toLowerCase().includes('answer') ||
          reply.toLowerCase().includes('came back') ||
          reply.toLowerCase().includes('graded')) {
        opPosts.push(reply);
      }
    }

    // Get timestamp
    const timestamp = await page.$eval('time, .DateCreated',
      el => el.getAttribute('datetime') || el.textContent?.trim() || '').catch(() => '');

    return {
      id: threadId,
      title,
      author,
      url,
      imageUrls: [...new Set(imageUrls)],
      opPosts,
      replies,
      createdAt: timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`    Error scraping thread: ${error}`);
    return null;
  }
}

async function processThread(thread: ScrapedThread): Promise<GTGMetadata | null> {
  console.log(`  Processing: ${thread.title.substring(0, 60)}...`);

  if (thread.imageUrls.length === 0) {
    console.log('    No images found, skipping');
    return null;
  }

  // Extract guesses from replies
  const allReplyText = thread.replies.join(' ');
  const allGuesses = extractGrades(allReplyText);

  // Extract revealed grade from OP posts
  let revealedGrade: string | null = null;
  let grader: string | null = null;

  for (const post of thread.opPosts.slice(1)) {
    const grades = extractGrades(post);
    if (grades.length > 0) {
      revealedGrade = grades[0];
      grader = extractGrader(post);
      break;
    }
  }

  const coinType = extractCoinType(thread.title + ' ' + thread.opPosts[0]);

  if (!grader) {
    grader = extractGrader(thread.title + ' ' + thread.opPosts.join(' '));
  }

  // Download first image
  const imageFilename = `${thread.id}.jpg`;
  const imagePath = path.join(CONFIG.outputDir, imageFilename);

  if (!fs.existsSync(imagePath)) {
    console.log(`    Downloading image...`);
    const downloaded = await downloadImage(thread.imageUrls[0], imagePath);
    if (!downloaded) {
      console.log('    Failed to download image, skipping');
      return null;
    }
  } else {
    console.log('    Image already exists');
  }

  const guesses = allGuesses.filter(g => g !== revealedGrade);

  const metadata: GTGMetadata = {
    image: `collectors-universe/${imageFilename}`,
    source: 'collectors-universe',
    sourceUrl: thread.url,
    postId: thread.id,
    postTitle: thread.title,
    coinType,
    revealedGrade,
    grader,
    guesses,
    author: thread.author,
    createdAt: thread.createdAt,
    extractedAt: new Date().toISOString(),
  };

  console.log(`    Grade: ${revealedGrade || 'not found'}, Grader: ${grader || 'unknown'}, Guesses: ${guesses.length}`);

  return metadata;
}

async function main() {
  console.log('=== Collectors Universe Guess the Grade Scraper ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Load existing metadata
  let allMetadata = await loadExistingMetadata();
  const existingIds = new Set(allMetadata.filter(m => m.source === 'collectors-universe').map(m => m.postId));
  console.log(`Loaded ${allMetadata.length} existing entries (${existingIds.size} from Collectors Universe)\n`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // Browse forums for GTG threads
    const threadUrls = await browseForums(page);

    // Filter out already processed
    const newUrls = threadUrls.filter(url => {
      const idMatch = url.match(/discussion\/(\d+)/) || url.match(/\/(\d+)$/);
      return idMatch && !existingIds.has(idMatch[1]);
    });

    console.log(`\n=== Found ${newUrls.length} new threads to process ===\n`);

    // Process each thread
    let processed = 0;
    let successful = 0;

    for (const url of newUrls.slice(0, CONFIG.maxThreads)) {
      processed++;
      console.log(`\n[${processed}/${Math.min(newUrls.length, CONFIG.maxThreads)}]`);

      try {
        await sleep(CONFIG.delayBetweenRequests);
        const thread = await scrapeThread(page, url);

        if (!thread) {
          console.log('    Could not scrape thread');
          continue;
        }

        const metadata = await processThread(thread);
        if (metadata) {
          allMetadata.push(metadata);
          successful++;

          if (successful % 5 === 0) {
            saveMetadata(allMetadata);
            console.log(`  [Saved ${allMetadata.length} total entries]`);
          }
        }
      } catch (error) {
        console.error(`  Error processing thread: ${error}`);
      }
    }

    // Final save
    saveMetadata(allMetadata);

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total entries: ${allMetadata.length}`);
    const cuEntries = allMetadata.filter(m => m.source === 'collectors-universe');
    console.log(`Collectors Universe entries: ${cuEntries.length}`);
    console.log(`New entries: ${successful}`);
    console.log(`With revealed grade: ${cuEntries.filter(m => m.revealedGrade).length}`);
    console.log(`With guesses: ${cuEntries.filter(m => m.guesses.length > 0).length}`);

    // Stats by grader
    const graderCounts: Record<string, number> = {};
    for (const m of cuEntries) {
      if (m.grader) {
        graderCounts[m.grader] = (graderCounts[m.grader] || 0) + 1;
      }
    }
    console.log('\nBy grader:');
    for (const [grader, count] of Object.entries(graderCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${grader}: ${count}`);
    }

  } finally {
    await browser.close();
  }
}

main().catch(console.error);

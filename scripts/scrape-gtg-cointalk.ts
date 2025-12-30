#!/usr/bin/env npx ts-node
/**
 * CoinTalk "Guess the Grade" Scraper
 *
 * Scrapes GTG threads from CoinTalk forums - better structured than Reddit
 * with clear reveals from thread OPs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { chromium, type Page } from 'playwright';

// Configuration
const CONFIG = {
  baseUrl: 'https://www.cointalk.com',
  searchUrl: 'https://www.cointalk.com/search/?q=guess+the+grade&t=post&c[title_only]=1&o=date',
  outputDir: 'data/training/guess-the-grade/cointalk',
  metadataPath: 'data/training/guess-the-grade/metadata.json',
  delayBetweenRequests: 3000,
  maxPages: 10,
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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const decodedUrl = decodeHtmlEntities(url);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(decodedUrl);
    } catch {
      console.log(`    Invalid URL: ${decodedUrl.substring(0, 100)}`);
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
          const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : `${CONFIG.baseUrl}${redirectUrl}`;
          downloadImage(absoluteUrl, outputPath).then(resolve);
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

// CoinTalk scraping functions
async function searchCoinTalk(page: Page): Promise<string[]> {
  const threadUrls: string[] = [];
  console.log('Searching CoinTalk for GTG threads...');

  try {
    // Try Google search for CoinTalk GTG threads (more reliable)
    const googleSearchUrl = 'https://www.google.com/search?q=site:cointalk.com+"guess+the+grade"&num=100';
    await page.goto(googleSearchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Extract CoinTalk URLs from Google results
    const googleLinks = await page.$$eval('a[href*="cointalk.com/threads"]', (els) =>
      els.map(el => el.getAttribute('href')).filter(Boolean) as string[]
    ).catch(() => []);

    console.log(`  Found ${googleLinks.length} from Google`);

    for (const link of googleLinks) {
      // Clean up Google redirect URLs
      let cleanUrl = link;
      if (link.includes('/url?')) {
        const match = link.match(/url=([^&]+)/);
        if (match) cleanUrl = decodeURIComponent(match[1]);
      }
      if (cleanUrl.includes('cointalk.com/threads/') && !threadUrls.includes(cleanUrl)) {
        threadUrls.push(cleanUrl);
      }
    }

    // Also try direct CoinTalk search
    await sleep(CONFIG.delayBetweenRequests);
    await page.goto(CONFIG.searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Get thread links from search results - try multiple selectors
    for (let pageNum = 1; pageNum <= CONFIG.maxPages; pageNum++) {
      console.log(`  CoinTalk Page ${pageNum}...`);

      // Debug: check page content
      const pageContent = await page.content();
      console.log(`    Page length: ${pageContent.length}`);

      // Try various selectors
      const selectors = [
        '.contentRow-title a',
        'h3.title a',
        '.structItem-title a',
        'a[href*="/threads/"]',
        '.p-body-content a[href*="/threads/"]',
      ];

      for (const selector of selectors) {
        const links = await page.$$eval(selector, (els) =>
          els.map(el => el.getAttribute('href')).filter(Boolean) as string[]
        ).catch(() => []);

        if (links.length > 0) {
          console.log(`    Found ${links.length} with selector: ${selector}`);
          for (const link of links) {
            const fullUrl = link.startsWith('http') ? link : `${CONFIG.baseUrl}${link}`;
            if (fullUrl.includes('/threads/') && !threadUrls.includes(fullUrl)) {
              threadUrls.push(fullUrl);
            }
          }
        }
      }

      console.log(`    Total so far: ${threadUrls.length}`);

      // Check for next page
      const nextPage = await page.$('a.pageNav-jump--next, a[rel="next"]');
      if (!nextPage) break;

      await nextPage.click().catch(() => {});
      await sleep(CONFIG.delayBetweenRequests);
    }
  } catch (error) {
    console.error('Error searching CoinTalk:', error);
  }

  return threadUrls;
}

async function scrapeThread(page: Page, url: string): Promise<ScrapedThread | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Extract thread ID from URL
    const idMatch = url.match(/threads\/[^.]+\.(\d+)/);
    if (!idMatch) return null;
    const threadId = idMatch[1];

    // Get title
    const title = await page.$eval('h1.p-title-value', el => el.textContent?.trim() || '').catch(() => '');
    if (!title) return null;

    // Get author
    const author = await page.$eval('.message--post:first-child .message-userDetails .username',
      el => el.textContent?.trim() || '').catch(() => 'unknown');

    // Get images from OP post
    const imageUrls: string[] = [];
    const opImages = await page.$$eval('.message--post:first-child .bbImage, .message--post:first-child img.bbImage',
      (els) => els.map(el => (el as HTMLImageElement).src).filter(Boolean)
    ).catch(() => []);
    imageUrls.push(...opImages);

    // Also check for attachment images
    const attachmentImages = await page.$$eval('.message--post:first-child .attachment img',
      (els) => els.map(el => (el as HTMLImageElement).src).filter(Boolean)
    ).catch(() => []);
    imageUrls.push(...attachmentImages);

    // Get OP's posts (first post + any replies by OP with reveal keywords)
    const opPosts: string[] = [];
    const opFirstPost = await page.$eval('.message--post:first-child .message-body .bbWrapper',
      el => el.textContent?.trim() || '').catch(() => '');
    if (opFirstPost) opPosts.push(opFirstPost);

    // Get OP's follow-up posts (reveals)
    const authorEscaped = author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const opReplies = await page.$$eval('.message--post', (posts, authorName) => {
      return posts.slice(1).map(post => {
        const postAuthor = post.querySelector('.message-userDetails .username')?.textContent?.trim();
        if (postAuthor === authorName) {
          return post.querySelector('.message-body .bbWrapper')?.textContent?.trim() || '';
        }
        return '';
      }).filter(Boolean);
    }, author).catch(() => []);
    opPosts.push(...opReplies);

    // Get all other replies
    const replies = await page.$$eval('.message--post', (posts, authorName) => {
      return posts.slice(1).map(post => {
        const postAuthor = post.querySelector('.message-userDetails .username')?.textContent?.trim();
        if (postAuthor !== authorName) {
          return post.querySelector('.message-body .bbWrapper')?.textContent?.trim() || '';
        }
        return '';
      }).filter(Boolean);
    }, author).catch(() => []);

    // Get timestamp
    const timestamp = await page.$eval('.message--post:first-child time',
      el => el.getAttribute('datetime') || '').catch(() => '');

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

  // Extract revealed grade from OP posts (look for reveal keywords)
  let revealedGrade: string | null = null;
  let grader: string | null = null;

  for (const post of thread.opPosts.slice(1)) { // Skip first post (the question)
    const text = post.toLowerCase();
    const revealKeywords = ['reveal', 'answer', 'came back', 'graded', 'returned', 'the grade is', 'it\'s a', 'it is a', 'winner'];

    if (revealKeywords.some(kw => text.includes(kw))) {
      const grades = extractGrades(post);
      if (grades.length > 0) {
        revealedGrade = grades[0];
        grader = extractGrader(post);
        break;
      }
    }
  }

  // Also check if any OP post mentions a grade (fallback)
  if (!revealedGrade) {
    for (const post of thread.opPosts.slice(1)) {
      const grades = extractGrades(post);
      if (grades.length > 0) {
        revealedGrade = grades[0];
        grader = extractGrader(post);
        break;
      }
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

  // Filter guesses - remove the revealed grade
  const guesses = allGuesses.filter(g => g !== revealedGrade);

  const metadata: GTGMetadata = {
    image: `cointalk/${imageFilename}`,
    source: 'cointalk',
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
  console.log('=== CoinTalk Guess the Grade Scraper ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Load existing metadata
  let allMetadata = await loadExistingMetadata();
  const existingIds = new Set(allMetadata.filter(m => m.source === 'cointalk').map(m => m.postId));
  console.log(`Loaded ${allMetadata.length} existing entries (${existingIds.size} from CoinTalk)\n`);

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
    // Search for GTG threads
    const threadUrls = await searchCoinTalk(page);

    // Filter out already processed
    const newUrls = threadUrls.filter(url => {
      const idMatch = url.match(/threads\/[^.]+\.(\d+)/);
      return idMatch && !existingIds.has(idMatch[1]);
    });

    console.log(`\n=== Found ${newUrls.length} new threads to process ===\n`);

    // Process each thread
    let processed = 0;
    let successful = 0;

    for (const url of newUrls) {
      processed++;
      console.log(`\n[${processed}/${newUrls.length}]`);

      try {
        await sleep(CONFIG.delayBetweenRequests);
        const thread = await scrapeThread(page, url);

        if (!thread) {
          console.log('    Could not scrape thread');
          continue;
        }

        if (!isGTGThread(thread.title)) {
          console.log(`    Not a GTG thread: ${thread.title.substring(0, 40)}...`);
          continue;
        }

        const metadata = await processThread(thread);
        if (metadata) {
          allMetadata.push(metadata);
          successful++;

          // Save periodically
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
    const cointalkEntries = allMetadata.filter(m => m.source === 'cointalk');
    console.log(`CoinTalk entries: ${cointalkEntries.length}`);
    console.log(`New entries: ${successful}`);
    console.log(`With revealed grade: ${cointalkEntries.filter(m => m.revealedGrade).length}`);
    console.log(`With guesses: ${cointalkEntries.filter(m => m.guesses.length > 0).length}`);

    // Stats by grader
    const graderCounts: Record<string, number> = {};
    for (const m of cointalkEntries) {
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

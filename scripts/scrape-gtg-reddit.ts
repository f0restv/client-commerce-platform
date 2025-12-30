#!/usr/bin/env npx ts-node
/**
 * Reddit "Guess the Grade" Scraper - JSON API Version
 *
 * Scrapes GTG posts from coin collecting subreddits using Reddit's JSON API.
 * No browser automation needed - fully automated via HTTP requests.
 *
 * Usage:
 *   npx ts-node scripts/scrape-gtg-reddit.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Configuration
const CONFIG = {
  subreddits: ['coins', 'Coingrading'],
  searchQueries: ['guess the grade', 'GTG'],
  outputDir: 'data/training/guess-the-grade/reddit',
  metadataPath: 'data/training/guess-the-grade/metadata.json',
  delayBetweenRequests: 4000, // Reddit rate limit friendly (increased from 2s)
  maxResultsPerSearch: 100,
  maxRetries: 3,
  userAgent: 'CoinGradingTrainer/1.0 (Educational coin grading data collection)',
};

// Types
interface RedditPost {
  kind: string;
  data: {
    id: string;
    title: string;
    author: string;
    selftext: string;
    url: string;
    permalink: string;
    created_utc: number;
    is_gallery?: boolean;
    gallery_data?: { items: { media_id: string }[] };
    media_metadata?: Record<string, { s?: { u: string } }>;
    preview?: {
      images: { source: { url: string } }[];
    };
  };
}

interface RedditComment {
  kind: string;
  data: {
    id: string;
    author: string;
    body: string;
    replies?: { data?: { children?: RedditComment[] } } | string;
    is_submitter?: boolean;
  };
}

interface GTGMetadata {
  image: string;
  source: 'reddit';
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

// Utility: Sleep
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Utility: Decode HTML entities from Reddit URLs
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

// Utility: Fetch JSON from Reddit with retry
async function fetchRedditJson<T>(url: string, retries = CONFIG.maxRetries): Promise<T | null> {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'application/json',
      },
    };

    https
      .get(url, options, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            fetchRedditJson<T>(redirectUrl, retries).then(resolve);
            return;
          }
        }

        // Handle rate limit with retry
        if (res.statusCode === 429 && retries > 0) {
          const retryAfter = parseInt(res.headers['retry-after'] as string) || 10;
          console.log(`  Rate limited, waiting ${retryAfter}s... (${retries} retries left)`);
          setTimeout(() => {
            fetchRedditJson<T>(url, retries - 1).then(resolve);
          }, retryAfter * 1000);
          return;
        }

        if (res.statusCode !== 200) {
          console.log(`  HTTP ${res.statusCode} for ${url.substring(0, 80)}...`);
          resolve(null);
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            console.log(`  JSON parse error for ${url.substring(0, 80)}...`);
            resolve(null);
          }
        });
      })
      .on('error', (err) => {
        console.log(`  Fetch error: ${err.message}`);
        resolve(null);
      });
  });
}

// Utility: Download image
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

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': CONFIG.userAgent,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, outputPath).then(resolve);
          return;
        }
      }

      if (res.statusCode !== 200) {
        console.log(`    Image download failed: HTTP ${res.statusCode}`);
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

// Grade extraction regex patterns
const GRADE_REVEAL_PATTERNS = [
  // "revealed: MS64" or "reveal: AU58"
  /revealed?:?\s*(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?/gi,
  // "grade: MS65" or "the grade is MS65"
  /grade:?\s*(?:is\s+)?(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?/gi,
  // "it's a MS65" or "it is an AU58"
  /it['']?s\s+a[n]?\s*(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?/gi,
  // "PCGS MS65" or "NGC AU58"
  /(PCGS|NGC|ANACS|ICG)\s+(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?/gi,
  // Standalone grade with context like "came back MS65"
  /came\s+back\s+(?:as\s+)?(?:a\s+)?(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?/gi,
  // Generic grade pattern (less specific, used for OP comments)
  /\b(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?\b/gi,
];

const GRADER_PATTERNS = [/(PCGS|NGC|ANACS|ICG|CAC)/gi];

const COIN_TYPE_PATTERNS = [
  /\b(morgan|peace|walking liberty|seated liberty|barber|mercury|roosevelt|washington|kennedy|franklin|buffalo|indian head|lincoln|wheat|memorial|shield|flying eagle|braided hair|coronet|liberty head|saint[.-]?gaudens|double eagle|half eagle|quarter eagle|trade dollar|flowing hair|draped bust|capped bust)\b/gi,
];

function extractGrade(text: string, useSpecificPatterns = true): string | null {
  const patterns = useSpecificPatterns
    ? GRADE_REVEAL_PATTERNS.slice(0, -1) // Exclude generic pattern
    : GRADE_REVEAL_PATTERNS;

  for (const pattern of patterns) {
    const regex = new RegExp(pattern);
    const match = regex.exec(text);
    if (match) {
      // Handle patterns with grader prefix (PCGS MS65)
      if (match[1] && ['PCGS', 'NGC', 'ANACS', 'ICG'].includes(match[1].toUpperCase())) {
        return `${match[2].toUpperCase()}${match[3]}`;
      }
      // Standard grade extraction
      const gradePrefix = match[1]?.toUpperCase() || '';
      const gradeNum = match[2] || '';
      if (gradePrefix && gradeNum) {
        return `${gradePrefix}${gradeNum}`;
      }
    }
  }
  return null;
}

function extractAllGrades(text: string): string[] {
  const grades: string[] = [];
  const pattern = /\b(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)\s*-?\s*(\d{1,2})\+?\b/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const grade = `${match[1].toUpperCase()}${match[2]}`;
    if (!grades.includes(grade)) {
      grades.push(grade);
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
  for (const pattern of COIN_TYPE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0].toLowerCase().replace(/\s+/g, '-');
    }
  }
  return null;
}

// Search subreddit using JSON API
async function searchSubreddit(subreddit: string, query: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&limit=${CONFIG.maxResultsPerSearch}`;
  console.log(`  Searching r/${subreddit} for "${query}"...`);

  interface SearchResponse {
    data?: {
      children?: RedditPost[];
    };
  }

  const response = await fetchRedditJson<SearchResponse>(url);
  if (!response?.data?.children) {
    console.log(`    No results`);
    return [];
  }

  console.log(`    Found ${response.data.children.length} posts`);
  return response.data.children;
}

// Fetch post with all comments
async function fetchPostWithComments(
  postId: string
): Promise<{ post: RedditPost; comments: RedditComment[] } | null> {
  const url = `https://www.reddit.com/comments/${postId}.json?limit=500`;

  type PostResponse = [
    { data?: { children?: RedditPost[] } },
    { data?: { children?: RedditComment[] } },
  ];

  const response = await fetchRedditJson<PostResponse>(url);
  if (!response || !Array.isArray(response) || response.length < 2) {
    return null;
  }

  const post = response[0]?.data?.children?.[0];
  const comments = response[1]?.data?.children || [];

  if (!post) {
    return null;
  }

  return { post, comments };
}

// Flatten nested comments
function flattenComments(comments: RedditComment[]): RedditComment[] {
  const flat: RedditComment[] = [];

  function recurse(commentList: RedditComment[]) {
    for (const comment of commentList) {
      if (comment.kind === 't1' && comment.data) {
        flat.push(comment);
        if (
          comment.data.replies &&
          typeof comment.data.replies === 'object' &&
          comment.data.replies.data?.children
        ) {
          recurse(comment.data.replies.data.children);
        }
      }
    }
  }

  recurse(comments);
  return flat;
}

// Extract image URL from post
function extractImageUrl(post: RedditPost): string | null {
  const data = post.data;

  // Direct image URL
  if (data.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(data.url)) {
    return data.url;
  }

  // i.redd.it or i.imgur.com
  if (data.url && (data.url.includes('i.redd.it') || data.url.includes('i.imgur.com'))) {
    return data.url;
  }

  // Gallery - get first image
  if (data.is_gallery && data.gallery_data?.items && data.media_metadata) {
    const firstItem = data.gallery_data.items[0];
    if (firstItem) {
      const media = data.media_metadata[firstItem.media_id];
      if (media?.s?.u) {
        return decodeHtmlEntities(media.s.u);
      }
    }
  }

  // Preview image
  if (data.preview?.images?.[0]?.source?.url) {
    return decodeHtmlEntities(data.preview.images[0].source.url);
  }

  return null;
}

// Process a single post
async function processPost(
  post: RedditPost,
  comments: RedditComment[],
  existingIds: Set<string>
): Promise<GTGMetadata | null> {
  const data = post.data;
  const postId = data.id;

  if (existingIds.has(postId)) {
    return null;
  }

  console.log(`\n  Processing: ${data.title.substring(0, 60)}...`);

  // Extract image
  const imageUrl = extractImageUrl(post);
  if (!imageUrl) {
    console.log(`    No image found, skipping`);
    return null;
  }

  // Flatten and analyze comments
  const allComments = flattenComments(comments);
  const opComments = allComments.filter((c) => c.data.is_submitter || c.data.author === data.author);

  // Build text for analysis
  const opText = opComments.map((c) => c.data.body).join(' ');
  const allCommentsText = allComments.map((c) => c.data.body).join(' ');
  const titleAndBody = `${data.title} ${data.selftext}`;

  // Extract revealed grade - prioritize OP comments, then title
  let revealedGrade =
    extractGrade(opText, true) || // Specific patterns in OP comments
    extractGrade(titleAndBody, true) || // Specific patterns in title/body
    extractGrade(opText, false); // Generic pattern in OP comments (fallback)

  // Extract grader
  const grader =
    extractGrader(opText) || extractGrader(titleAndBody) || extractGrader(allCommentsText);

  // Extract guesses from all comments (excluding the revealed grade)
  const allGuesses = extractAllGrades(allCommentsText);
  const guesses = allGuesses.filter((g) => g !== revealedGrade);

  // Extract coin type
  const coinType = extractCoinType(titleAndBody);

  // Download image
  const imageFilename = `${postId}.jpg`;
  const imagePath = path.join(CONFIG.outputDir, imageFilename);

  if (!fs.existsSync(imagePath)) {
    console.log(`    Downloading image...`);
    const success = await downloadImage(imageUrl, imagePath);
    if (!success) {
      console.log(`    Failed to download image, skipping`);
      return null;
    }
  } else {
    console.log(`    Image already exists`);
  }

  const metadata: GTGMetadata = {
    image: `reddit/${imageFilename}`,
    source: 'reddit',
    sourceUrl: `https://reddit.com${data.permalink}`,
    postId,
    postTitle: data.title,
    coinType,
    revealedGrade,
    grader,
    guesses,
    author: data.author,
    createdAt: new Date(data.created_utc * 1000).toISOString(),
    extractedAt: new Date().toISOString(),
  };

  console.log(
    `    Grade: ${revealedGrade || 'not found'}, Grader: ${grader || 'unknown'}, Guesses: ${guesses.length}`
  );

  return metadata;
}

// Load existing metadata
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

// Save metadata
function saveMetadata(metadata: GTGMetadata[]): void {
  fs.writeFileSync(CONFIG.metadataPath, JSON.stringify(metadata, null, 2));
}

// Main
async function main() {
  console.log('=== Reddit GTG Scraper (JSON API) ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Load existing data
  let allMetadata = await loadExistingMetadata();
  const existingIds = new Set(allMetadata.map((m) => m.postId));
  console.log(`Loaded ${allMetadata.length} existing entries\n`);

  // Collect all unique posts
  const postsToProcess: Map<string, RedditPost> = new Map();

  for (const subreddit of CONFIG.subreddits) {
    console.log(`\n--- r/${subreddit} ---`);

    for (const query of CONFIG.searchQueries) {
      await sleep(CONFIG.delayBetweenRequests);
      const posts = await searchSubreddit(subreddit, query);

      for (const post of posts) {
        const id = post.data.id;
        if (!existingIds.has(id) && !postsToProcess.has(id)) {
          postsToProcess.set(id, post);
        }
      }
    }
  }

  console.log(`\n=== Processing ${postsToProcess.size} new posts ===`);

  let processed = 0;
  let successful = 0;

  for (const [postId, post] of postsToProcess) {
    processed++;
    console.log(`\n[${processed}/${postsToProcess.size}]`);

    await sleep(CONFIG.delayBetweenRequests);

    // Fetch full post with comments
    const fullPost = await fetchPostWithComments(postId);
    if (!fullPost) {
      console.log(`  Could not fetch post ${postId}`);
      continue;
    }

    const metadata = await processPost(fullPost.post, fullPost.comments, existingIds);
    if (metadata) {
      allMetadata.push(metadata);
      existingIds.add(postId);
      successful++;

      // Save periodically
      if (successful % 5 === 0) {
        saveMetadata(allMetadata);
        console.log(`  [Saved ${allMetadata.length} total entries]`);
      }
    }
  }

  // Final save
  saveMetadata(allMetadata);

  // Summary
  console.log('\n\n=== Summary ===');
  console.log(`Total entries: ${allMetadata.length}`);
  console.log(`New entries: ${successful}`);
  console.log(`With revealed grade: ${allMetadata.filter((m) => m.revealedGrade).length}`);
  console.log(`With guesses: ${allMetadata.filter((m) => m.guesses.length > 0).length}`);

  // Stats by grader
  const graderCounts: Record<string, number> = {};
  for (const m of allMetadata) {
    if (m.grader) {
      graderCounts[m.grader] = (graderCounts[m.grader] || 0) + 1;
    }
  }
  if (Object.keys(graderCounts).length > 0) {
    console.log('\nBy grader:');
    for (const [grader, count] of Object.entries(graderCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${grader}: ${count}`);
    }
  }

  console.log(`\nData saved to: ${CONFIG.outputDir}`);
  console.log(`Metadata saved to: ${CONFIG.metadataPath}`);
}

main().catch(console.error);

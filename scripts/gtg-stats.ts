#!/usr/bin/env npx ts-node
/**
 * GTG Training Data Statistics
 * Shows statistics about collected guess-the-grade training data
 */

import * as fs from 'fs';
import * as path from 'path';

const METADATA_PATH = 'data/training/guess-the-grade/metadata.json';
const IMAGES_DIR = 'data/training/guess-the-grade';

interface GTGMetadata {
  image: string;
  source: string;
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  // Load metadata
  const metadata: GTGMetadata[] = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));

  console.log('=== GTG Training Data Statistics ===\n');

  // Overall stats
  console.log(`Total entries: ${metadata.length}`);

  // By source
  const bySrc: Record<string, number> = {};
  for (const e of metadata) {
    bySrc[e.source] = (bySrc[e.source] || 0) + 1;
  }
  console.log('\nBy source:');
  for (const [src, count] of Object.entries(bySrc)) {
    console.log(`  ${src}: ${count}`);
  }

  // With revealed grade
  const withGrade = metadata.filter(m => m.revealedGrade);
  console.log(`\nWith revealed grade: ${withGrade.length} (${(withGrade.length / metadata.length * 100).toFixed(1)}%)`);

  // With guesses
  const withGuesses = metadata.filter(m => m.guesses.length > 0);
  console.log(`With guesses: ${withGuesses.length} (${(withGuesses.length / metadata.length * 100).toFixed(1)}%)`);

  // By grader
  const byGrader: Record<string, number> = {};
  for (const e of metadata) {
    if (e.grader) {
      byGrader[e.grader] = (byGrader[e.grader] || 0) + 1;
    }
  }
  console.log('\nBy grader:');
  for (const [grader, count] of Object.entries(byGrader).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${grader}: ${count}`);
  }

  // By coin type
  const byCoin: Record<string, number> = {};
  for (const e of metadata) {
    if (e.coinType) {
      byCoin[e.coinType] = (byCoin[e.coinType] || 0) + 1;
    }
  }
  console.log('\nBy coin type (top 10):');
  const sortedCoins = Object.entries(byCoin).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [coin, count] of sortedCoins) {
    console.log(`  ${coin}: ${count}`);
  }

  // Image stats
  console.log('\n=== Image Statistics ===');
  let totalSize = 0;
  let imageCount = 0;
  let smallImages = 0;
  let largeImages = 0;

  for (const e of metadata) {
    const imgPath = path.join(IMAGES_DIR, e.image);
    if (fs.existsSync(imgPath)) {
      const stats = fs.statSync(imgPath);
      totalSize += stats.size;
      imageCount++;
      if (stats.size < 10000) smallImages++;
      if (stats.size > 1000000) largeImages++;
    }
  }

  console.log(`Total images: ${imageCount}`);
  console.log(`Total size: ${formatBytes(totalSize)}`);
  console.log(`Average size: ${formatBytes(totalSize / imageCount)}`);
  console.log(`Small (<10KB, likely thumbnails): ${smallImages}`);
  console.log(`Large (>1MB, good quality): ${largeImages}`);

  // Grade distribution (if we had reveals)
  if (withGrade.length > 0) {
    console.log('\n=== Grade Distribution ===');
    const gradePrefix: Record<string, number> = {};
    for (const e of withGrade) {
      const match = e.revealedGrade!.match(/^(MS|AU|XF|EF|VF|F|VG|G|AG|PR|PF)/i);
      if (match) {
        const prefix = match[1].toUpperCase();
        gradePrefix[prefix] = (gradePrefix[prefix] || 0) + 1;
      }
    }
    for (const [prefix, count] of Object.entries(gradePrefix).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${prefix}: ${count}`);
    }
  }

  // Guess accuracy stats
  console.log('\n=== Guess Statistics ===');
  const guessCountDist: Record<number, number> = {};
  for (const e of metadata) {
    const count = e.guesses.length;
    guessCountDist[count] = (guessCountDist[count] || 0) + 1;
  }
  console.log('Guesses per post:');
  for (const [count, freq] of Object.entries(guessCountDist).sort((a, b) => Number(a) - Number(b))) {
    console.log(`  ${count}: ${freq} posts`);
  }

  // Data quality summary
  console.log('\n=== Data Quality Summary ===');
  const goodData = metadata.filter(m =>
    m.revealedGrade &&
    m.guesses.length >= 2 &&
    fs.existsSync(path.join(IMAGES_DIR, m.image)) &&
    fs.statSync(path.join(IMAGES_DIR, m.image)).size > 50000
  );
  console.log(`High-quality entries (grade + 2+ guesses + good image): ${goodData.length}`);

  const usableData = metadata.filter(m =>
    m.guesses.length >= 1 &&
    fs.existsSync(path.join(IMAGES_DIR, m.image)) &&
    fs.statSync(path.join(IMAGES_DIR, m.image)).size > 10000
  );
  console.log(`Usable entries (1+ guesses + decent image): ${usableData.length}`);

  // Next steps
  console.log('\n=== Recommendations ===');
  if (withGrade.length === 0) {
    console.log('- No revealed grades found. Consider:');
    console.log('  1. Manually adding grades from post comments');
    console.log('  2. Improving OP comment detection in scraper');
    console.log('  3. Scraping forums with better reveal structure');
  }
  if (smallImages > imageCount * 0.3) {
    console.log('- Many small images. Consider downloading higher resolution versions.');
  }
}

main().catch(console.error);

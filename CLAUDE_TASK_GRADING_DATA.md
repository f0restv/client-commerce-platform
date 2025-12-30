# Task: Run Grading Data Scrapers

## Objective
Execute existing scraper scripts to collect 500+ labeled coin images.

## Scripts to run
1. Check if scripts exist:
   - scripts/scrape-gtg-reddit.ts
   - scripts/scrape-ebay-trueview.ts
   
2. If they exist, run them:
   npx tsx scripts/scrape-gtg-reddit.ts
   npx tsx scripts/scrape-ebay-trueview.ts

3. If they don't exist, CREATE them:
   - Reddit scraper: fetch r/coins posts with "guess the grade", extract images + revealed grades. When implementing this scraper, use Reddit's official API where possible, respect documented API rate limits, and ensure full compliance with Reddit's terms of service and robots.txt; avoid aggressive scraping or downloading more data than is necessary for this task.
   - eBay scraper: search PCGS/NGC slabbed coins, download TrueView images

4. Output to:
   - data/grading-reference/[coin-type]/[grade]/
   - data/training/guess-the-grade/metadata.json

## Priority: Morgan dollars first

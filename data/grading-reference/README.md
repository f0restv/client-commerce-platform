# Visual Grading Reference Library

This directory contains reference images for AI-powered visual coin grading. The system compares submitted coin photos against authenticated reference images at known grades - the same way professional graders learn.

## Directory Structure

```
grading-reference/
├── index.json              # Index of available series
├── morgan-dollar/
│   ├── metadata.json       # Series metadata and grade list
│   ├── G4_obverse.jpg     # Grade reference images
│   ├── G4_reverse.jpg
│   ├── VG8_obverse.jpg
│   └── ...
├── peace-dollar/
├── walking-liberty-half/
└── ...
```

## Populating Reference Images

### Option 1: Playwright Scraper (PCGS Photograde)

```bash
# Scrape all major series
npx tsx scripts/scrape-photograde.ts --all

# Scrape a specific series
npx tsx scripts/scrape-photograde.ts --series morgan-dollar
```

Note: PCGS may block automated access. The scraper uses Playwright with a visible browser to handle this.

### Option 2: Manual Population

1. Download reference images from PCGS Photograde, Heritage Auctions, or NGC Coin Explorer
2. Name files as: `{GRADE}_obverse.jpg` and `{GRADE}_reverse.jpg` (e.g., `VF30_obverse.jpg`)
3. Place in the appropriate series folder
4. Update `metadata.json` with the file paths

### Option 3: Add Image URLs

Edit the series `metadata.json` to include URLs instead of local paths. The system will fetch them on demand.

## How Visual Comparison Works

1. **Coin Identification**: The AI first identifies the coin type (e.g., "1889 Morgan Dollar")

2. **Reference Loading**: Based on coin type, relevant reference images are loaded
   - If a preliminary grade estimate exists, images near that grade are prioritized
   - Otherwise, key benchmark grades are loaded (G-4, VF-20, EF-40, AU-58, MS-63, MS-65)

3. **Visual Comparison**: The AI compares the submitted coin to each reference:
   - Wear on high points (cheek, hair, eagle breast)
   - Luster characteristics
   - Surface quality and marks
   - Overall eye appeal

4. **Grade Determination**: The AI identifies which reference the coin most closely matches and whether it's slightly better or worse

## Integration with ProductIntelligence

```typescript
import { estimateGrade, estimateGradeWithTwoPass } from '@/lib/services/product-intelligence';

// Basic grading (uses visual comparison if available)
const grade = await estimateGrade(images, 'coin', {
  coinIdentification: '1889 Morgan Dollar',
  useVisualComparison: true,
});

// Two-pass grading (recommended for best accuracy)
// First pass: quick estimate without reference images
// Second pass: detailed comparison with nearby reference grades
const detailedGrade = await estimateGradeWithTwoPass(images, 'coin', {
  coinIdentification: '1889 Morgan Dollar',
});

console.log(grade.grade);                    // "VF-30"
console.log(grade.closestReference);         // "VF-30"
console.log(grade.comparisonNotes);          // "Wear on cheek matches VF-30 reference..."
console.log(grade.visualComparisonUsed);     // true
console.log(grade.referenceGradesCompared);  // ["VF-20", "VF-30", "EF-40", ...]
```

## Reference Image Sources

### Primary Sources
- **PCGS Photograde**: https://www.pcgs.com/photograde (86 series, ~2,580 images)
- **PCGS CoinFacts**: https://www.pcgs.com/coinfacts (subscription required)
- **NGC Coin Explorer**: https://www.ngccoin.com/coin-explorer

### Secondary Sources
- **Heritage Auctions**: https://coins.ha.com (free archive access)
- **GreatCollections**: https://www.greatcollections.com
- **CoinStudy.com**: https://www.coinstudy.com

## Supported Coin Types

| Series | Directory Name | Years |
|--------|---------------|-------|
| Morgan Dollar | morgan-dollar | 1878-1921 |
| Peace Dollar | peace-dollar | 1921-1935 |
| Walking Liberty Half | walking-liberty-half | 1916-1947 |
| Franklin Half | franklin-half | 1948-1963 |
| Kennedy Half | kennedy-half | 1964-present |
| Mercury Dime | mercury-dime | 1916-1945 |
| Buffalo Nickel | buffalo-nickel | 1913-1938 |
| Lincoln Wheat Cent | lincoln-wheat-cent | 1909-1958 |
| Saint-Gaudens $20 | saint-gaudens-double-eagle | 1907-1933 |
| Trade Dollar | trade-dollar | 1873-1885 |

## Grade Scale Reference

### Circulated Grades
- AG-3: About Good
- G-4/G-6: Good
- VG-8/VG-10: Very Good
- F-12/F-15: Fine
- VF-20/VF-25/VF-30/VF-35: Very Fine
- EF-40/EF-45: Extremely Fine
- AU-50/AU-53/AU-55/AU-58: About Uncirculated

### Mint State Grades
- MS-60 to MS-62: Basal Mint State
- MS-63/MS-64: Choice Mint State
- MS-65/MS-66: Gem Mint State
- MS-67/MS-68: Superb Gem
- MS-69/MS-70: Near Perfect/Perfect

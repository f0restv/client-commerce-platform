# Coin Grading Reference Image Sources

This document catalogs authoritative sources for photograde-style reference images used in coin grading.

## Primary Reference Sources

### PCGS Photograde Online
- **URL**: https://www.pcgs.com/photograde
- **Access**: Free
- **Coverage**: 86 popular US coin series, ~2,580 high-resolution photographs
- **Grade Range**: Poor-1 through MS-69 (varies by series)
- **Description**: The industry standard for visual grade comparison. Shows obverse and reverse at multiple grade levels. Morgan Dollars and Seated Liberty Quarters have up to 28-29 grade examples.

### PCGS TrueView
- **URL**: https://www.pcgs.com/trueview
- **Access**: $5 per coin (included with Gold Shield submissions)
- **Coverage**: Any coin submitted to PCGS for grading
- **Resolution**: 500 x 500 pixels with zoom capability
- **Description**: Professional photography service that captures coins before encapsulation. Excellent for seeing exactly what a specific grade looks like from PCGS's perspective.

### PCGS CoinFacts
- **URL**: https://www.pcgs.com/coinfacts
- **Access**: Subscription required for full access
- **Coverage**: Complete US coinage with historical auction data
- **Features**:
  - Population reports
  - Price guide data
  - Auction prices realized
  - Variety information
  - High-resolution images of type coins

### NGC Coin Explorer
- **URL**: https://www.ngccoin.com/coin-explorer/
- **Access**: Free
- **Coverage**: All NGC-graded coins
- **Features**:
  - Census data (population)
  - Auction prices realized
  - Images of graded examples
  - Variety attribution

### NGC Photo Vision
- **URL**: https://www.ngccoin.com/submit/services-fees/photo-vision/
- **Access**: Included with submission (various tiers)
- **Coverage**: NGC submissions
- **Description**: High-resolution imaging with multiple angle options

## Auction House Archives

### Heritage Auctions
- **URL**: https://coins.ha.com
- **Access**: Free (registration for full features)
- **Coverage**: Millions of auction lots dating back decades
- **Best For**:
  - Seeing real-world examples at every grade level
  - Understanding price/grade relationships
  - Viewing problem coins and details grades
  - Rare varieties and dates

### Stack's Bowers
- **URL**: https://stacksbowers.com/
- **Access**: Free archive access
- **Coverage**: Major numismatic auctions
- **Best For**: High-end rarities and specialized collections

### GreatCollections
- **URL**: https://www.greatcollections.com/
- **Access**: Free
- **Coverage**: Weekly auctions with extensive photography
- **Best For**: Mid-range to high-end coins with detailed images

## Educational Resources

### CoinStudy.com
- **URL**: https://www.coinstudy.com/
- **Access**: Free
- **Coverage**: Major US series with grade comparison guides
- **Best For**:
  - Morgan Dollar grading
  - Peace Dollar grading
  - Walking Liberty Half grading
  - Lincoln Wheat Cent grading
  - Buffalo Nickel grading
  - Mercury Dime grading

### CoinAuctionsHelp.com
- **URL**: https://coinauctionshelp.com/
- **Access**: Free
- **Coverage**: Popular US coin series
- **Best For**: Detailed photo comparisons showing grade transitions

### USA Coin Book
- **URL**: https://www.usacoinbook.com/
- **Access**: Free
- **Coverage**: All US coins
- **Features**: Values, images, and basic grading information

### American Numismatic Association (ANA)
- **URL**: https://www.money.org/
- **Access**: Free (some resources require membership)
- **Coverage**: Official ANA grading standards
- **Best For**:
  - Official grading set images
  - Educational materials
  - Grading courses and certification

## Specialty Resources

### CAC (Certified Acceptance Corporation)
- **URL**: https://www.caccoins.com/
- **Access**: Verification lookup is free
- **Coverage**: PCGS and NGC coins that meet CAC standards
- **Best For**: Understanding "premium quality for the grade"

### ANACS
- **URL**: https://www.anacs.com/
- **Access**: Verification database
- **Coverage**: ANACS-graded coins
- **Best For**: Historical grading perspective (oldest US grading service)

## Using Reference Images Effectively

### Comparison Methodology

1. **Match the series first**: Use images from the same coin type
2. **Compare wear points systematically**:
   - Start with critical areas (cheek, hair, eagle breast)
   - Move to secondary areas (wing tips, talons, etc.)
3. **Consider the whole coin**: Don't focus on just one area
4. **Account for strike variation**: Some coins appear worn but are actually weakly struck
5. **Check luster pattern**: True wear shows luster breaks; weak strike shows uniform dullness

### Grade Boundary Guidelines

When a coin falls between two reference images:

- **Conservative approach**: Grade to the lower level
- **Market approach**: Consider eye appeal and assign the grade it will sell at
- **Problem coins**: Always note issues regardless of technical grade

### Common Pitfalls

1. **Strike vs. wear confusion**: Check if "wear" appears on only one side or in unusual patterns
2. **Lighting tricks**: Examine under consistent, angled light
3. **Photography quality**: Reference images may show more or less detail than in-hand viewing
4. **Grade inflation**: PCGS Photograde images may be conservative compared to current market standards

## API Integration Notes

For automated grading systems:

1. **PCGS CoinFacts API**: Available for commercial partners
2. **NGC API**: Available for verified dealers
3. **Heritage API**: Available for research purposes
4. **Web scraping**: Generally prohibited by terms of service

## Recommended Workflow for ProductIntelligence

1. **Identification phase**: Determine coin type from images
2. **Load criteria**: Use `grading-criteria.ts` to get coin-specific wear points
3. **Generate prompt**: Use `generateAdaptiveGradingPrompt()` with coin identification
4. **Claude Vision analysis**: Submit images with specialized prompt
5. **Cross-reference**: Compare AI assessment with reference standards
6. **Problem detection**: Apply problem detection criteria
7. **Final grade**: Synthesize all factors into final assessment

## Sources Cited

- NGC Grading Scale: https://www.ngccoin.com/coin-grading/grading-scale/
- CoinStudy Grading Guides: https://www.coinstudy.com/
- CoinAuctionsHelp Grading: https://coinauctionshelp.com/
- ANA Grading Standards: https://www.money.org/
- PCGS Photograde: https://www.pcgs.com/photograde
- CoinWeek Sheldon Scale: https://coinweek.com/the-sheldon-scale-how-coins-are-graded/

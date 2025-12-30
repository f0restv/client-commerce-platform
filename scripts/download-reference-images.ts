/**
 * Download Reference Images from Public Domain Sources
 *
 * Downloads coin grading reference images from Wikimedia Commons
 * and other public domain sources.
 *
 * Usage: npx tsx scripts/download-reference-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const OUTPUT_DIR = path.join(process.cwd(), 'data/grading-reference');

// Curated list of public domain reference images from Wikimedia Commons
// These are real coin images that can be used as grading references
const REFERENCE_IMAGES: Record<string, {
  displayName: string;
  images: Array<{
    grade: string;
    numericGrade: number;
    obverseUrl?: string;
    reverseUrl?: string;
    source: string;
  }>;
}> = {
  'morgan-dollar': {
    displayName: 'Morgan Dollar',
    images: [
      // Various Morgan Dollar images from Wikimedia Commons
      {
        grade: 'VF-30',
        numericGrade: 30,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/23/1_Dollar_%22Morgan_Dollar%22_1896.png',
        source: 'wikimedia-commons',
      },
      {
        grade: 'EF-40',
        numericGrade: 40,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/74/1_Dollar_Morgan_-_1885_O.png',
        source: 'wikimedia-commons',
      },
      {
        grade: 'AU-55',
        numericGrade: 55,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/1_dollar_Morgan_1884.png',
        source: 'wikimedia-commons',
      },
      {
        grade: 'MS-63',
        numericGrade: 63,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/1879_Morgan_Dollar_%282294577611%29.jpg',
        source: 'wikimedia-commons',
      },
      {
        grade: 'MS-67',
        numericGrade: 67,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/1879S_Morgan_Dollar_NGC_MS67plus_Obverse.png',
        source: 'wikimedia-commons',
      },
    ],
  },
  'peace-dollar': {
    displayName: 'Peace Dollar',
    images: [
      {
        grade: 'MS-63',
        numericGrade: 63,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Peace_dollar.jpg',
        source: 'wikimedia-commons',
      },
    ],
  },
  'walking-liberty-half': {
    displayName: 'Walking Liberty Half Dollar',
    images: [
      {
        grade: 'MS-65',
        numericGrade: 65,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/US_50_Cent_obv.png',
        source: 'wikimedia-commons',
      },
    ],
  },
  'buffalo-nickel': {
    displayName: 'Buffalo Nickel',
    images: [
      {
        grade: 'EF-40',
        numericGrade: 40,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Indian_Head_Buffalo_Obverse.png',
        reverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/36/Indian_Head_Buffalo_Reverse.png',
        source: 'wikimedia-commons',
      },
    ],
  },
  'lincoln-wheat-cent': {
    displayName: 'Lincoln Wheat Cent',
    images: [
      {
        grade: 'MS-65',
        numericGrade: 65,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/US_One_Cent_Obv.png',
        reverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/37/US_One_Cent_Rev.png',
        source: 'wikimedia-commons',
      },
    ],
  },
  'mercury-dime': {
    displayName: 'Mercury Dime',
    images: [
      {
        grade: 'MS-65',
        numericGrade: 65,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Mercury_dime.png',
        source: 'wikimedia-commons',
      },
    ],
  },
  'saint-gaudens-double-eagle': {
    displayName: 'Saint-Gaudens Double Eagle',
    images: [
      {
        grade: 'MS-65',
        numericGrade: 65,
        obverseUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/60/NNC-US-1907-G%2420-Saint_Gaudens_%28Roman%29.jpg',
        source: 'wikimedia-commons',
      },
    ],
  },
};

function downloadFile(url: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outputPath);

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    }, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, outputPath).then(resolve);
        } else {
          resolve(false);
        }
      } else {
        console.error(`  HTTP ${response.statusCode} for ${url}`);
        file.close();
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        resolve(false);
      }
    }).on('error', (err) => {
      console.error(`  Error: ${err.message}`);
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      resolve(false);
    });
  });
}

async function main() {
  console.log('Reference Image Downloader');
  console.log('==========================');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const [seriesKey, series] of Object.entries(REFERENCE_IMAGES)) {
    const seriesDir = path.join(OUTPUT_DIR, seriesKey);
    if (!fs.existsSync(seriesDir)) {
      fs.mkdirSync(seriesDir, { recursive: true });
    }

    console.log(`\nProcessing ${series.displayName}...`);

    const grades: Array<{
      grade: string;
      numericGrade: number;
      obversePath: string | null;
      reversePath: string | null;
      obverseUrl: string | null;
      reverseUrl: string | null;
    }> = [];

    for (const img of series.images) {
      const gradeEntry = {
        grade: img.grade,
        numericGrade: img.numericGrade,
        obversePath: null as string | null,
        reversePath: null as string | null,
        obverseUrl: img.obverseUrl || null,
        reverseUrl: img.reverseUrl || null,
      };

      if (img.obverseUrl) {
        const ext = img.obverseUrl.includes('.png') ? '.png' : '.jpg';
        const fileName = `${img.grade.replace('-', '')}_obverse${ext}`;
        const outputPath = path.join(seriesDir, fileName);

        if (await downloadFile(img.obverseUrl, outputPath)) {
          gradeEntry.obversePath = outputPath;
          console.log(`  Downloaded ${img.grade} obverse`);
        }
      }

      if (img.reverseUrl) {
        const ext = img.reverseUrl.includes('.png') ? '.png' : '.jpg';
        const fileName = `${img.grade.replace('-', '')}_reverse${ext}`;
        const outputPath = path.join(seriesDir, fileName);

        if (await downloadFile(img.reverseUrl, outputPath)) {
          gradeEntry.reversePath = outputPath;
          console.log(`  Downloaded ${img.grade} reverse`);
        }
      }

      if (gradeEntry.obversePath || gradeEntry.reversePath) {
        grades.push(gradeEntry);
      }
    }

    // Save metadata
    const metadata = {
      series: seriesKey,
      displayName: series.displayName,
      scrapedAt: new Date().toISOString(),
      source: 'wikimedia-commons',
      grades,
    };

    fs.writeFileSync(
      path.join(seriesDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`  Saved ${grades.length} grades`);
  }

  // Update index
  const seriesList = Object.entries(REFERENCE_IMAGES).map(([key, series]) => ({
    name: key,
    displayName: series.displayName,
    gradeCount: series.images.length,
  }));

  const index = {
    updatedAt: new Date().toISOString(),
    source: 'wikimedia-commons',
    totalSeries: seriesList.length,
    series: seriesList,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  console.log('\n==========================');
  console.log('Download complete!');
}

main().catch(console.error);

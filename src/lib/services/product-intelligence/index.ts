export * from './types';
export { identify } from './identify';
export { estimateGrade } from './grade';
export {
  scrapeEbayComps,
  getEbayStats,
  getRedbookPrice,
  getGreysheetPrice,
  findCheapestBuyNow,
  fetchMarketData,
} from './market-data';
export { evaluate, quickEvaluate } from './evaluate';

import type {
  AnalysisResult,
  AnalysisOptions,
  IdentificationResult,
  GradeEstimate,
  MarketData,
  EvaluationResult,
} from './types';
import { identify } from './identify';
import { estimateGrade } from './grade';
import { fetchMarketData } from './market-data';
import { evaluate } from './evaluate';

type ImageInput = { type: 'url'; url: string } | { type: 'base64'; data: string; mediaType: string };

export async function analyze(
  images: ImageInput[],
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const { clientPayout, skipMarketData = false } = options;

  let identification: IdentificationResult;
  let grade: GradeEstimate;

  const [identResult, gradeResult] = await Promise.all([
    identify(images),
    identify(images).then((id) => estimateGrade(images, id.category)),
  ]);

  identification = identResult;
  grade = gradeResult;

  let marketData: MarketData;

  if (skipMarketData) {
    marketData = {
      ebayStats: null,
      redbookPrice: null,
      greysheetPrice: null,
      buyNow: null,
      unifiedPrices: null,
      estimatedValue: null,
      fetchedAt: new Date(),
    };
  } else {
    const coinDetails =
      identification.category === 'coin'
        ? {
            year: identification.year,
            denomination: identification.name,
            mint: identification.mint,
            grade: grade.grade,
          }
        : undefined;

    marketData = await fetchMarketData(
      identification.searchTerms,
      coinDetails,
      identification.category
    );
  }

  let evaluation: EvaluationResult | null = null;

  if (clientPayout !== undefined && clientPayout > 0) {
    evaluation = evaluate({
      clientPayout,
      marketData,
      grade,
    });
  }

  return {
    identification,
    grade,
    marketData,
    evaluation,
  };
}

export async function analyzeWithImages(
  imageUrls: string[],
  clientPayout?: number
): Promise<AnalysisResult> {
  const images: ImageInput[] = imageUrls.map((url) => ({
    type: 'url' as const,
    url,
  }));

  return analyze(images, { clientPayout });
}

export async function analyzeWithBase64(
  imagesBase64: Array<{ data: string; mediaType: string }>,
  clientPayout?: number
): Promise<AnalysisResult> {
  const images: ImageInput[] = imagesBase64.map((img) => ({
    type: 'base64' as const,
    data: img.data,
    mediaType: img.mediaType,
  }));

  return analyze(images, { clientPayout });
}

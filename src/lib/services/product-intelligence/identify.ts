import Anthropic from "@anthropic-ai/sdk";
import type {
  CollectibleCategory,
  IdentificationResult,
  CoinIdentificationResult,
  CurrencyIdentificationResult,
  SportsCardIdentificationResult,
  PokemonCardIdentificationResult,
} from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface IdentifyOptions {
  categoryHint?: CollectibleCategory;
  maxImages?: number;
}

interface ClaudeIdentificationResponse {
  category: CollectibleCategory;
  confidence: number;
  name: string;
  year?: number;
  certNumber?: string;
  searchTerms: string[];
  rawText?: string;
  // Coin fields
  mint?: string;
  mintMark?: string;
  denomination?: string;
  country?: string;
  composition?: string;
  variety?: string;
  pcgsNumber?: string;
  ngcNumber?: string;
  // Currency fields
  series?: string;
  serialNumber?: string;
  issuer?: string;
  signatureVariety?: string;
  blockLetter?: string;
  starNote?: boolean;
  // Sports card fields
  player?: string;
  team?: string;
  sport?: string;
  set?: string;
  cardNumber?: string;
  parallel?: string;
  insert?: string;
  autograph?: boolean;
  memorabilia?: boolean;
  serialNumbered?: string;
  manufacturer?: string;
  // Pokemon fields
  pokemonName?: string;
  setNumber?: string;
  rarity?: string;
  holoType?: string;
  edition?: string;
  language?: string;
  variant?: string;
}

const IDENTIFICATION_PROMPT = `You are an expert collectibles identifier specializing in coins, currency, sports cards, and Pokemon cards. Analyze the provided image(s) and identify the item with as much detail as possible.

IMPORTANT: Look carefully for:
1. CATEGORY - Determine if this is a coin, currency (paper money), sports card, or Pokemon card
2. CERTIFICATION - Look for slabs/holders from PCGS, NGC, PSA, BGS, CGC, PMG and extract the cert/serial number
3. YEAR/DATE - Find any dates on the item
4. For COINS: mint mark, denomination, country, variety, composition
5. For CARDS: player/character name, set name, card number, parallel/variant info

Generate searchTerms that would work well for eBay searches - include the most important identifying information in 2-4 search term variations.

Respond ONLY with a JSON object in this exact format:
{
  "category": "coin" | "currency" | "sports-card" | "pokemon",
  "confidence": <0.0-1.0>,
  "name": "<full item name/title>",
  "year": <number or null>,
  "certNumber": "<certification number if visible, or null>",
  "searchTerms": ["<term1>", "<term2>", ...],
  "rawText": "<any text visible on the item or holder>",

  // Include these for COINS:
  "mint": "<mint name if known>",
  "mintMark": "<mint mark letter if visible>",
  "denomination": "<denomination>",
  "country": "<country of origin>",
  "composition": "<metal composition if known>",
  "variety": "<variety name if applicable>",
  "pcgsNumber": "<PCGS catalog number if known>",
  "ngcNumber": "<NGC catalog number if known>",

  // Include these for CURRENCY:
  "series": "<series year/letter>",
  "serialNumber": "<serial number if visible>",
  "issuer": "<issuing bank/authority>",
  "signatureVariety": "<signature combination if known>",
  "blockLetter": "<block letter if applicable>",
  "starNote": <true if star/replacement note, false otherwise>,

  // Include these for SPORTS CARDS:
  "player": "<player name>",
  "team": "<team name>",
  "sport": "<sport: baseball, basketball, football, hockey, soccer, etc>",
  "set": "<set name and year>",
  "cardNumber": "<card number in set>",
  "parallel": "<parallel name if not base>",
  "insert": "<insert set name if applicable>",
  "autograph": <true if autographed>,
  "memorabilia": <true if has game-used material>,
  "serialNumbered": "<serial numbering like /99 if applicable>",
  "manufacturer": "<card manufacturer>",

  // Include these for POKEMON:
  "pokemonName": "<Pokemon name>",
  "set": "<set name>",
  "setNumber": "<set number like 025/185>",
  "cardNumber": "<card number>",
  "rarity": "<rarity symbol/level>",
  "holoType": "<holo pattern type if applicable>",
  "edition": "<1st edition, unlimited, etc>",
  "language": "<language if not English>",
  "variant": "<variant info if applicable>"
}

Only include fields relevant to the detected category. Use null for unknown required fields.`;

function getMediaType(base64: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg"; // Default to JPEG
}

function stripDataUrlPrefix(base64: string): string {
  const match = base64.match(/^data:image\/\w+;base64,(.+)$/);
  return match ? match[1] : base64;
}

function buildIdentificationResult(response: ClaudeIdentificationResponse): IdentificationResult {
  const base = {
    name: response.name,
    year: response.year,
    certNumber: response.certNumber,
    searchTerms: response.searchTerms,
    confidence: response.confidence,
    rawText: response.rawText,
  };

  switch (response.category) {
    case "coin":
      return {
        ...base,
        category: "coin",
        mint: response.mint,
        mintMark: response.mintMark,
        denomination: response.denomination,
        country: response.country,
        composition: response.composition,
        variety: response.variety,
        pcgsNumber: response.pcgsNumber,
        ngcNumber: response.ngcNumber,
      } as CoinIdentificationResult;

    case "currency":
      return {
        ...base,
        category: "currency",
        denomination: response.denomination,
        series: response.series,
        serialNumber: response.serialNumber,
        country: response.country,
        issuer: response.issuer,
        signatureVariety: response.signatureVariety,
        blockLetter: response.blockLetter,
        starNote: response.starNote,
      } as CurrencyIdentificationResult;

    case "sports-card":
      return {
        ...base,
        category: "sports-card",
        player: response.player || "Unknown Player",
        team: response.team,
        sport: response.sport,
        set: response.set || "Unknown Set",
        cardNumber: response.cardNumber,
        parallel: response.parallel,
        insert: response.insert,
        autograph: response.autograph,
        memorabilia: response.memorabilia,
        serialNumbered: response.serialNumbered,
        manufacturer: response.manufacturer,
      } as SportsCardIdentificationResult;

    case "pokemon":
      return {
        ...base,
        category: "pokemon",
        pokemonName: response.pokemonName || "Unknown Pokemon",
        set: response.set || "Unknown Set",
        setNumber: response.setNumber,
        cardNumber: response.cardNumber,
        rarity: response.rarity,
        holoType: response.holoType,
        edition: response.edition,
        language: response.language,
        variant: response.variant,
      } as PokemonCardIdentificationResult;

    default:
      // Default to coin if category is unrecognized
      return {
        ...base,
        category: "coin",
      } as CoinIdentificationResult;
  }
}

function createFallbackResult(category: CollectibleCategory = "coin"): IdentificationResult {
  const base = {
    name: "Unidentified Item",
    searchTerms: [],
    confidence: 0,
  };

  switch (category) {
    case "coin":
      return { ...base, category: "coin" } as CoinIdentificationResult;
    case "currency":
      return { ...base, category: "currency" } as CurrencyIdentificationResult;
    case "sports-card":
      return {
        ...base,
        category: "sports-card",
        player: "Unknown",
        set: "Unknown",
      } as SportsCardIdentificationResult;
    case "pokemon":
      return {
        ...base,
        category: "pokemon",
        pokemonName: "Unknown",
        set: "Unknown",
      } as PokemonCardIdentificationResult;
    default:
      return { ...base, category: "coin" } as CoinIdentificationResult;
  }
}

/**
 * Identify a collectible from one or more base64-encoded images using Claude Vision
 */
export async function identifyCollectible(
  images: string[],
  options: IdentifyOptions = {}
): Promise<IdentificationResult> {
  const { categoryHint, maxImages = 4 } = options;

  if (!images.length) {
    throw new Error("At least one image is required for identification");
  }

  // Limit number of images to avoid token limits
  const imagesToProcess = images.slice(0, maxImages);

  // Build image content blocks
  const imageBlocks: Anthropic.ImageBlockParam[] = imagesToProcess.map((img) => {
    const cleanBase64 = stripDataUrlPrefix(img);
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: getMediaType(cleanBase64),
        data: cleanBase64,
      },
    };
  });

  // Add category hint to prompt if provided
  let prompt = IDENTIFICATION_PROMPT;
  if (categoryHint) {
    prompt += `\n\nHINT: The user believes this is a ${categoryHint}. Verify this and provide identification accordingly.`;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const response = JSON.parse(jsonMatch[0]) as ClaudeIdentificationResponse;
    return buildIdentificationResult(response);
  } catch (error) {
    console.error("Collectible identification error:", error);
    return createFallbackResult(categoryHint);
  }
}

/**
 * Identify multiple collectibles from separate image sets
 */
export async function identifyMultipleCollectibles(
  imageSets: string[][],
  options: IdentifyOptions = {}
): Promise<IdentificationResult[]> {
  const results = await Promise.all(
    imageSets.map((images) => identifyCollectible(images, options))
  );
  return results;
}

/**
 * Quick category detection without full identification
 */
export async function detectCategory(
  image: string
): Promise<{ category: CollectibleCategory; confidence: number }> {
  const cleanBase64 = stripDataUrlPrefix(image);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: getMediaType(cleanBase64),
                data: cleanBase64,
              },
            },
            {
              type: "text",
              text: `What type of collectible is this? Respond with ONLY a JSON object:
{"category": "coin" | "currency" | "sports-card" | "pokemon", "confidence": <0.0-1.0>}`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Category detection error:", error);
    return { category: "coin", confidence: 0 };
  }
}

/**
 * Extract certification number from a slabbed item image
 */
export async function extractCertNumber(image: string): Promise<string | null> {
  const cleanBase64 = stripDataUrlPrefix(image);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: getMediaType(cleanBase64),
                data: cleanBase64,
              },
            },
            {
              type: "text",
              text: `Look for a certification/serial number on this graded collectible holder (PCGS, NGC, PSA, BGS, CGC, PMG).
The cert number is usually a long number printed on a label or barcode area.
Respond with ONLY the certification number, or "null" if not visible.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return null;
    }

    const text = content.text.trim();
    if (text.toLowerCase() === "null" || text.toLowerCase() === "none") {
      return null;
    }

    // Extract just the number portion
    const numberMatch = text.match(/\d[\d\s-]*/);
    return numberMatch ? numberMatch[0].replace(/[\s-]/g, "") : null;
  } catch (error) {
    console.error("Cert number extraction error:", error);
    return null;
  }
}

/**
 * Generate optimized eBay search terms from identification result
 */
export function generateSearchTerms(identification: IdentificationResult): string[] {
  const terms: string[] = [];

  // Always include certNumber search if available
  if (identification.certNumber) {
    terms.push(identification.certNumber);
  }

  switch (identification.category) {
    case "coin": {
      const coin = identification;
      // Primary search: Year + Denomination + Mint
      const primary = [coin.year, coin.denomination, coin.mintMark || coin.mint]
        .filter(Boolean)
        .join(" ");
      if (primary) terms.push(primary);

      // With variety
      if (coin.variety) {
        terms.push(`${primary} ${coin.variety}`);
      }

      // PCGS/NGC number search
      if (coin.pcgsNumber) terms.push(`PCGS ${coin.pcgsNumber}`);
      if (coin.ngcNumber) terms.push(`NGC ${coin.ngcNumber}`);
      break;
    }

    case "currency": {
      const currency = identification;
      const primary = [currency.year, currency.denomination, currency.series]
        .filter(Boolean)
        .join(" ");
      if (primary) terms.push(primary);

      if (currency.starNote) {
        terms.push(`${primary} star note`);
      }
      break;
    }

    case "sports-card": {
      const card = identification;
      // Player + Year + Set
      const primary = [card.year, card.player, card.set].filter(Boolean).join(" ");
      if (primary) terms.push(primary);

      // With card number
      if (card.cardNumber) {
        terms.push(`${card.player} ${card.set} #${card.cardNumber}`);
      }

      // With parallel
      if (card.parallel) {
        terms.push(`${card.player} ${card.set} ${card.parallel}`);
      }

      // PSA/BGS graded search
      if (card.manufacturer) {
        terms.push(`${card.year} ${card.manufacturer} ${card.player}`);
      }
      break;
    }

    case "pokemon": {
      const pokemon = identification;
      // Pokemon name + Set
      const primary = [pokemon.pokemonName, pokemon.set].filter(Boolean).join(" ");
      if (primary) terms.push(primary);

      // With set number
      if (pokemon.setNumber) {
        terms.push(`${pokemon.pokemonName} ${pokemon.setNumber}`);
      }

      // With edition
      if (pokemon.edition) {
        terms.push(`${pokemon.pokemonName} ${pokemon.set} ${pokemon.edition}`);
      }

      // Holo variant search
      if (pokemon.holoType) {
        terms.push(`${pokemon.pokemonName} ${pokemon.holoType}`);
      }
      break;
    }
  }

  // Add the full name as a fallback search
  if (identification.name && !terms.includes(identification.name)) {
    terms.push(identification.name);
  }

  // Deduplicate and clean up
  return [...new Set(terms)].filter((t) => t.length > 2);
}

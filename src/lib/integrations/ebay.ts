import { db } from "../db";
import type { Product, ProductImage } from "@prisma/client";

// =============================================================================
// Configuration Types
// =============================================================================

interface EbayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sandbox: boolean;
  devId?: string;
  appId?: string;
  certId?: string;
  siteId?: string;
}

interface EbayTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// =============================================================================
// Trading API Request/Response Types
// =============================================================================

type TradingApiHeaders = Record<string, string>;

interface EbayListingItem {
  itemId: string;
  title: string;
  sku?: string;
  price: number;
  currency: string;
  quantity: number;
  quantityAvailable?: number;
  listingStatus: string;
  listingType: string;
  startTime: Date;
  endTime?: Date;
  viewItemUrl: string;
  pictureUrls: string[];
  condition?: string;
  categoryId?: string;
  categoryName?: string;
}

interface AddItemRequest {
  title: string;
  description: string;
  primaryCategoryId: string;
  startPrice: number;
  quantity: number;
  listingDuration: string;
  listingType: "FixedPriceItem" | "Chinese"; // Chinese = Auction
  condition: string;
  conditionDescription?: string;
  pictureUrls: string[];
  sku?: string;
  paymentMethods?: string[];
  shippingDetails?: ShippingDetails;
  returnPolicy?: ReturnPolicy;
  itemSpecifics?: Record<string, string>;
  bestOfferEnabled?: boolean;
  storeCategoryId?: string;
}

interface ShippingDetails {
  shippingType: "Flat" | "Calculated" | "FreightFlat" | "Free";
  shippingServiceOptions?: ShippingServiceOption[];
  internationalShippingServiceOption?: ShippingServiceOption[];
}

interface ShippingServiceOption {
  shippingService: string;
  shippingServiceCost?: number;
  shippingServiceAdditionalCost?: number;
  freeShipping?: boolean;
  shipToLocations?: string[];
}

interface ReturnPolicy {
  returnsAccepted: boolean;
  returnsWithinOption?: string;
  refundOption?: string;
  shippingCostPaidByOption?: string;
  description?: string;
}

interface AddItemResponse {
  ack: "Success" | "Failure" | "Warning";
  itemId?: string;
  startTime?: Date;
  endTime?: Date;
  fees?: { name: string; amount: number }[];
  errors?: EbayError[];
  warnings?: EbayError[];
}

interface ReviseItemRequest {
  itemId: string;
  title?: string;
  description?: string;
  startPrice?: number;
  quantity?: number;
  pictureUrls?: string[];
  itemSpecifics?: Record<string, string>;
}

interface ReviseItemResponse {
  ack: "Success" | "Failure" | "Warning";
  itemId?: string;
  endTime?: Date;
  fees?: { name: string; amount: number }[];
  errors?: EbayError[];
  warnings?: EbayError[];
}

interface EndItemRequest {
  itemId: string;
  endingReason: "LostOrBroken" | "NotAvailable" | "Incorrect" | "OtherListingError" | "SellToHighBidder";
}

interface EndItemResponse {
  ack: "Success" | "Failure" | "Warning";
  endTime?: Date;
  errors?: EbayError[];
}

interface GetSellerListRequest {
  startTimeFrom?: Date;
  startTimeTo?: Date;
  endTimeFrom?: Date;
  endTimeTo?: Date;
  granularityLevel?: "Coarse" | "Medium" | "Fine";
  pagination?: {
    entriesPerPage: number;
    pageNumber: number;
  };
  sort?: "StartTime" | "EndTime" | "ItemId";
  includeVariations?: boolean;
}

interface GetSellerListResponse {
  ack: "Success" | "Failure" | "Warning";
  items: EbayListingItem[];
  paginationResult?: {
    totalNumberOfEntries: number;
    totalNumberOfPages: number;
  };
  hasMoreItems: boolean;
  errors?: EbayError[];
}

interface GetItemRequest {
  itemId: string;
  includeItemSpecifics?: boolean;
  includeWatchCount?: boolean;
  includeTaxTable?: boolean;
}

interface GetItemResponse {
  ack: "Success" | "Failure" | "Warning";
  item?: EbayListingItem & {
    description?: string;
    itemSpecifics?: Record<string, string>;
    watchCount?: number;
    hitCount?: number;
    seller?: {
      userId: string;
      feedbackScore: number;
      positiveFeedbackPercent: number;
    };
  };
  errors?: EbayError[];
}

interface EbayError {
  errorId: string;
  shortMessage: string;
  longMessage?: string;
  errorCode: string;
  severityCode: "Error" | "Warning";
  errorParameters?: Record<string, string>;
}

// =============================================================================
// Configuration & URL Helpers
// =============================================================================

const getConfig = (): EbayConfig => ({
  clientId: process.env.EBAY_CLIENT_ID!,
  clientSecret: process.env.EBAY_CLIENT_SECRET!,
  redirectUri: process.env.EBAY_REDIRECT_URI!,
  sandbox: process.env.EBAY_SANDBOX === "true",
  devId: process.env.EBAY_DEV_ID,
  appId: process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID,
  certId: process.env.EBAY_CERT_ID || process.env.EBAY_CLIENT_SECRET,
  siteId: process.env.EBAY_SITE_ID || "0", // 0 = US
});

const getBaseUrl = (sandbox: boolean) =>
  sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

const getAuthUrl = (sandbox: boolean) =>
  sandbox ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";

const getTradingApiUrl = (sandbox: boolean) =>
  sandbox
    ? "https://api.sandbox.ebay.com/ws/api.dll"
    : "https://api.ebay.com/ws/api.dll";

const TRADING_API_VERSION = "1225"; // Current stable version

export function getEbayAuthUrl(): string {
  const config = getConfig();
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  ];

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: scopes.join(" "),
  });

  return `${getAuthUrl(config.sandbox)}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeEbayCode(code: string): Promise<EbayTokens> {
  const config = getConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const response = await fetch(`${getAuthUrl(config.sandbox)}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`eBay token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  const tokens: EbayTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };

  // Store tokens in database
  await db.platformConnection.upsert({
    where: { platform: "EBAY" },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      isActive: true,
    },
    create: {
      platform: "EBAY",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      isActive: true,
    },
  });

  return tokens;
}

async function getAccessToken(): Promise<string> {
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  if (!connection || !connection.accessToken) {
    throw new Error("eBay not connected");
  }

  // Check if token needs refresh
  if (connection.expiresAt && connection.expiresAt < new Date()) {
    return refreshEbayToken(connection.refreshToken!);
  }

  return connection.accessToken;
}

interface RefreshTokenOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

async function refreshEbayToken(
  refreshToken: string,
  options: RefreshTokenOptions = {}
): Promise<string> {
  const { maxRetries = 3, retryDelayMs = 1000 } = options;
  const config = getConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${getAuthUrl(config.sandbox)}/identity/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: [
            "https://api.ebay.com/oauth/api_scope",
            "https://api.ebay.com/oauth/api_scope/sell.inventory",
            "https://api.ebay.com/oauth/api_scope/sell.marketing",
            "https://api.ebay.com/oauth/api_scope/sell.account",
            "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
          ].join(" "),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update tokens in database - also update refresh token if provided
        const updateData: {
          accessToken: string;
          expiresAt: Date;
          refreshToken?: string;
        } = {
          accessToken: data.access_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };

        // eBay may return a new refresh token
        if (data.refresh_token) {
          updateData.refreshToken = data.refresh_token;
        }

        await db.platformConnection.update({
          where: { platform: "EBAY" },
          data: updateData,
        });

        return data.access_token;
      }

      // Handle specific error codes
      const errorBody = await response.text();
      const statusCode = response.status;

      // 401/403 - Invalid refresh token, mark connection as inactive
      if (statusCode === 401 || statusCode === 403) {
        await db.platformConnection.update({
          where: { platform: "EBAY" },
          data: { isActive: false },
        });
        throw new Error(`eBay refresh token invalid. Please reconnect your eBay account.`);
      }

      // 429 - Rate limited, use exponential backoff
      if (statusCode === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
        await sleep(retryAfter * 1000);
        continue;
      }

      // 5xx - Server error, retry with backoff
      if (statusCode >= 500) {
        lastError = new Error(`eBay server error: ${statusCode} - ${errorBody}`);
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }

      // Other errors - don't retry
      throw new Error(`eBay token refresh failed: ${statusCode} - ${errorBody}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Please reconnect")) {
        throw error; // Don't retry auth errors
      }
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        await sleep(retryDelayMs * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error("eBay token refresh failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Force refresh the access token even if not expired.
 * Useful when a token is rejected by the API.
 */
export async function forceRefreshToken(): Promise<string> {
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  if (!connection?.refreshToken) {
    throw new Error("eBay not connected or no refresh token available");
  }

  return refreshEbayToken(connection.refreshToken, { maxRetries: 1 });
}

export async function createEbayListing(
  product: Product & { images: ProductImage[] }
): Promise<{ listingId: string; url: string }> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  // Create inventory item
  const sku = product.sku;
  const inventoryItem = {
    availability: {
      shipToLocationAvailability: {
        quantity: product.quantity,
      },
    },
    condition: mapCondition(product.condition),
    product: {
      title: product.title,
      description: product.description,
      imageUrls: product.images.map((img) => img.url),
      aspects: buildAspects(product),
    },
  };

  // Create/Update inventory item
  await fetch(`${getBaseUrl(config.sandbox)}/sell/inventory/v1/inventory_item/${sku}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
    },
    body: JSON.stringify(inventoryItem),
  });

  // Create offer
  const offer = {
    sku,
    marketplaceId: "EBAY_US",
    format: product.listingType === "AUCTION" ? "AUCTION" : "FIXED_PRICE",
    listingPolicies: {
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
    },
    pricingSummary: {
      price: {
        value: product.price?.toString() || "0",
        currency: "USD",
      },
    },
    categoryId: await getCategoryId(product),
  };

  const offerResponse = await fetch(`${getBaseUrl(config.sandbox)}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US",
    },
    body: JSON.stringify(offer),
  });

  if (!offerResponse.ok) {
    const error = await offerResponse.text();
    throw new Error(`Failed to create eBay offer: ${error}`);
  }

  const offerData = await offerResponse.json();

  // Publish offer
  const publishResponse = await fetch(
    `${getBaseUrl(config.sandbox)}/sell/inventory/v1/offer/${offerData.offerId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const publishData = await publishResponse.json();
  const listingId = publishData.listingId;

  // Store in database
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  await db.platformListing.create({
    data: {
      productId: product.id,
      connectionId: connection!.id,
      externalId: listingId,
      externalUrl: `https://www.ebay.com/itm/${listingId}`,
      status: "ACTIVE",
      lastSyncAt: new Date(),
    },
  });

  return {
    listingId,
    url: `https://www.ebay.com/itm/${listingId}`,
  };
}

export async function endEbayListing(listingId: string): Promise<void> {
  const config = getConfig();
  const accessToken = await getAccessToken();

  await fetch(
    `${getBaseUrl(config.sandbox)}/sell/inventory/v1/offer/${listingId}/withdraw`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  await db.platformListing.updateMany({
    where: { externalId: listingId },
    data: { status: "REMOVED" },
  });
}

function mapCondition(condition?: string | null): string {
  const conditionMap: Record<string, string> = {
    new: "NEW",
    "like new": "LIKE_NEW",
    "very good": "VERY_GOOD",
    good: "GOOD",
    acceptable: "ACCEPTABLE",
    used: "USED_EXCELLENT",
  };
  return conditionMap[condition?.toLowerCase() || ""] || "USED_EXCELLENT";
}

function buildAspects(product: Product): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};

  if (product.year) aspects["Year"] = [product.year.toString()];
  if (product.mint) aspects["Mint Location"] = [product.mint];
  if (product.grade) aspects["Grade"] = [product.grade];
  if (product.certification) aspects["Certification"] = [product.certification];

  return aspects;
}

async function getCategoryId(product: Product): Promise<string> {
  // Default to "Coins & Paper Money" category
  // In production, this would map to specific eBay categories
  return "11116"; // US Coins category
}

// =============================================================================
// Trading API Core Functions
// =============================================================================

/**
 * Get Trading API headers for a specific call
 */
function getTradingApiHeaders(callName: string): TradingApiHeaders {
  const config = getConfig();
  return {
    "X-EBAY-API-SITEID": config.siteId || "0",
    "X-EBAY-API-COMPATIBILITY-LEVEL": TRADING_API_VERSION,
    "X-EBAY-API-CALL-NAME": callName,
    "X-EBAY-API-APP-NAME": config.appId || config.clientId,
    "X-EBAY-API-DEV-NAME": config.devId || "",
    "X-EBAY-API-CERT-NAME": config.certId || config.clientSecret,
    "Content-Type": "text/xml",
  };
}

/**
 * Execute a Trading API call with automatic token refresh on auth errors
 */
async function executeTradingApiCall<T>(
  callName: string,
  xmlBody: string,
  parseResponse: (xml: string) => T
): Promise<T> {
  const config = getConfig();
  const headers = getTradingApiHeaders(callName);

  let accessToken = await getAccessToken();

  // Build full XML request
  const fullXml = buildTradingApiRequest(callName, accessToken, xmlBody);

  let response = await fetch(getTradingApiUrl(config.sandbox), {
    method: "POST",
    headers,
    body: fullXml,
  });

  let responseText = await response.text();

  // Check for auth errors and retry with refreshed token
  if (responseText.includes("<ErrorCode>931</ErrorCode>") ||
      responseText.includes("<ErrorCode>932</ErrorCode>") ||
      responseText.includes("Auth token is invalid")) {
    accessToken = await forceRefreshToken();
    const retryXml = buildTradingApiRequest(callName, accessToken, xmlBody);

    response = await fetch(getTradingApiUrl(config.sandbox), {
      method: "POST",
      headers,
      body: retryXml,
    });

    responseText = await response.text();
  }

  return parseResponse(responseText);
}

/**
 * Build the XML wrapper for Trading API requests
 */
function buildTradingApiRequest(callName: string, accessToken: string, innerXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${escapeXml(accessToken)}</eBayAuthToken>
  </RequesterCredentials>
  ${innerXml}
</${callName}Request>`;
}

/**
 * Escape special characters for XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extract a single XML element value
 */
function extractXmlValue(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Extract all occurrences of an XML element
 */
function extractXmlValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "gi");
  const values: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1]);
  }
  return values;
}

/**
 * Extract an XML block (element with children)
 */
function extractXmlBlock(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[0] : undefined;
}

/**
 * Extract all XML blocks for a given tag
 */
function extractXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return xml.match(regex) || [];
}

/**
 * Parse eBay errors from XML response
 */
function parseEbayErrors(xml: string): EbayError[] {
  const errorBlocks = extractXmlBlocks(xml, "Errors");
  return errorBlocks.map((block) => ({
    errorId: extractXmlValue(block, "ErrorId") || "",
    shortMessage: extractXmlValue(block, "ShortMessage") || "",
    longMessage: extractXmlValue(block, "LongMessage"),
    errorCode: extractXmlValue(block, "ErrorCode") || "",
    severityCode: (extractXmlValue(block, "SeverityCode") as "Error" | "Warning") || "Error",
  }));
}

// =============================================================================
// Trading API: AddItem (Create Listing)
// =============================================================================

/**
 * Create a new eBay listing using the Trading API AddItem call
 */
export async function createListing(request: AddItemRequest): Promise<AddItemResponse> {
  const itemXml = buildAddItemXml(request);

  return executeTradingApiCall("AddItem", itemXml, (xml) => {
    const ack = extractXmlValue(xml, "Ack") as AddItemResponse["ack"];
    const errors = parseEbayErrors(xml);

    const response: AddItemResponse = {
      ack,
      itemId: extractXmlValue(xml, "ItemID"),
      startTime: extractXmlValue(xml, "StartTime") ? new Date(extractXmlValue(xml, "StartTime")!) : undefined,
      endTime: extractXmlValue(xml, "EndTime") ? new Date(extractXmlValue(xml, "EndTime")!) : undefined,
      errors: errors.filter((e) => e.severityCode === "Error"),
      warnings: errors.filter((e) => e.severityCode === "Warning"),
      fees: parseFees(xml),
    };

    return response;
  });
}

function buildAddItemXml(request: AddItemRequest): string {
  const specificsXml = request.itemSpecifics
    ? `<ItemSpecifics>
        ${Object.entries(request.itemSpecifics)
          .map(
            ([name, value]) => `
          <NameValueList>
            <Name>${escapeXml(name)}</Name>
            <Value>${escapeXml(value)}</Value>
          </NameValueList>`
          )
          .join("")}
      </ItemSpecifics>`
    : "";

  const picturesXml = request.pictureUrls.length > 0
    ? `<PictureDetails>
        ${request.pictureUrls.map((url) => `<PictureURL>${escapeXml(url)}</PictureURL>`).join("")}
      </PictureDetails>`
    : "";

  const shippingXml = request.shippingDetails
    ? buildShippingXml(request.shippingDetails)
    : "";

  const returnPolicyXml = request.returnPolicy
    ? buildReturnPolicyXml(request.returnPolicy)
    : "";

  return `
  <Item>
    <Title>${escapeXml(request.title)}</Title>
    <Description><![CDATA[${request.description}]]></Description>
    <PrimaryCategory>
      <CategoryID>${request.primaryCategoryId}</CategoryID>
    </PrimaryCategory>
    <StartPrice currencyID="USD">${request.startPrice.toFixed(2)}</StartPrice>
    <Quantity>${request.quantity}</Quantity>
    <ListingDuration>${request.listingDuration}</ListingDuration>
    <ListingType>${request.listingType}</ListingType>
    <ConditionID>${mapConditionToId(request.condition)}</ConditionID>
    ${request.conditionDescription ? `<ConditionDescription>${escapeXml(request.conditionDescription)}</ConditionDescription>` : ""}
    ${request.sku ? `<SKU>${escapeXml(request.sku)}</SKU>` : ""}
    ${picturesXml}
    ${specificsXml}
    ${shippingXml}
    ${returnPolicyXml}
    ${request.bestOfferEnabled ? "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>" : ""}
    ${request.storeCategoryId ? `<Storefront><StoreCategoryID>${request.storeCategoryId}</StoreCategoryID></Storefront>` : ""}
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <PaymentMethods>PayPal</PaymentMethods>
    <PayPalEmailAddress>${process.env.EBAY_PAYPAL_EMAIL || ""}</PayPalEmailAddress>
  </Item>`;
}

function buildShippingXml(shipping: ShippingDetails): string {
  let servicesXml = "";

  if (shipping.shippingServiceOptions) {
    servicesXml = shipping.shippingServiceOptions
      .map(
        (svc, idx) => `
        <ShippingServiceOptions>
          <ShippingServicePriority>${idx + 1}</ShippingServicePriority>
          <ShippingService>${svc.shippingService}</ShippingService>
          ${svc.shippingServiceCost !== undefined ? `<ShippingServiceCost currencyID="USD">${svc.shippingServiceCost.toFixed(2)}</ShippingServiceCost>` : ""}
          ${svc.shippingServiceAdditionalCost !== undefined ? `<ShippingServiceAdditionalCost currencyID="USD">${svc.shippingServiceAdditionalCost.toFixed(2)}</ShippingServiceAdditionalCost>` : ""}
          ${svc.freeShipping ? "<FreeShipping>true</FreeShipping>" : ""}
        </ShippingServiceOptions>`
      )
      .join("");
  }

  return `
  <ShippingDetails>
    <ShippingType>${shipping.shippingType}</ShippingType>
    ${servicesXml}
  </ShippingDetails>`;
}

function buildReturnPolicyXml(policy: ReturnPolicy): string {
  return `
  <ReturnPolicy>
    <ReturnsAcceptedOption>${policy.returnsAccepted ? "ReturnsAccepted" : "ReturnsNotAccepted"}</ReturnsAcceptedOption>
    ${policy.returnsWithinOption ? `<ReturnsWithinOption>${policy.returnsWithinOption}</ReturnsWithinOption>` : ""}
    ${policy.refundOption ? `<RefundOption>${policy.refundOption}</RefundOption>` : ""}
    ${policy.shippingCostPaidByOption ? `<ShippingCostPaidByOption>${policy.shippingCostPaidByOption}</ShippingCostPaidByOption>` : ""}
    ${policy.description ? `<Description>${escapeXml(policy.description)}</Description>` : ""}
  </ReturnPolicy>`;
}

function mapConditionToId(condition: string): string {
  const conditionMap: Record<string, string> = {
    new: "1000",
    "new other": "1500",
    "new with defects": "1750",
    "manufacturer refurbished": "2000",
    "seller refurbished": "2500",
    "like new": "2750",
    "used - excellent": "3000",
    excellent: "3000",
    "used - very good": "4000",
    "very good": "4000",
    "used - good": "5000",
    good: "5000",
    "used - acceptable": "6000",
    acceptable: "6000",
    "for parts": "7000",
  };
  return conditionMap[condition.toLowerCase()] || "3000";
}

function parseFees(xml: string): { name: string; amount: number }[] {
  const feeBlocks = extractXmlBlocks(xml, "Fee");
  return feeBlocks.map((block) => ({
    name: extractXmlValue(block, "Name") || "",
    amount: parseFloat(extractXmlValue(block, "Amount") || "0"),
  }));
}

// =============================================================================
// Trading API: ReviseItem (Update Listing)
// =============================================================================

/**
 * Update an existing eBay listing using the Trading API ReviseItem call
 */
export async function updateListing(request: ReviseItemRequest): Promise<ReviseItemResponse> {
  const itemXml = buildReviseItemXml(request);

  return executeTradingApiCall("ReviseItem", itemXml, (xml) => {
    const ack = extractXmlValue(xml, "Ack") as ReviseItemResponse["ack"];
    const errors = parseEbayErrors(xml);

    return {
      ack,
      itemId: extractXmlValue(xml, "ItemID"),
      endTime: extractXmlValue(xml, "EndTime") ? new Date(extractXmlValue(xml, "EndTime")!) : undefined,
      errors: errors.filter((e) => e.severityCode === "Error"),
      warnings: errors.filter((e) => e.severityCode === "Warning"),
      fees: parseFees(xml),
    };
  });
}

function buildReviseItemXml(request: ReviseItemRequest): string {
  const specificsXml =
    request.itemSpecifics
      ? `<ItemSpecifics>
          ${Object.entries(request.itemSpecifics)
            .map(
              ([name, value]) => `
            <NameValueList>
              <Name>${escapeXml(name)}</Name>
              <Value>${escapeXml(value)}</Value>
            </NameValueList>`
            )
            .join("")}
        </ItemSpecifics>`
      : "";

  const picturesXml =
    request.pictureUrls && request.pictureUrls.length > 0
      ? `<PictureDetails>
          ${request.pictureUrls.map((url) => `<PictureURL>${escapeXml(url)}</PictureURL>`).join("")}
        </PictureDetails>`
      : "";

  return `
  <Item>
    <ItemID>${request.itemId}</ItemID>
    ${request.title ? `<Title>${escapeXml(request.title)}</Title>` : ""}
    ${request.description ? `<Description><![CDATA[${request.description}]]></Description>` : ""}
    ${request.startPrice !== undefined ? `<StartPrice currencyID="USD">${request.startPrice.toFixed(2)}</StartPrice>` : ""}
    ${request.quantity !== undefined ? `<Quantity>${request.quantity}</Quantity>` : ""}
    ${picturesXml}
    ${specificsXml}
  </Item>`;
}

// =============================================================================
// Trading API: EndItem (End Listing)
// =============================================================================

/**
 * End an eBay listing using the Trading API EndItem call
 */
export async function endListing(request: EndItemRequest): Promise<EndItemResponse> {
  const itemXml = `
  <ItemID>${request.itemId}</ItemID>
  <EndingReason>${request.endingReason}</EndingReason>`;

  const response = await executeTradingApiCall("EndItem", itemXml, (xml) => {
    const ack = extractXmlValue(xml, "Ack") as EndItemResponse["ack"];
    const errors = parseEbayErrors(xml);

    return {
      ack,
      endTime: extractXmlValue(xml, "EndTime") ? new Date(extractXmlValue(xml, "EndTime")!) : undefined,
      errors: errors.filter((e) => e.severityCode === "Error"),
    };
  });

  // Update database if successful
  if (response.ack === "Success" || response.ack === "Warning") {
    await db.platformListing.updateMany({
      where: { externalId: request.itemId },
      data: { status: "ENDED" },
    });
  }

  return response;
}

// =============================================================================
// Trading API: GetSellerList (List Seller's Items)
// =============================================================================

/**
 * Get a list of the seller's items using the Trading API GetSellerList call
 */
export async function getSellerList(
  request: GetSellerListRequest = {}
): Promise<GetSellerListResponse> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Default to listings ending in the next 30 days
  const endTimeFrom = request.endTimeFrom || now;
  const endTimeTo = request.endTimeTo || thirtyDaysFromNow;

  const paginationXml = request.pagination
    ? `<Pagination>
        <EntriesPerPage>${request.pagination.entriesPerPage}</EntriesPerPage>
        <PageNumber>${request.pagination.pageNumber}</PageNumber>
      </Pagination>`
    : `<Pagination>
        <EntriesPerPage>100</EntriesPerPage>
        <PageNumber>1</PageNumber>
      </Pagination>`;

  const requestXml = `
  <EndTimeFrom>${endTimeFrom.toISOString()}</EndTimeFrom>
  <EndTimeTo>${endTimeTo.toISOString()}</EndTimeTo>
  ${request.startTimeFrom ? `<StartTimeFrom>${request.startTimeFrom.toISOString()}</StartTimeFrom>` : ""}
  ${request.startTimeTo ? `<StartTimeTo>${request.startTimeTo.toISOString()}</StartTimeTo>` : ""}
  <GranularityLevel>${request.granularityLevel || "Medium"}</GranularityLevel>
  ${paginationXml}
  ${request.sort ? `<Sort>${request.sort}</Sort>` : ""}
  ${request.includeVariations ? "<IncludeVariations>true</IncludeVariations>" : ""}
  <OutputSelector>ItemID</OutputSelector>
  <OutputSelector>Title</OutputSelector>
  <OutputSelector>SKU</OutputSelector>
  <OutputSelector>CurrentPrice</OutputSelector>
  <OutputSelector>Quantity</OutputSelector>
  <OutputSelector>QuantityAvailable</OutputSelector>
  <OutputSelector>ListingType</OutputSelector>
  <OutputSelector>StartTime</OutputSelector>
  <OutputSelector>EndTime</OutputSelector>
  <OutputSelector>ViewItemURL</OutputSelector>
  <OutputSelector>PictureDetails</OutputSelector>
  <OutputSelector>ConditionID</OutputSelector>
  <OutputSelector>ConditionDisplayName</OutputSelector>
  <OutputSelector>PrimaryCategory</OutputSelector>
  <OutputSelector>SellingStatus</OutputSelector>`;

  return executeTradingApiCall("GetSellerList", requestXml, (xml) => {
    const ack = extractXmlValue(xml, "Ack") as GetSellerListResponse["ack"];
    const errors = parseEbayErrors(xml);

    const itemBlocks = extractXmlBlocks(xml, "Item");
    const items = itemBlocks.map(parseItemFromXml);

    const totalEntries = parseInt(extractXmlValue(xml, "TotalNumberOfEntries") || "0", 10);
    const totalPages = parseInt(extractXmlValue(xml, "TotalNumberOfPages") || "1", 10);
    const hasMore = extractXmlValue(xml, "HasMoreItems") === "true";

    return {
      ack,
      items,
      paginationResult: {
        totalNumberOfEntries: totalEntries,
        totalNumberOfPages: totalPages,
      },
      hasMoreItems: hasMore,
      errors: errors.filter((e) => e.severityCode === "Error"),
    };
  });
}

function parseItemFromXml(itemXml: string): EbayListingItem {
  const sellingStatus = extractXmlBlock(itemXml, "SellingStatus");
  const currentPriceStr = sellingStatus
    ? extractXmlValue(sellingStatus, "CurrentPrice")
    : extractXmlValue(itemXml, "CurrentPrice");

  const pictureDetails = extractXmlBlock(itemXml, "PictureDetails");
  const pictureUrls = pictureDetails ? extractXmlValues(pictureDetails, "PictureURL") : [];

  const primaryCategory = extractXmlBlock(itemXml, "PrimaryCategory");

  return {
    itemId: extractXmlValue(itemXml, "ItemID") || "",
    title: extractXmlValue(itemXml, "Title") || "",
    sku: extractXmlValue(itemXml, "SKU"),
    price: parseFloat(currentPriceStr || "0"),
    currency: "USD",
    quantity: parseInt(extractXmlValue(itemXml, "Quantity") || "1", 10),
    quantityAvailable: extractXmlValue(itemXml, "QuantityAvailable")
      ? parseInt(extractXmlValue(itemXml, "QuantityAvailable")!, 10)
      : undefined,
    listingStatus: sellingStatus ? extractXmlValue(sellingStatus, "ListingStatus") || "Active" : "Active",
    listingType: extractXmlValue(itemXml, "ListingType") || "FixedPriceItem",
    startTime: new Date(extractXmlValue(itemXml, "StartTime") || Date.now()),
    endTime: extractXmlValue(itemXml, "EndTime") ? new Date(extractXmlValue(itemXml, "EndTime")!) : undefined,
    viewItemUrl: extractXmlValue(itemXml, "ViewItemURL") || "",
    pictureUrls,
    condition: extractXmlValue(itemXml, "ConditionDisplayName"),
    categoryId: primaryCategory ? extractXmlValue(primaryCategory, "CategoryID") : undefined,
    categoryName: primaryCategory ? extractXmlValue(primaryCategory, "CategoryName") : undefined,
  };
}

// =============================================================================
// Trading API: GetItem (Get Single Item Details)
// =============================================================================

/**
 * Get detailed information about a single eBay item using the Trading API GetItem call
 */
export async function getItem(request: GetItemRequest): Promise<GetItemResponse> {
  const requestXml = `
  <ItemID>${request.itemId}</ItemID>
  <IncludeItemSpecifics>${request.includeItemSpecifics !== false}</IncludeItemSpecifics>
  <IncludeWatchCount>${request.includeWatchCount === true}</IncludeWatchCount>
  ${request.includeTaxTable ? "<IncludeTaxTable>true</IncludeTaxTable>" : ""}
  <DetailLevel>ReturnAll</DetailLevel>`;

  return executeTradingApiCall("GetItem", requestXml, (xml) => {
    const ack = extractXmlValue(xml, "Ack") as GetItemResponse["ack"];
    const errors = parseEbayErrors(xml);

    if (ack === "Failure") {
      return {
        ack,
        errors: errors.filter((e) => e.severityCode === "Error"),
      };
    }

    const itemBlock = extractXmlBlock(xml, "Item");
    if (!itemBlock) {
      return {
        ack: "Failure",
        errors: [{ errorId: "0", shortMessage: "No item data returned", errorCode: "0", severityCode: "Error" }],
      };
    }

    const baseItem = parseItemFromXml(itemBlock);

    // Parse item specifics
    const itemSpecifics: Record<string, string> = {};
    const specificsBlock = extractXmlBlock(itemBlock, "ItemSpecifics");
    if (specificsBlock) {
      const nameValueLists = extractXmlBlocks(specificsBlock, "NameValueList");
      for (const nvl of nameValueLists) {
        const name = extractXmlValue(nvl, "Name");
        const value = extractXmlValue(nvl, "Value");
        if (name && value) {
          itemSpecifics[name] = value;
        }
      }
    }

    // Parse seller info
    const sellerBlock = extractXmlBlock(itemBlock, "Seller");
    const seller = sellerBlock
      ? {
          userId: extractXmlValue(sellerBlock, "UserID") || "",
          feedbackScore: parseInt(extractXmlValue(sellerBlock, "FeedbackScore") || "0", 10),
          positiveFeedbackPercent: parseFloat(extractXmlValue(sellerBlock, "PositiveFeedbackPercent") || "0"),
        }
      : undefined;

    return {
      ack,
      item: {
        ...baseItem,
        description: extractXmlValue(itemBlock, "Description"),
        itemSpecifics: Object.keys(itemSpecifics).length > 0 ? itemSpecifics : undefined,
        watchCount: extractXmlValue(itemBlock, "WatchCount")
          ? parseInt(extractXmlValue(itemBlock, "WatchCount")!, 10)
          : undefined,
        hitCount: extractXmlValue(itemBlock, "HitCount")
          ? parseInt(extractXmlValue(itemBlock, "HitCount")!, 10)
          : undefined,
        seller,
      },
      errors: errors.filter((e) => e.severityCode === "Error"),
    };
  });
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a listing from a Product model (combines with existing createEbayListing)
 */
export async function createListingFromProduct(
  product: Product & { images: ProductImage[] }
): Promise<AddItemResponse> {
  const request: AddItemRequest = {
    title: product.title,
    description: product.description || "",
    primaryCategoryId: await getCategoryId(product),
    startPrice: parseFloat(product.price?.toString() || "0"),
    quantity: product.quantity || 1,
    listingDuration: product.listingType === "AUCTION" ? "Days_7" : "GTC",
    listingType: product.listingType === "AUCTION" ? "Chinese" : "FixedPriceItem",
    condition: product.condition || "used",
    pictureUrls: product.images.map((img) => img.url),
    sku: product.sku || undefined,
    itemSpecifics: buildAspects(product) as unknown as Record<string, string>,
    returnPolicy: {
      returnsAccepted: true,
      returnsWithinOption: "Days_30",
      refundOption: "MoneyBack",
      shippingCostPaidByOption: "Buyer",
    },
    shippingDetails: {
      shippingType: "Flat",
      shippingServiceOptions: [
        {
          shippingService: "USPSFirstClass",
          shippingServiceCost: 4.99,
        },
      ],
    },
  };

  const response = await createListing(request);

  // Store in database if successful
  if (response.ack === "Success" || response.ack === "Warning") {
    const connection = await db.platformConnection.findUnique({
      where: { platform: "EBAY" },
    });

    if (connection && response.itemId) {
      await db.platformListing.upsert({
        where: {
          productId_connectionId: {
            productId: product.id,
            connectionId: connection.id,
          },
        },
        update: {
          externalId: response.itemId,
          externalUrl: `https://www.ebay.com/itm/${response.itemId}`,
          status: "ACTIVE",
          lastSyncAt: new Date(),
        },
        create: {
          productId: product.id,
          connectionId: connection.id,
          externalId: response.itemId,
          externalUrl: `https://www.ebay.com/itm/${response.itemId}`,
          status: "ACTIVE",
          lastSyncAt: new Date(),
        },
      });
    }
  }

  return response;
}

/**
 * Sync all active eBay listings to the database
 */
export async function syncSellerListings(): Promise<{
  synced: number;
  errors: string[];
}> {
  const connection = await db.platformConnection.findUnique({
    where: { platform: "EBAY" },
  });

  if (!connection) {
    return { synced: 0, errors: ["eBay not connected"] };
  }

  const errors: string[] = [];
  let synced = 0;
  let pageNumber = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await getSellerList({
      pagination: { entriesPerPage: 100, pageNumber },
      granularityLevel: "Medium",
    });

    if (response.ack === "Failure") {
      errors.push(...(response.errors?.map((e) => e.shortMessage) || []));
      break;
    }

    for (const item of response.items) {
      try {
        // Find existing listing by SKU or external ID
        const existingListing = await db.platformListing.findFirst({
          where: {
            connectionId: connection.id,
            externalId: item.itemId,
          },
        });

        if (existingListing) {
          await db.platformListing.update({
            where: { id: existingListing.id },
            data: {
              status: item.listingStatus === "Active" ? "ACTIVE" : "ENDED",
              lastSyncAt: new Date(),
            },
          });
        }
        synced++;
      } catch (err) {
        errors.push(`Failed to sync item ${item.itemId}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    hasMore = response.hasMoreItems;
    pageNumber++;

    // Safety limit
    if (pageNumber > 50) break;
  }

  return { synced, errors };
}

// =============================================================================
// Type Exports
// =============================================================================

export type {
  EbayConfig,
  EbayTokens,
  EbayListingItem,
  AddItemRequest,
  AddItemResponse,
  ReviseItemRequest,
  ReviseItemResponse,
  EndItemRequest,
  EndItemResponse,
  GetSellerListRequest,
  GetSellerListResponse,
  GetItemRequest,
  GetItemResponse,
  EbayError,
  ShippingDetails,
  ShippingServiceOption,
  ReturnPolicy,
};

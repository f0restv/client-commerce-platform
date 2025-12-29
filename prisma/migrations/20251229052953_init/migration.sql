-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF', 'CLIENT', 'BUYER');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEBSITE', 'EBAY_STORE', 'ETSY_SHOP', 'SHOPIFY', 'SQUARESPACE', 'WOOCOMMERCE', 'AUCTIONZIP', 'HIBID', 'PROXIBID', 'CSV_IMPORT', 'API');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StripePayoutStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('BUY_NOW', 'AUCTION', 'BOTH');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SOLD', 'RESERVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MetalType" AS ENUM ('GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'COPPER', 'NONE');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'SOLD', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'LISTED', 'SOLD', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('CONSIGNMENT_SALE', 'PURCHASE', 'LISTING_FEES', 'PAYOUT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('EBAY', 'ETSY', 'AUCTIONFLEX360', 'WHATNOT', 'HIBID', 'PROXIBID');

-- CreateEnum
CREATE TYPE "PlatformListStatus" AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'ENDED', 'ERROR', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BID_OUTBID', 'AUCTION_WON', 'AUCTION_ENDED', 'SUBMISSION_UPDATE', 'INVOICE_READY', 'PAYMENT_RECEIVED', 'ORDER_SHIPPED', 'PRICE_DROP', 'PRICE_ALERT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PriceAlertType" AS ENUM ('BELOW_PRICE', 'ABOVE_PRICE', 'ANY_LISTING');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notificationPreferences" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street1" TEXT NOT NULL,
    "street2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "website" TEXT,
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "stripeAccountId" TEXT,
    "stripeAccountStatus" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scrapeFrequency" INTEGER NOT NULL DEFAULT 60,
    "selectors" JSONB,
    "config" JSONB,
    "lastScrapedAt" TIMESTAMP(3),
    "lastItemCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeHistory" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsRemoved" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPayout" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "itemsSold" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripePayout" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "stripeTransferId" TEXT,
    "stripePayoutId" TEXT,
    "status" "StripePayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "categoryId" TEXT NOT NULL,
    "listingType" "ListingType" NOT NULL DEFAULT 'BUY_NOW',
    "price" DECIMAL(10,2),
    "costBasis" DECIMAL(10,2),
    "metalType" "MetalType",
    "metalWeight" DECIMAL(10,4),
    "metalPurity" DECIMAL(5,4),
    "premiumPercent" DECIMAL(5,2),
    "premiumFlat" DECIMAL(10,2),
    "year" INTEGER,
    "mint" TEXT,
    "grade" TEXT,
    "certification" TEXT,
    "certNumber" TEXT,
    "population" INTEGER,
    "weight" DECIMAL(10,4),
    "diameter" DECIMAL(6,2),
    "thickness" DECIMAL(6,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "condition" TEXT,
    "clientId" TEXT,
    "submissionId" TEXT,
    "isConsignment" BOOLEAN NOT NULL DEFAULT false,
    "consignmentRate" DECIMAL(5,2),
    "sourceUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "startingPrice" DECIMAL(10,2) NOT NULL,
    "reservePrice" DECIMAL(10,2),
    "buyNowPrice" DECIMAL(10,2),
    "currentBid" DECIMAL(10,2) NOT NULL,
    "bidIncrement" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "highBidderId" TEXT,
    "finalPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "maxBid" DECIMAL(10,2),
    "isBuyNow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "maxBid" DECIMAL(10,2),
    "isWinning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "estimatedValue" DECIMAL(10,2),
    "aiAnalysis" JSONB,
    "suggestedPrice" DECIMAL(10,2),
    "marketComps" JSONB,
    "estimatedDays" INTEGER,
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "shippingMethod" TEXT,
    "trackingNumber" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionImage" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'photo',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT,
    "paymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "shippingMethod" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "lineItems" JSONB NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "fees" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "credits" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "storeId" TEXT,
    "storeName" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "status" "PlatformListStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "syncErrors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIntegration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetalPrice" (
    "id" TEXT NOT NULL,
    "metalType" "MetalType" NOT NULL,
    "spotPrice" DECIMAL(10,2) NOT NULL,
    "askPrice" DECIMAL(10,2),
    "bidPrice" DECIMAL(10,2),
    "change" DECIMAL(10,2),
    "changePct" DECIMAL(6,4),
    "source" TEXT NOT NULL DEFAULT 'api',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "avgPrice" DECIMAL(10,2),
    "lowPrice" DECIMAL(10,2),
    "highPrice" DECIMAL(10,2),
    "salesCount" INTEGER,
    "avgDaysToSell" INTEGER,
    "comparables" JSONB,
    "sources" TEXT[],
    "aiSummary" TEXT,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsImported" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerReview" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "review" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "itemAsDescribed" INTEGER,
    "shipping" INTEGER,
    "communication" INTEGER,
    "sellerResponse" TEXT,
    "sellerRespondedAt" TIMESTAMP(3),
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT,
    "categoryIds" TEXT[],
    "minPrice" DECIMAL(10,2),
    "maxPrice" DECIMAL(10,2),
    "conditions" TEXT[],
    "metalTypes" TEXT[],
    "years" JSONB,
    "certifications" TEXT[],
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertFrequency" TEXT NOT NULL DEFAULT 'instant',
    "lastAlertedAt" TIMESTAMP(3),
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT,
    "customTitle" TEXT,
    "customDescription" TEXT,
    "customImages" TEXT[],
    "customCategory" TEXT,
    "purchasePrice" DECIMAL(10,2),
    "purchaseDate" TIMESTAMP(3),
    "purchaseSource" TEXT,
    "currentValue" DECIMAL(10,2),
    "valueUpdatedAt" TIMESTAMP(3),
    "grade" TEXT,
    "certification" TEXT,
    "certNumber" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "searchQuery" TEXT,
    "alertType" "PriceAlertType" NOT NULL,
    "targetPrice" DECIMAL(10,2) NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "counterAmount" DECIMAL(10,2),
    "counterMessage" TEXT,
    "counteredAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchIndex" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metalType" TEXT,
    "year" INTEGER,
    "grade" TEXT,
    "certification" TEXT,
    "price" DECIMAL(10,2),
    "facets" JSONB NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "freshness" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE INDEX "ClientSource_clientId_idx" ON "ClientSource"("clientId");

-- CreateIndex
CREATE INDEX "ClientSource_isActive_idx" ON "ClientSource"("isActive");

-- CreateIndex
CREATE INDEX "ScrapeHistory_sourceId_createdAt_idx" ON "ScrapeHistory"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientPayout_clientId_idx" ON "ClientPayout"("clientId");

-- CreateIndex
CREATE INDEX "ClientPayout_status_idx" ON "ClientPayout"("status");

-- CreateIndex
CREATE INDEX "StripePayout_clientId_idx" ON "StripePayout"("clientId");

-- CreateIndex
CREATE INDEX "StripePayout_status_idx" ON "StripePayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_clientId_idx" ON "Product"("clientId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_metalType_idx" ON "Product"("metalType");

-- CreateIndex
CREATE INDEX "Product_featured_idx" ON "Product"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "Auction_productId_key" ON "Auction"("productId");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");

-- CreateIndex
CREATE INDEX "Auction_endTime_idx" ON "Auction"("endTime");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_idx" ON "AuctionBid"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionBid_bidderId_idx" ON "AuctionBid"("bidderId");

-- CreateIndex
CREATE INDEX "Bid_auctionId_idx" ON "Bid"("auctionId");

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_submissionId_key" ON "Invoice"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConnection_platform_key" ON "PlatformConnection"("platform");

-- CreateIndex
CREATE INDEX "PlatformListing_externalId_idx" ON "PlatformListing"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformListing_productId_connectionId_key" ON "PlatformListing"("productId", "connectionId");

-- CreateIndex
CREATE INDEX "ClientIntegration_clientId_idx" ON "ClientIntegration"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIntegration_clientId_platform_key" ON "ClientIntegration"("clientId", "platform");

-- CreateIndex
CREATE INDEX "MetalPrice_metalType_timestamp_idx" ON "MetalPrice"("metalType", "timestamp");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_createdAt_idx" ON "PriceHistory"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketAnalysis_productId_idx" ON "MarketAnalysis"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_productId_key" ON "WatchlistItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SellerReview_orderId_key" ON "SellerReview"("orderId");

-- CreateIndex
CREATE INDEX "SellerReview_sellerId_idx" ON "SellerReview"("sellerId");

-- CreateIndex
CREATE INDEX "SellerReview_buyerId_idx" ON "SellerReview"("buyerId");

-- CreateIndex
CREATE INDEX "SellerReview_rating_idx" ON "SellerReview"("rating");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "SavedSearch_alertEnabled_idx" ON "SavedSearch"("alertEnabled");

-- CreateIndex
CREATE INDEX "Collection_userId_idx" ON "Collection"("userId");

-- CreateIndex
CREATE INDEX "Collection_isPublic_idx" ON "Collection"("isPublic");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_productId_idx" ON "CollectionItem"("productId");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_productId_idx" ON "PriceAlert"("productId");

-- CreateIndex
CREATE INDEX "PriceAlert_triggered_idx" ON "PriceAlert"("triggered");

-- CreateIndex
CREATE INDEX "Offer_productId_idx" ON "Offer"("productId");

-- CreateIndex
CREATE INDEX "Offer_buyerId_idx" ON "Offer"("buyerId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndex_productId_key" ON "SearchIndex"("productId");

-- CreateIndex
CREATE INDEX "SearchIndex_category_idx" ON "SearchIndex"("category");

-- CreateIndex
CREATE INDEX "SearchIndex_metalType_idx" ON "SearchIndex"("metalType");

-- CreateIndex
CREATE INDEX "SearchIndex_year_idx" ON "SearchIndex"("year");

-- CreateIndex
CREATE INDEX "SearchIndex_grade_idx" ON "SearchIndex"("grade");

-- CreateIndex
CREATE INDEX "SearchIndex_price_idx" ON "SearchIndex"("price");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSource" ADD CONSTRAINT "ClientSource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeHistory" ADD CONSTRAINT "ScrapeHistory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ClientSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPayout" ADD CONSTRAINT "ClientPayout_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripePayout" ADD CONSTRAINT "StripePayout_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_highBidderId_fkey" FOREIGN KEY ("highBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionImage" ADD CONSTRAINT "SubmissionImage_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformListing" ADD CONSTRAINT "PlatformListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformListing" ADD CONSTRAINT "PlatformListing_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PlatformConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntegration" ADD CONSTRAINT "ClientIntegration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketAnalysis" ADD CONSTRAINT "MarketAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerReview" ADD CONSTRAINT "SellerReview_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerReview" ADD CONSTRAINT "SellerReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerReview" ADD CONSTRAINT "SellerReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIndex" ADD CONSTRAINT "SearchIndex_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

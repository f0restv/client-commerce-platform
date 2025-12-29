-- Collector Features Migration
-- Run this migration when DATABASE_URL is configured
-- Usage: psql -d your_database -f collector_features_migration.sql
-- Or: npx prisma db execute --file prisma/migrations/collector_features_migration.sql

-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE "PriceAlertType" AS ENUM ('BELOW_PRICE', 'ABOVE_PRICE', 'ANY_LISTING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Seller Reviews (ratings and feedback)
CREATE TABLE IF NOT EXISTS "SellerReview" (
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

-- Saved Searches
CREATE TABLE IF NOT EXISTS "SavedSearch" (
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

-- Collections (user curated item groups)
CREATE TABLE IF NOT EXISTS "Collection" (
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

-- Collection Items
CREATE TABLE IF NOT EXISTS "CollectionItem" (
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

-- Price Alerts
CREATE TABLE IF NOT EXISTS "PriceAlert" (
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

-- Offers (Make an Offer feature)
CREATE TABLE IF NOT EXISTS "Offer" (
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

-- Search Index (for faceted search)
CREATE TABLE IF NOT EXISTS "SearchIndex" (
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

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "SellerReview_orderId_key" ON "SellerReview"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndex_productId_key" ON "SearchIndex"("productId");

-- Indexes for SellerReview
CREATE INDEX IF NOT EXISTS "SellerReview_sellerId_idx" ON "SellerReview"("sellerId");
CREATE INDEX IF NOT EXISTS "SellerReview_buyerId_idx" ON "SellerReview"("buyerId");
CREATE INDEX IF NOT EXISTS "SellerReview_rating_idx" ON "SellerReview"("rating");

-- Indexes for SavedSearch
CREATE INDEX IF NOT EXISTS "SavedSearch_userId_idx" ON "SavedSearch"("userId");
CREATE INDEX IF NOT EXISTS "SavedSearch_alertEnabled_idx" ON "SavedSearch"("alertEnabled");

-- Indexes for Collection
CREATE INDEX IF NOT EXISTS "Collection_userId_idx" ON "Collection"("userId");
CREATE INDEX IF NOT EXISTS "Collection_isPublic_idx" ON "Collection"("isPublic");

-- Indexes for CollectionItem
CREATE INDEX IF NOT EXISTS "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");
CREATE INDEX IF NOT EXISTS "CollectionItem_productId_idx" ON "CollectionItem"("productId");

-- Indexes for PriceAlert
CREATE INDEX IF NOT EXISTS "PriceAlert_userId_idx" ON "PriceAlert"("userId");
CREATE INDEX IF NOT EXISTS "PriceAlert_productId_idx" ON "PriceAlert"("productId");
CREATE INDEX IF NOT EXISTS "PriceAlert_triggered_idx" ON "PriceAlert"("triggered");

-- Indexes for Offer
CREATE INDEX IF NOT EXISTS "Offer_productId_idx" ON "Offer"("productId");
CREATE INDEX IF NOT EXISTS "Offer_buyerId_idx" ON "Offer"("buyerId");
CREATE INDEX IF NOT EXISTS "Offer_status_idx" ON "Offer"("status");

-- Indexes for SearchIndex
CREATE INDEX IF NOT EXISTS "SearchIndex_category_idx" ON "SearchIndex"("category");
CREATE INDEX IF NOT EXISTS "SearchIndex_metalType_idx" ON "SearchIndex"("metalType");
CREATE INDEX IF NOT EXISTS "SearchIndex_year_idx" ON "SearchIndex"("year");
CREATE INDEX IF NOT EXISTS "SearchIndex_grade_idx" ON "SearchIndex"("grade");
CREATE INDEX IF NOT EXISTS "SearchIndex_price_idx" ON "SearchIndex"("price");

-- Full-text search index
CREATE INDEX IF NOT EXISTS "SearchIndex_searchText_idx" ON "SearchIndex" USING GIN (to_tsvector('english', "searchText"));

-- Foreign keys for SellerReview
ALTER TABLE "SellerReview" DROP CONSTRAINT IF EXISTS "SellerReview_sellerId_fkey";
ALTER TABLE "SellerReview" ADD CONSTRAINT "SellerReview_sellerId_fkey" 
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SellerReview" DROP CONSTRAINT IF EXISTS "SellerReview_buyerId_fkey";
ALTER TABLE "SellerReview" ADD CONSTRAINT "SellerReview_buyerId_fkey" 
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SellerReview" DROP CONSTRAINT IF EXISTS "SellerReview_orderId_fkey";
ALTER TABLE "SellerReview" ADD CONSTRAINT "SellerReview_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for SavedSearch
ALTER TABLE "SavedSearch" DROP CONSTRAINT IF EXISTS "SavedSearch_userId_fkey";
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for Collection
ALTER TABLE "Collection" DROP CONSTRAINT IF EXISTS "Collection_userId_fkey";
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for CollectionItem
ALTER TABLE "CollectionItem" DROP CONSTRAINT IF EXISTS "CollectionItem_collectionId_fkey";
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" 
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionItem" DROP CONSTRAINT IF EXISTS "CollectionItem_productId_fkey";
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for PriceAlert
ALTER TABLE "PriceAlert" DROP CONSTRAINT IF EXISTS "PriceAlert_userId_fkey";
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceAlert" DROP CONSTRAINT IF EXISTS "PriceAlert_productId_fkey";
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for Offer
ALTER TABLE "Offer" DROP CONSTRAINT IF EXISTS "Offer_productId_fkey";
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Offer" DROP CONSTRAINT IF EXISTS "Offer_buyerId_fkey";
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyerId_fkey" 
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for SearchIndex
ALTER TABLE "SearchIndex" DROP CONSTRAINT IF EXISTS "SearchIndex_productId_fkey";
ALTER TABLE "SearchIndex" ADD CONSTRAINT "SearchIndex_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { inngest } from "./client";
import { db } from "../db";
import { analyze } from "../services/product-intelligence";
import { crossListProduct } from "../integrations";
import type { Platform } from "@prisma/client";

/**
 * Analyze a new submission using ProductIntelligence
 * Triggered when a user submits items for consignment
 */
export const analyzeSubmission = inngest.createFunction(
  {
    id: "analyze-submission",
    retries: 3,
  },
  { event: "submission/created" },
  async ({ event, step }) => {
    const { submissionId, imageUrls } = event.data;

    // Fetch the submission
    const submission = await step.run("fetch-submission", async () => {
      return db.submission.findUnique({
        where: { id: submissionId },
        include: { images: true },
      });
    });

    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    // Update status to under review
    await step.run("update-status-reviewing", async () => {
      return db.submission.update({
        where: { id: submissionId },
        data: { status: "UNDER_REVIEW" },
      });
    });

    // Run ProductIntelligence analysis
    const analysisResult = await step.run("run-product-intelligence", async () => {
      const images = imageUrls.map((url) => ({
        type: "url" as const,
        url,
      }));

      return analyze(images, {
        clientPayout: submission.estimatedValue?.toNumber(),
      });
    });

    // Save analysis results to submission
    await step.run("save-analysis", async () => {
      const suggestedPrice = analysisResult.evaluation?.suggestedPrice ??
        analysisResult.marketData.ebayStats?.soldMedian ?? null;

      return db.submission.update({
        where: { id: submissionId },
        data: {
          aiAnalysis: analysisResult as object,
          suggestedPrice: suggestedPrice,
          marketComps: analysisResult.marketData.ebayStats?.comparables as object ?? null,
        },
      });
    });

    return {
      submissionId,
      identification: analysisResult.identification,
      grade: analysisResult.grade.grade,
      suggestedPrice: analysisResult.evaluation?.suggestedPrice,
      recommendation: analysisResult.evaluation?.recommendation,
    };
  }
);

/**
 * List accepted products to sales channels (eBay, Etsy, Shopify)
 * Triggered when a product is approved for listing
 */
export const listToChannels = inngest.createFunction(
  {
    id: "list-to-channels",
    retries: 2,
    concurrency: {
      limit: 5, // Limit concurrent API calls to platforms
    },
  },
  { event: "product/accepted" },
  async ({ event, step }) => {
    const { productId, platforms } = event.data;

    // Fetch the product with images
    const product = await step.run("fetch-product", async () => {
      return db.product.findUnique({
        where: { id: productId },
        include: {
          images: true,
          auction: true,
        },
      });
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Update product status to active
    await step.run("update-product-status", async () => {
      return db.product.update({
        where: { id: productId },
        data: { status: "ACTIVE" },
      });
    });

    // Map platform names to Platform enum values
    const platformMap: Record<string, Platform> = {
      EBAY: "EBAY",
      ETSY: "ETSY",
      SHOPIFY: "EBAY", // Shopify not in Platform enum, fallback handling
    };

    const validPlatforms = platforms
      .filter((p) => p in platformMap && platformMap[p] !== "EBAY" || p === "EBAY")
      .map((p) => platformMap[p]) as Platform[];

    // Cross-list to each platform
    const results = await step.run("cross-list-product", async () => {
      return crossListProduct(product, validPlatforms);
    });

    // Log results and handle errors
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (failed.length > 0) {
      console.warn(`Failed to list product ${productId} on platforms:`, failed);
    }

    return {
      productId,
      successfulPlatforms: successful.map((r) => r.platform),
      failedPlatforms: failed.map((r) => ({
        platform: r.platform,
        error: r.error,
      })),
    };
  }
);

/**
 * Process payouts for clients after sales complete
 * Triggered when an order is completed/delivered
 */
export const processPayouts = inngest.createFunction(
  {
    id: "process-payouts",
    retries: 3,
  },
  { event: "order/completed" },
  async ({ event, step }) => {
    const { orderId, clientId, productIds, totalAmount } = event.data;

    // Fetch client with commission rate
    const client = await step.run("fetch-client", async () => {
      return db.client.findUnique({
        where: { id: clientId },
      });
    });

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Calculate payout amount
    const commissionRate = client.commissionRate.toNumber() / 100;
    const commission = totalAmount * commissionRate;
    const payoutAmount = totalAmount - commission;

    // Fetch order items with product details
    const orderItems = await step.run("fetch-order-items", async () => {
      return db.orderItem.findMany({
        where: {
          productId: { in: productIds },
        },
        include: {
          product: true,
          order: true,
        },
      });
    });

    // Create payout record
    const payout = await step.run("create-payout", async () => {
      return db.clientPayout.create({
        data: {
          clientId,
          amount: payoutAmount,
          method: "pending", // Will be set when processed
          status: "PENDING",
          itemsSold: productIds.length,
          periodStart: new Date(),
          periodEnd: new Date(),
          notes: `Order #${event.data.orderNumber} - ${productIds.length} item(s) sold`,
        },
      });
    });

    // Update client stats
    await step.run("update-client-stats", async () => {
      return db.client.update({
        where: { id: clientId },
        data: {
          totalSold: { increment: productIds.length },
          totalEarnings: { increment: payoutAmount },
        },
      });
    });

    // Update product statuses to SOLD
    await step.run("update-product-statuses", async () => {
      return db.product.updateMany({
        where: { id: { in: productIds } },
        data: { status: "SOLD" },
      });
    });

    return {
      payoutId: payout.id,
      clientId,
      orderId,
      totalAmount,
      commission,
      payoutAmount,
      itemsSold: productIds.length,
    };
  }
);

// Export all functions for the serve handler
export const functions = [analyzeSubmission, listToChannels, processPayouts];

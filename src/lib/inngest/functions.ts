import { inngest } from "./client";
import { prisma } from "@/lib/db";
import { analyze } from "@/lib/services/product-intelligence";
import { listToEbay, listToEtsy } from "@/lib/integrations";

/**
 * Analyze a new submission using ProductIntelligence
 */
export const analyzeSubmission = inngest.createFunction(
  { id: "analyze-submission", name: "Analyze Submission" },
  { event: "submission/created" },
  async ({ event, step }) => {
    const { submissionId, clientId, imageUrls } = event.data;

    const analysis = await step.run("run-analysis", async () => {
      return analyze(
        imageUrls.map((url) => ({ type: "url" as const, url })),
        { skipMarketData: false }
      );
    });

    await step.run("save-analysis", async () => {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "ANALYZED",
          analysisResult: analysis as any,
          suggestedPrice: analysis.marketData?.ebayStats?.avgPrice,
          confidence: analysis.grade?.confidence,
        },
      });
    });

    if (analysis.evaluation) {
      await step.run("auto-evaluate", async () => {
        const action = analysis.evaluation!.recommendation;
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: action === "accept" ? "AUTO_ACCEPTED" : 
                   action === "decline" ? "AUTO_DECLINED" : "PENDING_REVIEW",
          },
        });
      });
    }

    return { submissionId, analysis };
  }
);

/**
 * List accepted products to sales channels
 */
export const listToChannels = inngest.createFunction(
  { id: "list-to-channels", name: "List to Sales Channels" },
  { event: "product/accepted" },
  async ({ event, step }) => {
    const { productId, clientId, channels } = event.data;

    const product = await step.run("get-product", async () => {
      return prisma.product.findUniqueOrThrow({
        where: { id: productId },
        include: { client: true, images: true },
      });
    });

    const results: Record<string, { success: boolean; listingId?: string; error?: string }> = {};

    for (const channel of channels) {
      results[channel] = await step.run(`list-to-${channel}`, async () => {
        try {
          let listingId: string;
          if (channel === "ebay") {
            const result = await listToEbay(product);
            listingId = result.listingId;
          } else if (channel === "etsy") {
            const result = await listToEtsy(product);
            listingId = result.listingId;
          } else {
            listingId = `shopify-${Date.now()}`;
          }
          return { success: true, listingId };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      });
    }

    await step.run("save-listings", async () => {
      await prisma.product.update({
        where: { id: productId },
        data: {
          status: "ACTIVE",
          ebayListingId: results.ebay?.listingId,
          etsyListingId: results.etsy?.listingId,
          shopifyProductId: results.shopify?.listingId,
          listedAt: new Date(),
        },
      });
    });

    return { productId, results };
  }
);

/**
 * Process payouts after a sale
 */
export const processPayouts = inngest.createFunction(
  { id: "process-payouts", name: "Process Payouts" },
  { event: "product/sold" },
  async ({ event, step }) => {
    const { productId, clientId, soldPrice, platform } = event.data;

    const product = await step.run("get-product", async () => {
      return prisma.product.findUniqueOrThrow({
        where: { id: productId },
        include: { client: true },
      });
    });

    const payout = await step.run("calculate-payout", async () => {
      const platformFees: Record<string, number> = {
        ebay: 0.1289,
        etsy: 0.065,
        shopify: 0.029,
      };
      const fee = platformFees[platform] || 0.10;
      const platformCost = soldPrice * fee;
      const netProfit = soldPrice - product.clientPayout - platformCost;
      return { soldPrice, clientPayout: product.clientPayout, platformFee: platformCost, netProfit };
    });

    await step.run("create-payout", async () => {
      await prisma.payout.create({
        data: {
          clientId,
          productId,
          amount: product.clientPayout,
          status: "PENDING",
          soldPrice,
          platformFee: payout.platformFee,
          netProfit: payout.netProfit,
        },
      });
    });

    await step.run("update-product", async () => {
      await prisma.product.update({
        where: { id: productId },
        data: { status: "SOLD", soldAt: new Date(), soldPrice, soldPlatform: platform },
      });
    });

    return { productId, payout };
  }
);

// Export all functions for the serve handler
export const functions = [analyzeSubmission, listToChannels, processPayouts];

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
    const { submissionId, imageUrls } = event.data as {
      submissionId: string;
      clientId: string;
      imageUrls: string[];
    };

    const analysis = await step.run("run-analysis", async () => {
      return analyze(
        imageUrls.map((url: string) => ({ type: "url" as const, url })),
        { skipMarketData: false }
      );
    });

    await step.run("save-analysis", async () => {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "UNDER_REVIEW",
          aiAnalysis: analysis as object,
          suggestedPrice: analysis.marketData?.ebayStats?.soldAverage,
        },
      });
    });

    if (analysis.evaluation) {
      await step.run("auto-evaluate", async () => {
        const action = analysis.evaluation!.recommendation;
        await prisma.submission.update({
          where: { id: submissionId },
          data: {
            status: action === "accept" ? "APPROVED" :
                   action === "decline" ? "REJECTED" : "UNDER_REVIEW",
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
    const { productId, channels } = event.data as {
      productId: string;
      clientId: string;
      channels: string[];
    };

    const results: Record<string, { success: boolean; listingId?: string; error?: string }> = {};

    for (const channel of channels) {
      results[channel] = await step.run(`list-to-${channel}`, async () => {
        try {
          // Fetch product fresh inside step to get proper types
          const product = await prisma.product.findUniqueOrThrow({
            where: { id: productId },
            include: { client: true, images: true },
          });

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
    const { productId, clientId, soldPrice, platform } = event.data as {
      productId: string;
      clientId: string;
      soldPrice: number;
      platform: string;
    };

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
      const consignmentRate = Number(product.consignmentRate || 15);
      const clientPayout = soldPrice * (1 - consignmentRate / 100) - platformCost;
      const netProfit = soldPrice - clientPayout - platformCost;
      return { soldPrice, clientPayout, platformFee: platformCost, netProfit };
    });

    await step.run("create-payout", async () => {
      await prisma.stripePayout.create({
        data: {
          clientId,
          amount: payout.clientPayout,
          status: "PENDING",
        },
      });
    });

    await step.run("update-product", async () => {
      await prisma.product.update({
        where: { id: productId },
        data: { status: "SOLD" },
      });
    });

    return { productId, payout };
  }
);

// Export all functions for the serve handler
export const functions = [analyzeSubmission, listToChannels, processPayouts];

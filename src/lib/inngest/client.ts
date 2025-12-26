import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "client-commerce-platform",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Event types for type-safe event publishing
export type InngestEvents = {
  "submission/created": {
    data: {
      submissionId: string;
      userId: string;
      imageUrls: string[];
    };
  };
  "product/accepted": {
    data: {
      productId: string;
      clientId: string;
      platforms: ("EBAY" | "ETSY" | "SHOPIFY")[];
    };
  };
  "order/completed": {
    data: {
      orderId: string;
      orderNumber: string;
      clientId: string;
      productIds: string[];
      totalAmount: number;
    };
  };
};

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "client-commerce-platform",
});

// Event types for type-safe event publishing
export type Events = {
  "submission/created": {
    data: {
      submissionId: string;
      clientId: string;
      imageUrls: string[];
    };
  };
  "product/accepted": {
    data: {
      productId: string;
      clientId: string;
      channels: ("shopify" | "ebay" | "etsy")[];
    };
  };
  "product/sold": {
    data: {
      productId: string;
      clientId: string;
      soldPrice: number;
      platform: string;
    };
  };
};

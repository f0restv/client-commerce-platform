import type { Product, PlatformListing } from '@/types';

interface EbayConfig {
  appId: string;
  certId: string;
  devId: string;
  authToken: string;
  sandbox?: boolean;
}

interface EbayListingResponse {
  ItemID: string;
  ViewItemURL: string;
}

export class EbayService {
  private config: EbayConfig;
  private baseUrl: string;

  constructor(config: EbayConfig) {
    this.config = config;
    this.baseUrl = config.sandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
  }

  async createListing(product: Product): Promise<PlatformListing> {
    const itemData = this.buildItemData(product);

    // In production, this would use the eBay Trading API
    // POST /ws/api.dll with AddItem call
    const response = await this.makeApiCall('AddItem', {
      Item: itemData,
    });

    return {
      id: crypto.randomUUID(),
      product_id: product.id,
      platform: 'ebay',
      external_id: response.ItemID,
      external_url: response.ViewItemURL,
      status: 'active',
      listed_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  async updateListing(listingId: string, product: Product): Promise<void> {
    const itemData = this.buildItemData(product);

    await this.makeApiCall('ReviseItem', {
      Item: {
        ItemID: listingId,
        ...itemData,
      },
    });
  }

  async endListing(listingId: string, reason: 'Sold' | 'NotAvailable' = 'NotAvailable'): Promise<void> {
    await this.makeApiCall('EndItem', {
      ItemID: listingId,
      EndingReason: reason,
    });
  }

  async getListingStatus(listingId: string): Promise<{
    status: 'active' | 'ended' | 'sold';
    currentPrice?: number;
    bidCount?: number;
  }> {
    const response = await this.makeApiCall('GetItem', {
      ItemID: listingId,
      DetailLevel: 'ReturnAll',
    });

    return {
      status: this.mapEbayStatus(response.Item.SellingStatus.ListingStatus),
      currentPrice: parseFloat(response.Item.SellingStatus.CurrentPrice.Value),
      bidCount: response.Item.SellingStatus.BidCount,
    };
  }

  private buildItemData(product: Product) {
    const isAuction = product.listing_type === 'auction';

    return {
      Title: product.title.substring(0, 80), // eBay limit
      Description: this.formatDescription(product),
      PrimaryCategory: {
        CategoryID: this.getCategoryId(product.category_id),
      },
      StartPrice: isAuction ? product.starting_bid : product.price,
      BuyItNowPrice: !isAuction ? undefined : product.price,
      Currency: 'USD',
      Country: 'US',
      ListingType: isAuction ? 'Chinese' : 'FixedPriceItem',
      ListingDuration: isAuction ? 'Days_7' : 'GTC',
      Quantity: product.quantity,
      ConditionID: this.getConditionId(product.grade),
      ReturnPolicy: {
        ReturnsAcceptedOption: 'ReturnsAccepted',
        RefundOption: 'MoneyBack',
        ReturnsWithinOption: 'Days_30',
        ShippingCostPaidByOption: 'Buyer',
      },
      ShippingDetails: {
        ShippingType: 'Flat',
        ShippingServiceOptions: {
          ShippingServicePriority: 1,
          ShippingService: 'USPSPriority',
          ShippingServiceCost: 5.99,
        },
      },
      PictureDetails: {
        PictureURL: product.images?.map((img) => img.url) || [],
      },
      ItemSpecifics: {
        NameValueList: this.buildItemSpecifics(product),
      },
    };
  }

  private formatDescription(product: Product): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2>${product.title}</h2>
        <p>${product.description}</p>

        <h3>Details</h3>
        <ul>
          ${product.year ? `<li>Year: ${product.year}</li>` : ''}
          ${product.mint ? `<li>Mint: ${product.mint}</li>` : ''}
          ${product.grade ? `<li>Grade: ${product.grade}</li>` : ''}
          ${product.certification ? `<li>Certification: ${product.certification}</li>` : ''}
          ${product.metal_type ? `<li>Metal: ${product.metal_type}</li>` : ''}
          ${product.metal_weight_oz ? `<li>Weight: ${product.metal_weight_oz} oz</li>` : ''}
        </ul>

        <p>Thank you for shopping with CoinVault!</p>
      </div>
    `;
  }

  private buildItemSpecifics(product: Product) {
    const specs: Array<{ Name: string; Value: string }> = [];

    if (product.year) specs.push({ Name: 'Year', Value: String(product.year) });
    if (product.mint) specs.push({ Name: 'Mint Location', Value: product.mint });
    if (product.grade) specs.push({ Name: 'Grade', Value: product.grade });
    if (product.certification) specs.push({ Name: 'Certification', Value: product.certification });
    if (product.metal_type) specs.push({ Name: 'Composition', Value: product.metal_type });

    return specs;
  }

  private getCategoryId(categoryId: string): string {
    // Map internal categories to eBay category IDs
    const categoryMap: Record<string, string> = {
      'us-coins': '253',      // US Coins
      'world-coins': '256',   // World Coins
      'bullion': '39482',     // Bullion
      'paper-money': '3411',  // Paper Money
    };
    return categoryMap[categoryId] || '11116'; // Default: Coins & Paper Money
  }

  private getConditionId(grade?: string): number {
    // Map coin grades to eBay condition IDs
    if (!grade) return 4000; // Default
    if (grade.includes('MS-70') || grade.includes('PF-70')) return 1000; // New
    if (grade.includes('MS-') || grade.includes('PF-')) return 4000; // Excellent
    if (grade.includes('AU')) return 5000; // Very Good
    return 6000; // Good
  }

  private mapEbayStatus(status: string): 'active' | 'ended' | 'sold' {
    switch (status) {
      case 'Active':
        return 'active';
      case 'Completed':
        return 'sold';
      default:
        return 'ended';
    }
  }

  private async makeApiCall(callName: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    // This is a simplified version - real implementation would use eBay's XML API
    console.log(`eBay API Call: ${callName}`, data);

    // Simulate API response
    return {
      Ack: 'Success',
      ItemID: 'mock-ebay-id-' + Date.now(),
      ViewItemURL: 'https://www.ebay.com/itm/mock-item',
      Item: {
        SellingStatus: {
          ListingStatus: 'Active',
          CurrentPrice: { Value: '100.00' },
          BidCount: 0,
        },
      },
    };
  }
}

// Singleton instance
let ebayService: EbayService | null = null;

export function getEbayService(): EbayService {
  if (!ebayService) {
    ebayService = new EbayService({
      appId: process.env.EBAY_APP_ID!,
      certId: process.env.EBAY_CERT_ID!,
      devId: process.env.EBAY_DEV_ID!,
      authToken: process.env.EBAY_AUTH_TOKEN!,
      sandbox: process.env.NODE_ENV !== 'production',
    });
  }
  return ebayService;
}

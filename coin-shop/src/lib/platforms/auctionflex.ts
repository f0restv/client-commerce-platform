import type { Product, PlatformListing, Auction } from '@/types';

interface AuctionFlexConfig {
  apiKey: string;
  apiSecret: string;
  accountId?: string;
}

interface AuctionFlexLot {
  lot_id: string;
  url: string;
  status: string;
  current_bid?: number;
  bid_count?: number;
}

export class AuctionFlexService {
  private config: AuctionFlexConfig;
  private baseUrl = 'https://api.auctionflex360.com/v1';

  constructor(config: AuctionFlexConfig) {
    this.config = config;
  }

  async createLot(product: Product, auction?: Auction): Promise<PlatformListing> {
    const lotData = this.buildLotData(product, auction);

    const response = await this.makeApiCall('POST', '/lots', lotData);

    return {
      id: crypto.randomUUID(),
      product_id: product.id,
      platform: 'auctionflex',
      external_id: response.lot_id,
      external_url: response.url,
      status: 'active',
      listed_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  async updateLot(lotId: string, product: Product, auction?: Auction): Promise<void> {
    const lotData = this.buildLotData(product, auction);

    await this.makeApiCall('PUT', `/lots/${lotId}`, lotData);
  }

  async deleteLot(lotId: string): Promise<void> {
    await this.makeApiCall('DELETE', `/lots/${lotId}`);
  }

  async getLotStatus(lotId: string): Promise<{
    status: 'active' | 'ended' | 'sold';
    currentBid?: number;
    bidCount?: number;
    highBidder?: string;
  }> {
    const response = await this.makeApiCall('GET', `/lots/${lotId}`) as AuctionFlexLot;

    return {
      status: this.mapStatus(response.status),
      currentBid: response.current_bid,
      bidCount: response.bid_count,
    };
  }

  async createAuction(name: string, startDate: Date, endDate: Date): Promise<string> {
    const response = await this.makeApiCall('POST', '/auctions', {
      name,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      type: 'timed',
      currency: 'USD',
    });

    return response.auction_id as string;
  }

  async addLotToAuction(auctionId: string, lotId: string, lotNumber: number): Promise<void> {
    await this.makeApiCall('POST', `/auctions/${auctionId}/lots`, {
      lot_id: lotId,
      lot_number: lotNumber,
    });
  }

  async getBidHistory(lotId: string): Promise<Array<{
    bidder: string;
    amount: number;
    timestamp: string;
  }>> {
    const response = await this.makeApiCall('GET', `/lots/${lotId}/bids`);
    return response.bids as Array<{ bidder: string; amount: number; timestamp: string }>;
  }

  async syncResults(): Promise<Array<{
    lot_id: string;
    sold: boolean;
    final_price?: number;
    buyer?: string;
  }>> {
    const response = await this.makeApiCall('GET', '/results/pending');
    return response.results as Array<{
      lot_id: string;
      sold: boolean;
      final_price?: number;
      buyer?: string;
    }>;
  }

  private buildLotData(product: Product, auction?: Auction) {
    return {
      title: product.title,
      description: this.formatDescription(product),
      starting_bid: auction?.starting_price || product.starting_bid || product.price * 0.5,
      reserve_price: auction?.reserve_price || product.reserve_price,
      bid_increment: auction?.bid_increment || this.calculateBidIncrement(product.price),
      buy_now_price: product.listing_type !== 'auction' ? product.price : undefined,
      category: this.getCategoryCode(product.category_id),
      images: product.images?.map((img) => img.url) || [],
      attributes: this.buildAttributes(product),
      shipping: {
        domestic: 5.99,
        international: 29.99,
        combined_shipping: true,
      },
    };
  }

  private formatDescription(product: Product): string {
    let desc = `<p>${product.description}</p>`;

    desc += '<h3>Specifications</h3><ul>';
    if (product.year) desc += `<li>Year: ${product.year}</li>`;
    if (product.mint) desc += `<li>Mint: ${product.mint}</li>`;
    if (product.grade) desc += `<li>Grade: ${product.grade}</li>`;
    if (product.certification) desc += `<li>Certification: ${product.certification} #${product.cert_number || 'N/A'}</li>`;
    if (product.metal_type && product.metal_type !== 'none') {
      desc += `<li>Metal: ${product.metal_type}`;
      if (product.metal_purity) desc += ` (${product.metal_purity * 1000}/1000 fine)`;
      desc += '</li>';
    }
    if (product.metal_weight_oz) desc += `<li>Weight: ${product.metal_weight_oz} troy oz</li>`;
    desc += '</ul>';

    return desc;
  }

  private buildAttributes(product: Product): Record<string, string> {
    const attrs: Record<string, string> = {};

    if (product.year) attrs['year'] = String(product.year);
    if (product.mint) attrs['mint'] = product.mint;
    if (product.grade) attrs['grade'] = product.grade;
    if (product.certification) attrs['certification'] = product.certification;
    if (product.metal_type) attrs['metal'] = product.metal_type;
    if (product.metal_weight_oz) attrs['weight_oz'] = String(product.metal_weight_oz);

    return attrs;
  }

  private getCategoryCode(categoryId: string): string {
    const categoryMap: Record<string, string> = {
      'us-coins': 'COINS_US',
      'world-coins': 'COINS_WORLD',
      'ancient-coins': 'COINS_ANCIENT',
      'bullion': 'BULLION',
      'paper-money': 'CURRENCY',
      'tokens-medals': 'EXONUMIA',
    };
    return categoryMap[categoryId] || 'COINS_OTHER';
  }

  private calculateBidIncrement(price: number): number {
    if (price < 50) return 1;
    if (price < 100) return 2;
    if (price < 500) return 5;
    if (price < 1000) return 10;
    if (price < 5000) return 25;
    if (price < 10000) return 50;
    return 100;
  }

  private mapStatus(status: string): 'active' | 'ended' | 'sold' {
    switch (status.toLowerCase()) {
      case 'open':
      case 'active':
        return 'active';
      case 'sold':
      case 'won':
        return 'sold';
      default:
        return 'ended';
    }
  }

  private async makeApiCall(method: string, path: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    console.log(`AuctionFlex API Call: ${method} ${path}`, data);

    // Simulate API response
    return {
      lot_id: 'af-lot-' + Date.now(),
      auction_id: 'af-auction-' + Date.now(),
      url: `https://www.auctionflex360.com/lot/${Date.now()}`,
      status: 'open',
      current_bid: data?.starting_bid || 100,
      bid_count: 0,
      bids: [],
      results: [],
    };
  }
}

// Singleton instance
let auctionFlexService: AuctionFlexService | null = null;

export function getAuctionFlexService(): AuctionFlexService {
  if (!auctionFlexService) {
    auctionFlexService = new AuctionFlexService({
      apiKey: process.env.AUCTIONFLEX_API_KEY!,
      apiSecret: process.env.AUCTIONFLEX_API_SECRET!,
    });
  }
  return auctionFlexService;
}

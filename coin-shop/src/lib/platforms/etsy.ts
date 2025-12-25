import type { Product, PlatformListing } from '@/types';

interface EtsyConfig {
  apiKey: string;
  apiSecret: string;
  shopId: string;
  accessToken?: string;
}

export class EtsyService {
  private config: EtsyConfig;
  private baseUrl = 'https://openapi.etsy.com/v3';

  constructor(config: EtsyConfig) {
    this.config = config;
  }

  async createListing(product: Product): Promise<PlatformListing> {
    const listingData = this.buildListingData(product);

    const response = await this.makeApiCall('POST', `/application/shops/${this.config.shopId}/listings`, listingData);

    // Upload images
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        await this.uploadImage(response.listing_id, image.url);
      }
    }

    return {
      id: crypto.randomUUID(),
      product_id: product.id,
      platform: 'etsy',
      external_id: String(response.listing_id),
      external_url: response.url,
      status: 'active',
      listed_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
  }

  async updateListing(listingId: string, product: Product): Promise<void> {
    const listingData = this.buildListingData(product);

    await this.makeApiCall('PUT', `/application/listings/${listingId}`, listingData);
  }

  async deleteListing(listingId: string): Promise<void> {
    await this.makeApiCall('DELETE', `/application/listings/${listingId}`);
  }

  async getListingStatus(listingId: string): Promise<{
    status: 'active' | 'ended' | 'sold';
    views: number;
    favorites: number;
  }> {
    const response = await this.makeApiCall('GET', `/application/listings/${listingId}`);

    return {
      status: this.mapEtsyStatus(response.state),
      views: response.views,
      favorites: response.num_favorers,
    };
  }

  async syncInventory(listingId: string, quantity: number): Promise<void> {
    await this.makeApiCall('PUT', `/application/listings/${listingId}/inventory`, {
      products: [{
        offerings: [{
          quantity,
          is_enabled: quantity > 0,
        }],
      }],
    });
  }

  private buildListingData(product: Product) {
    return {
      title: product.title.substring(0, 140), // Etsy limit
      description: this.formatDescription(product),
      price: product.price,
      quantity: product.quantity,
      who_made: 'someone_else',
      when_made: this.getWhenMade(product.year),
      taxonomy_id: this.getTaxonomyId(product.category_id),
      shipping_profile_id: null, // Use shop default
      tags: this.buildTags(product),
      materials: this.getMaterials(product),
      is_supply: false,
      is_customizable: false,
      should_auto_renew: true,
      state: 'active',
    };
  }

  private formatDescription(product: Product): string {
    let description = product.description + '\n\n';

    if (product.year) description += `Year: ${product.year}\n`;
    if (product.mint) description += `Mint: ${product.mint}\n`;
    if (product.grade) description += `Grade: ${product.grade}\n`;
    if (product.certification) description += `Certification: ${product.certification}\n`;
    if (product.metal_type) description += `Metal: ${product.metal_type}\n`;
    if (product.metal_weight_oz) description += `Weight: ${product.metal_weight_oz} oz\n`;

    description += '\n---\nShipped with care from CoinVault. Thank you for your purchase!';

    return description;
  }

  private buildTags(product: Product): string[] {
    const tags: string[] = [...(product.tags || [])];

    if (product.year) tags.push(String(product.year));
    if (product.mint) tags.push(product.mint);
    if (product.grade) tags.push(product.grade);
    if (product.metal_type) tags.push(product.metal_type);

    // Etsy allows max 13 tags, each max 20 chars
    return tags
      .filter((tag) => tag.length <= 20)
      .slice(0, 13);
  }

  private getMaterials(product: Product): string[] {
    const materials: string[] = [];

    if (product.metal_type === 'gold') materials.push('gold');
    if (product.metal_type === 'silver') materials.push('silver');
    if (product.metal_type === 'platinum') materials.push('platinum');
    if (product.metal_type === 'copper') materials.push('copper');

    return materials;
  }

  private getTaxonomyId(categoryId: string): number {
    // Map to Etsy taxonomy IDs for Coins & Money
    const taxonomyMap: Record<string, number> = {
      'us-coins': 1859,
      'world-coins': 1860,
      'bullion': 1861,
      'paper-money': 1862,
    };
    return taxonomyMap[categoryId] || 1858; // Default: Coins & Money
  }

  private getWhenMade(year?: number): string {
    if (!year) return 'made_to_order';
    if (year >= 2020) return '2020_2024';
    if (year >= 2010) return '2010_2019';
    if (year >= 2000) return '2000_2009';
    if (year >= 1990) return '1990_1999';
    if (year >= 1980) return '1980s';
    if (year >= 1970) return '1970s';
    if (year >= 1960) return '1960s';
    if (year >= 1950) return '1950s';
    if (year >= 1940) return '1940s';
    if (year >= 1930) return '1930s';
    if (year >= 1920) return '1920s';
    if (year >= 1910) return '1910s';
    if (year >= 1900) return '1900s';
    return 'before_1900';
  }

  private mapEtsyStatus(state: string): 'active' | 'ended' | 'sold' {
    switch (state) {
      case 'active':
        return 'active';
      case 'sold_out':
        return 'sold';
      default:
        return 'ended';
    }
  }

  private async uploadImage(listingId: number, imageUrl: string): Promise<void> {
    // Fetch image and upload to Etsy
    // In production, this would handle the multipart form upload
    console.log(`Uploading image to Etsy listing ${listingId}: ${imageUrl}`);
  }

  private async makeApiCall(method: string, path: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    // This would use fetch with proper OAuth headers
    console.log(`Etsy API Call: ${method} ${path}`, data);

    // Simulate API response
    return {
      listing_id: Date.now(),
      url: `https://www.etsy.com/listing/${Date.now()}`,
      state: 'active',
      views: 0,
      num_favorers: 0,
    };
  }
}

// Singleton instance
let etsyService: EtsyService | null = null;

export function getEtsyService(): EtsyService {
  if (!etsyService) {
    etsyService = new EtsyService({
      apiKey: process.env.ETSY_API_KEY!,
      apiSecret: process.env.ETSY_API_SECRET!,
      shopId: process.env.ETSY_SHOP_ID!,
    });
  }
  return etsyService;
}

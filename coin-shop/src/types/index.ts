// ==========================================
// DATABASE TYPES (Supabase Schema)
// ==========================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: 'admin' | 'client' | 'customer';
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Client extends User {
  company_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  tax_id?: string;
  commission_rate: number; // Default 15%
  notes?: string;
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  short_description?: string;

  // Categorization
  category_id: string;
  subcategory_id?: string;
  tags: string[];

  // Pricing
  price: number;
  cost?: number;
  reserve_price?: number;
  starting_bid?: number;

  // Metal content (for spot price calculations)
  metal_type?: 'gold' | 'silver' | 'platinum' | 'palladium' | 'copper' | 'none';
  metal_weight_oz?: number;
  metal_purity?: number; // e.g., 0.999 for .999 fine

  // Coin/Collectible specifics
  year?: number;
  mint?: string;
  grade?: string;
  certification?: string;
  cert_number?: string;
  diameter_mm?: number;
  weight_grams?: number;

  // Listing type
  listing_type: 'buy_now' | 'auction' | 'both';
  auction_end_date?: string;

  // Status
  status: 'draft' | 'active' | 'sold' | 'reserved' | 'archived';
  quantity: number;

  // Images
  images: ProductImage[];

  // Client/consignment
  client_id?: string;
  is_consignment: boolean;
  consignment_rate?: number;

  // External listings
  ebay_listing_id?: string;
  etsy_listing_id?: string;
  auctionflex_listing_id?: string;
  external_source_url?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  listed_at?: string;
  sold_at?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text?: string;
  position: number;
  is_primary: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  position: number;
  product_count?: number;
}

export interface Auction {
  id: string;
  product_id: string;
  starting_price: number;
  reserve_price?: number;
  current_bid?: number;
  bid_increment: number;
  start_date: string;
  end_date: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  winner_id?: string;
  winning_bid?: number;
}

export interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  amount: number;
  is_winning: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

  // Totals
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;

  // Payment
  stripe_payment_intent_id?: string;
  paid_at?: string;

  // Shipping
  shipping_address: Address;
  tracking_number?: string;
  shipped_at?: string;

  items: OrderItem[];

  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Address {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

// ==========================================
// CLIENT PORTAL TYPES
// ==========================================

export interface ClientSubmission {
  id: string;
  client_id: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'listed';

  // Item details
  title: string;
  description: string;
  category_id?: string;

  // Client's estimates
  estimated_value?: number;
  desired_price?: number;

  // AI Analysis
  ai_analysis?: AIAnalysis;

  // Images
  images: string[];

  // Admin notes
  admin_notes?: string;
  rejection_reason?: string;

  // Resulting product
  product_id?: string;

  created_at: string;
  updated_at: string;
  reviewed_at?: string;
}

export interface AIAnalysis {
  identified_item: string;
  confidence: number;
  estimated_value_low: number;
  estimated_value_high: number;
  estimated_value_avg: number;
  market_analysis: string;
  avg_days_to_sell: number;
  recent_sales: RecentSale[];
  grading_estimate?: string;
  recommendations: string[];
  raw_response?: string;
}

export interface RecentSale {
  platform: string;
  price: number;
  date: string;
  condition?: string;
  url?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  // Items
  items: InvoiceItem[];

  // Totals
  subtotal: number;
  fees: number;
  commission: number;
  total_due: number;
  amount_paid: number;

  // Payment
  stripe_invoice_id?: string;
  payment_link?: string;
  paid_at?: string;

  // Dates
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  product_id?: string;
  sale_price?: number;
  commission_rate?: number;
  commission_amount?: number;
  fees?: number;
  net_amount: number;
}

// ==========================================
// METALS PRICING
// ==========================================

export interface MetalPrices {
  gold: number;
  silver: number;
  platinum: number;
  palladium: number;
  timestamp: string;
  currency: string;
}

export interface MetalPriceHistory {
  metal: 'gold' | 'silver' | 'platinum' | 'palladium';
  price: number;
  timestamp: string;
}

// ==========================================
// PLATFORM INTEGRATION TYPES
// ==========================================

export interface PlatformListing {
  id: string;
  product_id: string;
  platform: 'ebay' | 'etsy' | 'auctionflex';
  external_id: string;
  external_url: string;
  status: 'active' | 'ended' | 'sold' | 'error';
  listed_at: string;
  last_synced_at: string;
  error_message?: string;
}

export interface ScrapedListing {
  id: string;
  source_url: string;
  source_platform: string;
  title: string;
  description?: string;
  price?: number;
  images: string[];
  raw_data: Record<string, unknown>;
  status: 'new' | 'imported' | 'ignored';
  product_id?: string;
  scraped_at: string;
}

// ==========================================
// UI/STATE TYPES
// ==========================================

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface FilterOptions {
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  metal?: string;
  grade?: string;
  year?: number;
  listingType?: 'buy_now' | 'auction' | 'all';
  sortBy?: 'newest' | 'price_low' | 'price_high' | 'ending_soon';
}

export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// ==========================================
// FORM TYPES
// ==========================================

export interface SubmissionFormData {
  title: string;
  description: string;
  category_id: string;
  estimated_value?: number;
  desired_price?: number;
  images: File[];
}

export interface ProductFormData {
  title: string;
  description: string;
  short_description?: string;
  category_id: string;
  subcategory_id?: string;
  tags: string[];
  price: number;
  cost?: number;
  reserve_price?: number;
  starting_bid?: number;
  metal_type?: Product['metal_type'];
  metal_weight_oz?: number;
  metal_purity?: number;
  year?: number;
  mint?: string;
  grade?: string;
  certification?: string;
  cert_number?: string;
  listing_type: Product['listing_type'];
  auction_end_date?: string;
  quantity: number;
  images: File[] | string[];
}

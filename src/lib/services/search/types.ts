export interface SearchFilters {
  query?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  metalTypes?: string[];
  grades?: string[];
  certifications?: string[];
  yearMin?: number;
  yearMax?: number;
  listingTypes?: ('BUY_NOW' | 'AUCTION' | 'BOTH')[];
  conditions?: string[];
  inStock?: boolean;
}

export interface SortOption {
  field: 'price' | 'createdAt' | 'views' | 'relevance' | 'endTime';
  direction: 'asc' | 'desc';
}

export interface SearchResult {
  products: SearchProduct[];
  total: number;
  page: number;
  pageSize: number;
  perPage: number; // Alias for pageSize
  totalPages: number;
  facets: SearchFacets;
}

export interface SearchProduct {
  id: string;
  sku: string;
  title: string;
  shortDescription?: string;
  price: number | null;
  images: { url: string; alt?: string }[];
  listingType: 'BUY_NOW' | 'AUCTION' | 'BOTH';
  metalType?: string;
  grade?: string;
  certification?: string;
  year?: number;
  status: string;
  views: number;
  createdAt: Date;
  auction?: {
    currentBid: number | null;
    endTime: Date;
    bidCount: number;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface SearchFacets {
  categories: FacetBucket[];
  metalTypes: FacetBucket[];
  grades: FacetBucket[];
  certifications: FacetBucket[];
  priceRanges: FacetBucket[];
  years: FacetBucket[];
}

export interface FacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface SavedSearchInput {
  name: string;
  query?: string;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  conditions?: string[];
  metalTypes?: string[];
  years?: { min?: number; max?: number };
  certifications?: string[];
  alertEnabled?: boolean;
  alertFrequency?: 'instant' | 'daily' | 'weekly';
}

export interface PriceAlertInput {
  productId?: string;
  searchQuery?: string;
  alertType: 'BELOW_PRICE' | 'ABOVE_PRICE' | 'ANY_LISTING';
  targetPrice: number;
  notifyEmail?: boolean;
  notifyPush?: boolean;
}

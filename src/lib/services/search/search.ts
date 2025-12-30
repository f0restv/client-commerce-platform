import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type {
  SearchFilters,
  SortOption,
  SearchResult,
  SearchProduct,
  SearchFacets,
  FacetBucket,
} from './types';

const DEFAULT_PAGE_SIZE = 24;

/**
 * Search products with full-text search, filters, and facets
 */
export async function searchProducts(
  filters: SearchFilters,
  sort: SortOption = { field: 'relevance', direction: 'desc' },
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<SearchResult> {
  const skip = (page - 1) * pageSize;

  // Build where clause
  const where = buildWhereClause(filters);

  // Build order by
  const orderBy = buildOrderBy(sort);

  // Execute search and count in parallel
  const [products, total, facets] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        images: {
          orderBy: { order: 'asc' },
          take: 1,
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
        auction: {
          select: {
            currentBid: true,
            endTime: true,
            bids: { select: { id: true } },
          },
        },
      },
    }),
    db.product.count({ where }),
    computeFacets(filters),
  ]);

  // Transform to SearchProduct
  const searchProducts: SearchProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    title: p.title,
    shortDescription: p.shortDescription || undefined,
    price: p.price?.toNumber() || null,
    images: p.images.map((img) => ({ url: img.url, alt: img.alt || undefined })),
    listingType: p.listingType as 'BUY_NOW' | 'AUCTION' | 'BOTH',
    metalType: p.metalType || undefined,
    grade: p.grade || undefined,
    certification: p.certification || undefined,
    year: p.year || undefined,
    status: p.status,
    views: p.views,
    createdAt: p.createdAt,
    auction: p.auction
      ? {
          currentBid: p.auction.currentBid?.toNumber() || null,
          endTime: p.auction.endTime,
          bidCount: p.auction.bids.length,
        }
      : null,
    category: p.category,
  }));

  return {
    products: searchProducts,
    total,
    page,
    pageSize,
    perPage: pageSize,
    totalPages: Math.ceil(total / pageSize),
    facets,
  };
}

/**
 * Build Prisma where clause from search filters
 */
function buildWhereClause(filters: SearchFilters): Prisma.ProductWhereInput {
  const conditions: Prisma.ProductWhereInput[] = [
    { status: 'ACTIVE' }, // Only active products
  ];

  // Full-text search
  if (filters.query) {
    conditions.push({
      OR: [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { sku: { contains: filters.query, mode: 'insensitive' } },
        { grade: { contains: filters.query, mode: 'insensitive' } },
        { certification: { contains: filters.query, mode: 'insensitive' } },
      ],
    });
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    conditions.push({
      categoryId: { in: filters.categories },
    });
  }

  // Price range
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceRange: { gte?: number; lte?: number } = {};
    if (filters.minPrice !== undefined) {
      priceRange.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      priceRange.lte = filters.maxPrice;
    }
    conditions.push({ price: priceRange });
  }

  // Metal type
  if (filters.metalTypes && filters.metalTypes.length > 0) {
    conditions.push({
      metalType: { in: filters.metalTypes as any[] },
    });
  }

  // Grade
  if (filters.grades && filters.grades.length > 0) {
    conditions.push({
      grade: { in: filters.grades },
    });
  }

  // Certification
  if (filters.certifications && filters.certifications.length > 0) {
    conditions.push({
      certification: { in: filters.certifications },
    });
  }

  // Year range
  if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
    const yearRange: { gte?: number; lte?: number } = {};
    if (filters.yearMin !== undefined) {
      yearRange.gte = filters.yearMin;
    }
    if (filters.yearMax !== undefined) {
      yearRange.lte = filters.yearMax;
    }
    conditions.push({ year: yearRange });
  }

  // Listing type
  if (filters.listingTypes && filters.listingTypes.length > 0) {
    conditions.push({
      listingType: { in: filters.listingTypes },
    });
  }

  // In stock
  if (filters.inStock) {
    conditions.push({
      quantity: { gt: 0 },
    });
  }

  return { AND: conditions };
}

/**
 * Build order by clause from sort option
 */
function buildOrderBy(sort: SortOption): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort.field) {
    case 'price':
      return [{ price: sort.direction }];
    case 'createdAt':
      return [{ createdAt: sort.direction }];
    case 'views':
      return [{ views: sort.direction }];
    case 'endTime':
      return [{ auction: { endTime: sort.direction } }];
    case 'relevance':
    default:
      // Relevance: featured first, then by views
      return [{ featured: 'desc' }, { views: 'desc' }, { createdAt: 'desc' }];
  }
}

/**
 * Compute facets for search results
 */
export async function computeFacets(filters: SearchFilters): Promise<SearchFacets> {
  const baseWhere = buildWhereClause({ ...filters, categories: undefined });

  // Get all facet counts in parallel
  const [categories, metalTypes, grades, certifications, priceStats, years] =
    await Promise.all([
      // Categories
      db.product.groupBy({
        by: ['categoryId'],
        where: baseWhere,
        _count: { id: true },
      }),
      // Metal types
      db.product.groupBy({
        by: ['metalType'],
        where: { ...baseWhere, metalType: { not: null } },
        _count: { id: true },
      }),
      // Grades
      db.product.groupBy({
        by: ['grade'],
        where: { ...baseWhere, grade: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      // Certifications
      db.product.groupBy({
        by: ['certification'],
        where: { ...baseWhere, certification: { not: null } },
        _count: { id: true },
      }),
      // Price stats for price range facets
      db.product.aggregate({
        where: baseWhere,
        _min: { price: true },
        _max: { price: true },
      }),
      // Years
      db.product.groupBy({
        by: ['year'],
        where: { ...baseWhere, year: { not: null } },
        _count: { id: true },
        orderBy: { year: 'desc' },
        take: 50,
      }),
    ]);

  // Get category names
  const categoryIds = categories.map((c) => c.categoryId);
  const categoryNames = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categoryNames.map((c) => [c.id, c.name]));

  // Build price range buckets
  const minPrice = priceStats._min.price?.toNumber() || 0;
  const maxPrice = priceStats._max.price?.toNumber() || 10000;
  const priceRanges = buildPriceRangeFacets(minPrice, maxPrice);

  return {
    categories: categories.map((c) => ({
      value: c.categoryId,
      label: categoryMap.get(c.categoryId) || c.categoryId,
      count: c._count.id,
    })),
    metalTypes: metalTypes.map((m) => ({
      value: m.metalType || '',
      label: formatMetalType(m.metalType),
      count: m._count.id,
    })),
    grades: grades.map((g) => ({
      value: g.grade || '',
      label: g.grade || '',
      count: g._count.id,
    })),
    certifications: certifications.map((c) => ({
      value: c.certification || '',
      label: c.certification || '',
      count: c._count.id,
    })),
    priceRanges,
    years: years.map((y) => ({
      value: String(y.year),
      label: String(y.year),
      count: y._count.id,
    })),
  };
}

/**
 * Build price range facet buckets
 */
function buildPriceRangeFacets(min: number, max: number): FacetBucket[] {
  const ranges = [
    { min: 0, max: 25, label: 'Under $25' },
    { min: 25, max: 50, label: '$25 - $50' },
    { min: 50, max: 100, label: '$50 - $100' },
    { min: 100, max: 250, label: '$100 - $250' },
    { min: 250, max: 500, label: '$250 - $500' },
    { min: 500, max: 1000, label: '$500 - $1,000' },
    { min: 1000, max: 5000, label: '$1,000 - $5,000' },
    { min: 5000, max: Infinity, label: '$5,000+' },
  ];

  return ranges
    .filter((r) => r.min <= max && r.max >= min)
    .map((r) => ({
      value: `${r.min}-${r.max === Infinity ? '' : r.max}`,
      label: r.label,
      count: 0, // Count would be computed with additional query
    }));
}

function formatMetalType(type: string | null): string {
  if (!type) return 'Unknown';
  return type.charAt(0) + type.slice(1).toLowerCase();
}

/**
 * Get search suggestions for autocomplete
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = 10
): Promise<string[]> {
  if (!query || query.length < 2) return [];

  const products = await db.product.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { grade: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: { title: true },
    take: limit,
    orderBy: { views: 'desc' },
  });

  return [...new Set(products.map((p) => p.title))];
}

/**
 * Get trending searches (based on popular products)
 */
export async function getTrendingSearches(limit: number = 10): Promise<string[]> {
  const products = await db.product.findMany({
    where: { status: 'ACTIVE' },
    select: { title: true },
    orderBy: { views: 'desc' },
    take: limit,
  });

  // Extract key terms from titles
  return products.map((p) => {
    // Simplify title for search term
    const words = p.title.split(' ').slice(0, 4).join(' ');
    return words;
  });
}

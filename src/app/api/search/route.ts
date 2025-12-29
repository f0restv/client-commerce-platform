import { NextRequest, NextResponse } from 'next/server';
import {
  searchProducts,
  getSearchSuggestions,
  getTrendingSearches,
} from '@/lib/services/search';
import type { SearchFilters, SortOption } from '@/lib/services/search';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params
    const filters: SearchFilters = {
      query: searchParams.get('q') || undefined,
      categories: searchParams.get('categories')?.split(',').filter(Boolean),
      minPrice: searchParams.get('minPrice')
        ? parseFloat(searchParams.get('minPrice')!)
        : undefined,
      maxPrice: searchParams.get('maxPrice')
        ? parseFloat(searchParams.get('maxPrice')!)
        : undefined,
      metalTypes: searchParams.get('metalTypes')?.split(',').filter(Boolean),
      grades: searchParams.get('grades')?.split(',').filter(Boolean),
      certifications: searchParams.get('certifications')?.split(',').filter(Boolean),
      yearMin: searchParams.get('yearMin')
        ? parseInt(searchParams.get('yearMin')!)
        : undefined,
      yearMax: searchParams.get('yearMax')
        ? parseInt(searchParams.get('yearMax')!)
        : undefined,
      listingTypes: searchParams.get('listingTypes')?.split(',').filter(Boolean) as any,
      inStock: searchParams.get('inStock') === 'true',
    };

    // Parse sort
    const sortField = searchParams.get('sortBy') || 'relevance';
    const sortDirection = searchParams.get('sortDir') || 'desc';
    const sort: SortOption = {
      field: sortField as SortOption['field'],
      direction: sortDirection as SortOption['direction'],
    };

    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '24'), 100);

    const results = await searchProducts(filters, sort, page, pageSize);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

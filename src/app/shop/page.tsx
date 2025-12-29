import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MetalTicker } from "@/components/shop/metal-ticker";
import { CategoryNav } from "@/components/shop/category-nav";
import { ProfileHeader } from "@/components/shop/profile-header";
import { ProductGrid } from "@/components/shop/product-grid";
import { SearchBar } from "@/components/shop/search-bar";
import { SearchFilters, ActiveFilters } from "@/components/shop/search-filters";
import { SortDropdown, ResultsHeader, SearchPagination } from "@/components/shop/sort-dropdown";
import { searchProducts, computeFacets } from "@/lib/services/search";
import type { SearchFilters as SearchFiltersType, SortOption } from "@/lib/services/search";

type SortString = "relevance" | "newest" | "price-asc" | "price-desc" | "popular" | "ending-soon";

function parseSortOption(sort: string | undefined): SortOption {
  switch (sort) {
    case "newest":
      return { field: "createdAt", direction: "desc" };
    case "price-asc":
      return { field: "price", direction: "asc" };
    case "price-desc":
      return { field: "price", direction: "desc" };
    case "popular":
      return { field: "views", direction: "desc" };
    case "ending-soon":
      return { field: "endTime", direction: "asc" };
    case "relevance":
    default:
      return { field: "relevance", direction: "desc" };
  }
}

// Mock data - replace with actual data fetching
const shopProfile = {
  shopName: "CoinVault",
  shopHandle: "coinvault",
  bio: "Premium coins, bullion, and collectibles. Trusted by collectors since 2024. We specialize in certified US coins, world coins, and precious metals.",
  avatarUrl: "/api/placeholder/150/150",
  stats: {
    posts: 1250,
    followers: 5420,
    sales: 3200,
  },
  verified: true,
};

interface ShopPageProps {
  searchParams: Promise<{
    q?: string;
    categories?: string;
    minPrice?: string;
    maxPrice?: string;
    metalTypes?: string;
    grades?: string;
    certifications?: string;
    yearMin?: string;
    yearMax?: string;
    listingTypes?: string;
    inStock?: string;
    sort?: SortString;
    page?: string;
  }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const perPage = 24;

  // Build filters from search params
  const filters: SearchFiltersType = {
    query: params.q,
    categories: params.categories?.split(",").filter(Boolean),
    minPrice: params.minPrice ? parseFloat(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
    metalTypes: params.metalTypes?.split(",").filter(Boolean),
    grades: params.grades?.split(",").filter(Boolean),
    certifications: params.certifications?.split(",").filter(Boolean),
    yearMin: params.yearMin ? parseInt(params.yearMin, 10) : undefined,
    yearMax: params.yearMax ? parseInt(params.yearMax, 10) : undefined,
    listingTypes: params.listingTypes?.split(",").filter(Boolean) as SearchFiltersType["listingTypes"],
    inStock: params.inStock === "true",
  };

  const sort = parseSortOption(params.sort);

  // Fetch search results
  let searchResult;
  let facets;
  
  try {
    searchResult = await searchProducts(filters, sort, page, perPage);
    facets = await computeFacets(filters);
  } catch (error) {
    // Fallback if search fails (e.g., DB not connected)
    console.error("Search error:", error);
    searchResult = { products: [], total: 0, page: 1, perPage: 24, totalPages: 0 };
    facets = {
      categories: [],
      metalTypes: [],
      grades: [],
      certifications: [],
      priceRanges: [],
      years: [],
    };
  }

  const hasSearchQuery = Boolean(params.q);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <MetalTicker />

      {/* Instagram-style Profile Header */}
      <ProfileHeader {...shopProfile} />

      {/* Search Bar */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-gray-200" />}>
          <SearchBar />
        </Suspense>
      </div>

      {/* Category Navigation */}
      <CategoryNav />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Active Filters */}
        <Suspense fallback={null}>
          <ActiveFilters className="mb-4" />
        </Suspense>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className="hidden w-64 flex-shrink-0 lg:block">
            <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-gray-200" />}>
              <SearchFilters facets={facets} />
            </Suspense>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="mb-4 flex items-center justify-between">
              <ResultsHeader
                totalCount={searchResult.total}
                currentPage={searchResult.page}
                perPage={searchResult.perPage}
              />
              <Suspense fallback={<div className="h-10 w-40 animate-pulse rounded bg-gray-200" />}>
                <SortDropdown />
              </Suspense>
            </div>

            {/* Search Results */}
            {searchResult.products.length > 0 ? (
              <>
                <ProductGrid 
                  products={searchResult.products.map(p => ({
                    id: p.id,
                    title: p.title,
                    price: p.price,
                    images: p.images,
                    listingType: p.listingType as "BUY_NOW" | "AUCTION",
                    metalType: p.metalType || undefined,
                    grade: p.grade || undefined,
                    certification: p.certification || undefined,
                    status: "ACTIVE",
                    auction: p.auction,
                  }))} 
                  columns={3} 
                />
                
                {/* Pagination */}
                <div className="mt-8">
                  <SearchPagination
                    currentPage={searchResult.page}
                    totalPages={searchResult.totalPages}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    {hasSearchQuery ? "No results found" : "No products available"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {hasSearchQuery
                      ? "Try adjusting your search or filters"
                      : "Check back soon for new listings"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

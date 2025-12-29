"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortOptionString = "relevance" | "newest" | "price-asc" | "price-desc" | "popular" | "ending-soon";

const SORT_OPTIONS: Array<{ value: SortOptionString; label: string }> = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
  { value: "ending-soon", label: "Ending Soon" },
];

interface SortDropdownProps {
  className?: string;
}

export function SortDropdown({ className }: SortDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = (searchParams.get("sort") as SortOptionString) || "relevance";

  const currentLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label || "Sort by";

  const handleSort = (sort: SortOptionString) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "relevance") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }
    router.push(`/shop?${params.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("gap-2", className)}>
          <ArrowUpDown className="h-4 w-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleSort(option.value)}
            className="flex items-center justify-between"
          >
            {option.label}
            {currentSort === option.value && (
              <Check className="h-4 w-4 text-amber-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Results count and grid/list toggle
interface ResultsHeaderProps {
  totalCount: number;
  currentPage: number;
  perPage: number;
  className?: string;
}

export function ResultsHeader({
  totalCount,
  currentPage,
  perPage,
  className,
}: ResultsHeaderProps) {
  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalCount);

  return (
    <div className={cn("text-sm text-gray-600", className)}>
      Showing {start}-{end} of {totalCount.toLocaleString()} results
    </div>
  );
}

// Pagination component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  className?: string;
}

export function SearchPagination({
  currentPage,
  totalPages,
  className,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/shop?${params.toString()}`);
  };

  // Generate page numbers to show
  const pages: (number | "...")[] = [];
  const showEllipsis = totalPages > 7;

  if (showEllipsis) {
    if (currentPage <= 4) {
      // Show first 5 pages + ellipsis + last page
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      // Show first page + ellipsis + last 5 pages
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      // Show first + ellipsis + current-1, current, current+1 + ellipsis + last
      pages.push(1);
      pages.push("...");
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    }
  } else {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  }

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => goToPage(page)}
            className={cn(
              "min-w-[36px]",
              page === currentPage && "bg-amber-600 hover:bg-amber-700"
            )}
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </nav>
  );
}

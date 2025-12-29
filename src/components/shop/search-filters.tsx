"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Check,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { SearchFacets } from "@/lib/services/search";

interface SearchFiltersProps {
  facets: SearchFacets;
  className?: string;
}

export function SearchFilters({ facets, className }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["categories", "priceRanges", "metalTypes"])
  );

  // Get current filters from URL
  const currentFilters = {
    categories: searchParams.get("categories")?.split(",").filter(Boolean) || [],
    metalTypes: searchParams.get("metalTypes")?.split(",").filter(Boolean) || [],
    grades: searchParams.get("grades")?.split(",").filter(Boolean) || [],
    certifications: searchParams.get("certifications")?.split(",").filter(Boolean) || [],
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    yearMin: searchParams.get("yearMin") || "",
    yearMax: searchParams.get("yearMax") || "",
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const updateFilter = (key: string, value: string, isMulti = true) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (isMulti) {
      const current = params.get(key)?.split(",").filter(Boolean) || [];
      const index = current.indexOf(value);
      
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(value);
      }
      
      if (current.length > 0) {
        params.set(key, current.join(","));
      } else {
        params.delete(key);
      }
    } else {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    
    params.set("page", "1"); // Reset pagination
    router.push(`/shop?${params.toString()}`);
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(`/shop?${params.toString()}`);
  };

  const hasActiveFilters =
    currentFilters.categories.length > 0 ||
    currentFilters.metalTypes.length > 0 ||
    currentFilters.grades.length > 0 ||
    currentFilters.certifications.length > 0 ||
    currentFilters.minPrice ||
    currentFilters.maxPrice;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <span className="font-semibold">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-amber-600 hover:text-amber-700"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Categories */}
      <FilterSection
        title="Categories"
        isExpanded={expandedSections.has("categories")}
        onToggle={() => toggleSection("categories")}
      >
        {facets.categories.map((cat) => (
          <FilterCheckbox
            key={cat.value}
            label={cat.label}
            count={cat.count}
            checked={currentFilters.categories.includes(cat.value)}
            onChange={() => updateFilter("categories", cat.value)}
          />
        ))}
      </FilterSection>

      {/* Price Range */}
      <FilterSection
        title="Price"
        isExpanded={expandedSections.has("priceRanges")}
        onToggle={() => toggleSection("priceRanges")}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={currentFilters.minPrice}
              onChange={(e) => updateFilter("minPrice", e.target.value, false)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              placeholder="Max"
              value={currentFilters.maxPrice}
              onChange={(e) => updateFilter("maxPrice", e.target.value, false)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {facets.priceRanges.slice(0, 6).map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  const [min, max] = range.value.split("-");
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("minPrice", min);
                  if (max) params.set("maxPrice", max);
                  else params.delete("maxPrice");
                  params.set("page", "1");
                  router.push(`/shop?${params.toString()}`);
                }}
                className="rounded-full border border-gray-200 px-2 py-1 text-xs hover:border-amber-500 hover:bg-amber-50"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* Metal Type */}
      {facets.metalTypes.length > 0 && (
        <FilterSection
          title="Metal Type"
          isExpanded={expandedSections.has("metalTypes")}
          onToggle={() => toggleSection("metalTypes")}
        >
          {facets.metalTypes.map((metal) => (
            <FilterCheckbox
              key={metal.value}
              label={metal.label}
              count={metal.count}
              checked={currentFilters.metalTypes.includes(metal.value)}
              onChange={() => updateFilter("metalTypes", metal.value)}
            />
          ))}
        </FilterSection>
      )}

      {/* Grade */}
      {facets.grades.length > 0 && (
        <FilterSection
          title="Grade"
          isExpanded={expandedSections.has("grades")}
          onToggle={() => toggleSection("grades")}
        >
          {facets.grades.slice(0, 10).map((grade) => (
            <FilterCheckbox
              key={grade.value}
              label={grade.label}
              count={grade.count}
              checked={currentFilters.grades.includes(grade.value)}
              onChange={() => updateFilter("grades", grade.value)}
            />
          ))}
        </FilterSection>
      )}

      {/* Certification */}
      {facets.certifications.length > 0 && (
        <FilterSection
          title="Certification"
          isExpanded={expandedSections.has("certifications")}
          onToggle={() => toggleSection("certifications")}
        >
          {facets.certifications.map((cert) => (
            <FilterCheckbox
              key={cert.value}
              label={cert.label}
              count={cert.count}
              checked={currentFilters.certifications.includes(cert.value)}
              onChange={() => updateFilter("certifications", cert.value)}
            />
          ))}
        </FilterSection>
      )}

      {/* Year */}
      {facets.years.length > 0 && (
        <FilterSection
          title="Year"
          isExpanded={expandedSections.has("years")}
          onToggle={() => toggleSection("years")}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="From"
              value={currentFilters.yearMin}
              onChange={(e) => updateFilter("yearMin", e.target.value, false)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              placeholder="To"
              value={currentFilters.yearMax}
              onChange={(e) => updateFilter("yearMax", e.target.value, false)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </FilterSection>
      )}
    </div>
  );
}

function FilterSection({
  title,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200 pb-4">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2 text-left font-medium"
      >
        {title}
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {isExpanded && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function FilterCheckbox({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={onChange} />
        <span>{label}</span>
      </div>
      <span className="text-gray-400">({count})</span>
    </label>
  );
}

// Active filter tags component
export function ActiveFilters({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeFilters: Array<{ key: string; value: string; label: string }> = [];

  // Collect all active filters
  const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  categories.forEach((c) =>
    activeFilters.push({ key: "categories", value: c, label: c })
  );

  const metalTypes = searchParams.get("metalTypes")?.split(",").filter(Boolean) || [];
  metalTypes.forEach((m) =>
    activeFilters.push({ key: "metalTypes", value: m, label: m })
  );

  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  if (minPrice || maxPrice) {
    const label = minPrice && maxPrice
      ? `$${minPrice} - $${maxPrice}`
      : minPrice
      ? `$${minPrice}+`
      : `Up to $${maxPrice}`;
    activeFilters.push({ key: "price", value: "range", label });
  }

  if (activeFilters.length === 0) return null;

  const removeFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (key === "price") {
      params.delete("minPrice");
      params.delete("maxPrice");
    } else {
      const current = params.get(key)?.split(",").filter(Boolean) || [];
      const index = current.indexOf(value);
      if (index >= 0) {
        current.splice(index, 1);
        if (current.length > 0) {
          params.set(key, current.join(","));
        } else {
          params.delete(key);
        }
      }
    }
    
    router.push(`/shop?${params.toString()}`);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {activeFilters.map((filter, i) => (
        <span
          key={`${filter.key}-${filter.value}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700"
        >
          {filter.label}
          <button
            onClick={() => removeFilter(filter.key, filter.value)}
            className="ml-1 hover:text-amber-900"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

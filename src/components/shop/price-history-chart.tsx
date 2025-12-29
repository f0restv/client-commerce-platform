"use client";

import React, { useEffect, useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface PriceHistoryData {
  date: string;
  price: number;
  source?: string;
}

interface PriceStats {
  current: number;
  high: number;
  low: number;
  average: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
}

interface PriceHistoryChartProps {
  productId: string;
  className?: string;
  height?: number;
  showStats?: boolean;
  period?: "7d" | "30d" | "90d" | "1y" | "all";
}

export function PriceHistoryChart({
  productId,
  className,
  height = 200,
  showStats = true,
  period = "90d",
}: PriceHistoryChartProps) {
  const [data, setData] = useState<PriceHistoryData[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [hoveredPoint, setHoveredPoint] = useState<PriceHistoryData | null>(null);

  useEffect(() => {
    fetchPriceHistory();
  }, [productId, selectedPeriod]);

  const fetchPriceHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/products/${productId}/price-history?period=${selectedPeriod}`
      );
      if (res.ok) {
        const result = await res.json();
        setData(result.history);
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Failed to fetch price history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-500",
          className
        )}
        style={{ height }}
      >
        No price history available
      </div>
    );
  }

  // Calculate chart dimensions
  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  const chartPadding = 40;
  const chartHeight = height - chartPadding * 2;

  // Generate SVG path
  const getY = (price: number) =>
    chartPadding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  const pathD = data
    .map((point, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = getY(point.price);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Area fill
  const areaD = `${pathD} L 100 ${height - chartPadding} L 0 ${height - chartPadding} Z`;

  const TrendIcon =
    stats?.trend === "up"
      ? TrendingUp
      : stats?.trend === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    stats?.trend === "up"
      ? "text-green-600"
      : stats?.trend === "down"
      ? "text-red-600"
      : "text-gray-500";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Period Selector */}
      <div className="flex gap-1">
        {(["7d", "30d", "90d", "1y", "all"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPeriod(p)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              selectedPeriod === p
                ? "bg-amber-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {p === "all" ? "All" : p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      {showStats && stats && (
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
          <div>
            <p className="text-xs text-gray-500">Current</p>
            <p className="font-semibold">{formatCurrency(stats.current)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Average</p>
            <p className="font-medium">{formatCurrency(stats.average)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Range</p>
            <p className="text-sm">
              {formatCurrency(stats.low)} - {formatCurrency(stats.high)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Change</p>
            <div className={cn("flex items-center gap-1", trendColor)}>
              <TrendIcon className="h-4 w-4" />
              <span className="font-medium">
                {stats.changePercent > 0 ? "+" : ""}
                {stats.changePercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={(y / 100) * height}
              x2="100"
              y2={(y / 100) * height}
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          ))}

          {/* Area fill with gradient */}
          <defs>
            <linearGradient id={`priceGradient-${productId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#priceGradient-${productId})`} />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Interactive points */}
          {data.map((point, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = getY(point.price);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill={hoveredPoint === point ? "#f59e0b" : "transparent"}
                stroke={hoveredPoint === point ? "#f59e0b" : "transparent"}
                strokeWidth="2"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(point)}
              />
            );
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between text-xs text-gray-400">
          <span>{formatCurrency(maxPrice)}</span>
          <span>{formatCurrency(minPrice)}</span>
        </div>

        {/* Hover tooltip */}
        {hoveredPoint && (
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
            <p className="font-semibold">{formatCurrency(hoveredPoint.price)}</p>
            <p className="text-gray-300">
              {new Date(hoveredPoint.date).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact price trend indicator for product cards
interface PriceTrendBadgeProps {
  changePercent: number;
  className?: string;
}

export function PriceTrendBadge({ changePercent, className }: PriceTrendBadgeProps) {
  const isUp = changePercent > 0;
  const isStable = Math.abs(changePercent) < 1;

  if (isStable) {
    return (
      <span className={cn("inline-flex items-center text-xs text-gray-500", className)}>
        <Minus className="mr-1 h-3 w-3" />
        Stable
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium",
        isUp ? "text-green-600" : "text-red-600",
        className
      )}
    >
      {isUp ? (
        <TrendingUp className="mr-1 h-3 w-3" />
      ) : (
        <TrendingDown className="mr-1 h-3 w-3" />
      )}
      {isUp ? "+" : ""}
      {changePercent.toFixed(1)}%
    </span>
  );
}

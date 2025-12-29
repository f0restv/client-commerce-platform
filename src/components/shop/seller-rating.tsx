"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Star, ThumbsUp, Package, Truck, MessageCircle } from "lucide-react";

interface SellerRatingSummary {
  totalReviews: number;
  averageRating: number;
  averageItemAsDescribed: number;
  averageShipping: number;
  averageCommunication: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface SellerRatingProps {
  summary: SellerRatingSummary;
  className?: string;
  compact?: boolean;
}

export function SellerRating({ summary, className, compact = false }: SellerRatingProps) {
  if (summary.totalReviews === 0) {
    return (
      <div className={cn("text-sm text-gray-500", className)}>
        No reviews yet
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span className="font-medium">{summary.averageRating.toFixed(1)}</span>
        <span className="text-gray-400">({summary.totalReviews})</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Overall Rating */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold">{summary.averageRating.toFixed(1)}</div>
          <StarRating rating={summary.averageRating} size="lg" />
          <p className="mt-1 text-sm text-gray-500">
            {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
          </p>
        </div>

        {/* Rating Distribution */}
        <div className="flex-1 space-y-1">
          {([5, 4, 3, 2, 1] as const).map((stars) => {
            const count = summary.ratingDistribution[stars];
            const percentage =
              summary.totalReviews > 0
                ? (count / summary.totalReviews) * 100
                : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <span className="w-3">{stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right text-gray-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Ratings */}
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
        <CategoryRating
          icon={Package}
          label="Item as Described"
          rating={summary.averageItemAsDescribed}
        />
        <CategoryRating
          icon={Truck}
          label="Shipping"
          rating={summary.averageShipping}
        />
        <CategoryRating
          icon={MessageCircle}
          label="Communication"
          rating={summary.averageCommunication}
        />
      </div>
    </div>
  );
}

function CategoryRating({
  icon: Icon,
  label,
  rating,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  rating: number;
}) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-5 w-5 text-gray-400" />
      <p className="mt-1 text-xs text-gray-500">{label}</p>
      <p className="font-medium">{rating.toFixed(1)}</p>
    </div>
  );
}

// Star Rating Component
interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({
  rating,
  size = "md",
  interactive = false,
  onChange,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = React.useState(0);

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayRating;
        const halfFilled = !filled && star <= displayRating + 0.5;

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={cn(
              "relative",
              interactive && "cursor-pointer hover:scale-110 transition-transform"
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                filled || halfFilled
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              )}
            />
            {halfFilled && (
              <Star
                className={cn(
                  sizeClasses[size],
                  "absolute left-0 top-0 fill-amber-400 text-amber-400"
                )}
                style={{ clipPath: "inset(0 50% 0 0)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Individual Review Card
interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    itemAsDescribed: number;
    shipping: number;
    communication: number;
    comment?: string | null;
    createdAt: string | Date;
    helpfulCount: number;
    reviewer: {
      name: string | null;
      image: string | null;
    };
    order?: {
      items: Array<{
        product: {
          title: string;
        } | null;
      }>;
    };
  };
  onMarkHelpful?: () => void;
}

export function ReviewCard({ review, onMarkHelpful }: ReviewCardProps) {
  const productTitle = review.order?.items[0]?.product?.title;

  return (
    <div className="border-b border-gray-100 py-4 last:border-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {review.reviewer.image ? (
            <img
              src={review.reviewer.image}
              alt={review.reviewer.name || "Reviewer"}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-500">
              {review.reviewer.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <p className="font-medium">{review.reviewer.name || "Anonymous"}</p>
            <StarRating rating={review.rating} size="sm" />
          </div>
        </div>
        <time className="text-sm text-gray-400">
          {new Date(review.createdAt).toLocaleDateString()}
        </time>
      </div>

      {productTitle && (
        <p className="mt-2 text-sm text-gray-500">
          Purchased: {productTitle}
        </p>
      )}

      {review.comment && (
        <p className="mt-2 text-gray-700">{review.comment}</p>
      )}

      {/* Sub-ratings */}
      <div className="mt-3 flex gap-4 text-sm text-gray-500">
        <span>Item: {review.itemAsDescribed}/5</span>
        <span>Shipping: {review.shipping}/5</span>
        <span>Communication: {review.communication}/5</span>
      </div>

      {/* Helpful button */}
      <button
        onClick={onMarkHelpful}
        className="mt-3 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
      >
        <ThumbsUp className="h-4 w-4" />
        Helpful ({review.helpfulCount})
      </button>
    </div>
  );
}

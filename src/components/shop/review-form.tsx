"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "./seller-rating";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, Package, Truck, MessageCircle } from "lucide-react";

interface ReviewFormProps {
  orderId: string;
  productTitle: string;
  sellerName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReviewForm({
  orderId,
  productTitle,
  sellerName,
  isOpen,
  onClose,
  onSuccess,
}: ReviewFormProps) {
  const [ratings, setRatings] = useState({
    overall: 0,
    itemAsDescribed: 0,
    shipping: 0,
    communication: 0,
  });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    if (Object.values(ratings).some((r) => r === 0)) {
      setError("Please provide all ratings");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          rating: ratings.overall,
          itemAsDescribed: ratings.itemAsDescribed,
          shipping: ratings.shipping,
          communication: ratings.communication,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  const updateRating = (key: keyof typeof ratings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="mt-4 text-lg font-medium">Thank you for your review!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Info */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-500">Review for</p>
              <p className="font-medium">{productTitle}</p>
              <p className="text-sm text-gray-500">Sold by {sellerName}</p>
            </div>

            {/* Overall Rating */}
            <div>
              <label className="text-sm font-medium">Overall Rating</label>
              <div className="mt-2 flex items-center gap-3">
                <StarRating
                  rating={ratings.overall}
                  size="lg"
                  interactive
                  onChange={(r) => updateRating("overall", r)}
                />
                <span className="text-lg font-medium">
                  {ratings.overall > 0 ? ratings.overall : "-"}/5
                </span>
              </div>
            </div>

            {/* Category Ratings */}
            <div className="space-y-4">
              <RatingRow
                icon={Package}
                label="Item as Described"
                sublabel="Did the item match the listing?"
                rating={ratings.itemAsDescribed}
                onChange={(r) => updateRating("itemAsDescribed", r)}
              />
              <RatingRow
                icon={Truck}
                label="Shipping"
                sublabel="Was shipping fast and item well-packaged?"
                rating={ratings.shipping}
                onChange={(r) => updateRating("shipping", r)}
              />
              <RatingRow
                icon={MessageCircle}
                label="Communication"
                sublabel="Was the seller responsive and helpful?"
                rating={ratings.communication}
                onChange={(r) => updateRating("communication", r)}
              />
            </div>

            {/* Comment */}
            <div>
              <label className="text-sm font-medium">
                Your Review{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this seller..."
                rows={4}
                className="mt-1"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit Review"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RatingRow({
  icon: Icon,
  label,
  sublabel,
  rating,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  rating: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-gray-400" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-gray-400">{sublabel}</p>
        </div>
      </div>
      <StarRating rating={rating} interactive onChange={onChange} />
    </div>
  );
}

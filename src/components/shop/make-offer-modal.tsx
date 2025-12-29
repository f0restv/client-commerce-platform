"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import { DollarSign, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface MakeOfferModalProps {
  productId: string;
  productTitle: string;
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MakeOfferModal({
  productId,
  productTitle,
  currentPrice,
  isOpen,
  onClose,
  onSuccess,
}: MakeOfferModalProps) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const suggestedOffers = [
    currentPrice * 0.9, // 10% off
    currentPrice * 0.85, // 15% off
    currentPrice * 0.8, // 20% off
  ].map((v) => Math.round(v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const offerAmount = parseFloat(amount);
    if (isNaN(offerAmount) || offerAmount <= 0) {
      setError("Please enter a valid offer amount");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          amount: offerAmount,
          message: message.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit offer");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset state
        setAmount("");
        setMessage("");
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit offer");
    } finally {
      setLoading(false);
    }
  };

  const percentOff = amount
    ? Math.round((1 - parseFloat(amount) / currentPrice) * 100)
    : 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) {
          onClose();
          setAmount("");
          setMessage("");
          setError(null);
          setSuccess(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make an Offer</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {productTitle}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="mt-4 text-lg font-medium">Offer Submitted!</p>
            <p className="text-sm text-gray-500">
              The seller will be notified of your offer.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Price */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-500">Current Price</p>
              <p className="text-xl font-bold">{formatCurrency(currentPrice)}</p>
            </div>

            {/* Offer Amount */}
            <div>
              <label className="text-sm font-medium">Your Offer</label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              {amount && parseFloat(amount) > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  {percentOff > 0 ? (
                    <span className="text-green-600">{percentOff}% off asking price</span>
                  ) : percentOff < 0 ? (
                    <span className="text-amber-600">
                      {Math.abs(percentOff)}% above asking price
                    </span>
                  ) : (
                    "Same as asking price"
                  )}
                </p>
              )}
            </div>

            {/* Quick Offer Buttons */}
            <div>
              <label className="text-sm text-gray-500">Quick offers</label>
              <div className="mt-1 flex gap-2">
                {suggestedOffers.map((suggested) => (
                  <button
                    key={suggested}
                    type="button"
                    onClick={() => setAmount(suggested.toString())}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-sm transition-colors",
                      amount === suggested.toString()
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {formatCurrency(suggested)}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-sm font-medium">
                Message to Seller{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a note to the seller..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Info */}
            <p className="text-xs text-gray-400">
              Your offer will expire in 48 hours if the seller doesn&apos;t respond.
            </p>

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
                disabled={loading || !amount}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Submit Offer"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Button to trigger the modal
interface MakeOfferButtonProps {
  productId: string;
  productTitle: string;
  currentPrice: number;
  className?: string;
  variant?: "default" | "outline";
}

export function MakeOfferButton({
  productId,
  productTitle,
  currentPrice,
  className,
  variant = "outline",
}: MakeOfferButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setIsOpen(true)}
        className={className}
      >
        Make Offer
      </Button>
      <MakeOfferModal
        productId={productId}
        productTitle={productTitle}
        currentPrice={currentPrice}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gavel,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  Zap,
} from "lucide-react";

interface AuctionBidderProps {
  auctionId: string;
  productTitle: string;
  currentBid: number;
  bidIncrement: number;
  endTime: string | Date;
  bidCount: number;
  buyNowPrice?: number | null;
  isHighBidder?: boolean;
  reservePrice?: number | null;
  reserveMet?: boolean;
  onBidPlaced?: () => void;
}

export function AuctionBidder({
  auctionId,
  productTitle,
  currentBid,
  bidIncrement,
  endTime,
  bidCount,
  buyNowPrice,
  isHighBidder = false,
  reservePrice,
  reserveMet = true,
  onBidPlaced,
}: AuctionBidderProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isEnding, setIsEnding] = useState(false);

  const minimumBid = currentBid + bidIncrement;

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        setIsEnding(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
        setIsEnding(false);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setIsEnding(hours < 1);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
        setIsEnding(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const handleBid = async (amount: number) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to place bid");
      }

      setSuccess(
        data.isBuyNow
          ? "Congratulations! You won with Buy It Now!"
          : `Bid of ${formatCurrency(amount)} placed successfully!`
      );
      setBidAmount("");
      onBidPlaced?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minimumBid) {
      setError(`Minimum bid is ${formatCurrency(minimumBid)}`);
      return;
    }
    handleBid(amount);
  };

  const quickBids = [
    minimumBid,
    minimumBid + bidIncrement,
    minimumBid + bidIncrement * 2,
  ];

  const ended = timeLeft === "Ended";

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      {/* Current Bid */}
      <div className="text-center">
        <p className="text-sm text-gray-500">Current Bid</p>
        <p className="text-3xl font-bold text-amber-600">
          {formatCurrency(currentBid)}
        </p>
        <div className="mt-1 flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {bidCount} {bidCount === 1 ? "bid" : "bids"}
          </span>
          <span
            className={cn(
              "flex items-center gap-1",
              isEnding ? "text-red-600 font-medium" : ""
            )}
          >
            <Clock className="h-4 w-4" />
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Reserve Status */}
      {reservePrice && !reserveMet && (
        <div className="flex items-center justify-center gap-1 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          Reserve not met
        </div>
      )}

      {/* High Bidder Status */}
      {isHighBidder && !ended && (
        <div className="rounded-lg bg-green-50 p-2 text-center text-sm text-green-700">
          <TrendingUp className="mr-1 inline h-4 w-4" />
          You&apos;re the high bidder!
        </div>
      )}

      {ended ? (
        <div className="text-center">
          <p className="font-medium text-gray-600">This auction has ended</p>
          {isHighBidder && (
            <p className="mt-1 text-green-600">Congratulations, you won!</p>
          )}
        </div>
      ) : (
        <>
          {/* Bid Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Your Bid</label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Min: ${formatCurrency(minimumBid)}`}
                  min={minimumBid}
                  step="0.01"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={loading || !bidAmount}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Gavel className="mr-1 h-4 w-4" />
                      Bid
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Bid Buttons */}
            <div className="flex gap-2">
              {quickBids.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleBid(amount)}
                  disabled={loading}
                  className="flex-1 rounded border border-gray-200 py-2 text-sm hover:border-amber-500 hover:bg-amber-50"
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
          </form>

          {/* Buy It Now */}
          {buyNowPrice && (
            <div className="border-t border-gray-100 pt-3">
              <Button
                onClick={() => handleBid(buyNowPrice)}
                disabled={loading}
                variant="outline"
                className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <Zap className="mr-1 h-4 w-4" />
                Buy It Now for {formatCurrency(buyNowPrice)}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 p-2 text-center text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-center text-gray-400">
        Bid increment: {formatCurrency(bidIncrement)}
      </p>
    </div>
  );
}

// Compact auction timer for product cards
interface AuctionTimerProps {
  endTime: string | Date;
  className?: string;
}

export function AuctionTimer({ endTime, className }: AuctionTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d left`);
        setIsEnding(false);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setIsEnding(hours < 2);
      } else {
        setTimeLeft(`${minutes}m`);
        setIsEnding(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm",
        isEnding ? "text-red-600 font-medium" : "text-gray-500",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </span>
  );
}

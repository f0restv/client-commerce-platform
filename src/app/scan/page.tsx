"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Sparkles,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisResult {
  possibleIdentification: string;
  confidence: number;
  suggestedCategory: string;
  estimatedGrade?: string;
  gradeConfidence?: number;
  year?: number;
  mint?: string;
  certification?: string;
  additionalNotes?: string;
  estimatedValue?: {
    low: number;
    mid: number;
    high: number;
  };
  marketTrend?: "rising" | "stable" | "declining";
  avgDaysToSell?: number;
  demandLevel?: "high" | "medium" | "low";
  recommendedPrice?: number;
  pricingStrategy?: string;
  keyFactors?: string[];
}

interface MarketStats {
  avgPrice?: number;
  medianPrice?: number;
  salesCount?: number;
}

interface Comparable {
  title: string;
  soldPrice: number;
  soldDate: string;
}

type ScanState = "idle" | "capturing" | "analyzing" | "results" | "saving" | "saved";

// ============================================================================
// SCAN PAGE
// ============================================================================

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // State
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [imageData, setImageData] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // ============================================================================
  // CAMERA FUNCTIONS
  // ============================================================================

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        setScanState("capturing");
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Camera access denied. Please use file upload instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setImageData(dataUrl);
      stopCamera();
      analyzeImage(dataUrl);
    }
  };

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageData(dataUrl);
      analyzeImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"] },
    maxFiles: 1,
    multiple: false,
  });

  // ============================================================================
  // AI ANALYSIS
  // ============================================================================

  const analyzeImage = async (dataUrl: string) => {
    setScanState("analyzing");
    setError(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [dataUrl],
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setMarketStats(data.marketStats || null);
      setComparables(data.comparables || []);
      setScanState("results");
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Analysis failed. Please try again.");
      setScanState("idle");
    }
  };

  // ============================================================================
  // SAVE TO INVENTORY
  // ============================================================================

  const saveToInventory = async () => {
    if (!analysis || !imageData) return;

    setScanState("saving");
    setError(null);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: analysis.possibleIdentification,
          category: analysis.suggestedCategory,
          price: analysis.recommendedPrice || analysis.estimatedValue?.mid,
          images: [{ url: imageData, isPrimary: true }],
          aiAnalysis: analysis,
          status: "DRAFT",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setScanState("saved");
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save. Please try again.");
      setScanState("results");
    }
  };

  // ============================================================================
  // RESET
  // ============================================================================

  const reset = () => {
    stopCamera();
    setImageData(null);
    setAnalysis(null);
    setMarketStats(null);
    setComparables([]);
    setError(null);
    setScanState("idle");
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDemandColor = (level?: string) => {
    switch (level) {
      case "high":
        return "bg-green-100 text-green-700";
      case "low":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </Link>
          <h1 className="font-semibold">Scan Item</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Error Message */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* IDLE STATE - Show camera/upload options */}
        {scanState === "idle" && (
          <div className="space-y-4">
            {/* Camera Button */}
            <Button
              onClick={startCamera}
              size="lg"
              className="h-48 w-full flex-col gap-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800"
            >
              <Camera className="h-12 w-12" />
              <span className="text-lg">Take Photo</span>
            </Button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Upload Zone */}
            <div
              {...getRootProps()}
              className={cn(
                "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
                isDragActive
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-300 hover:border-gray-400"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 font-medium text-gray-700">
                Upload from gallery
              </p>
              <p className="mt-1 text-sm text-gray-500">
                JPEG, PNG, WebP, or HEIC
              </p>
            </div>

            <p className="text-center text-xs text-gray-400">
              For best results, use good lighting and capture the full item
            </p>
          </div>
        )}

        {/* CAPTURING STATE - Live camera view */}
        {scanState === "capturing" && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-square w-full object-cover"
              />
              {/* Viewfinder overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-lg border-2 border-white/50" />
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  stopCamera();
                  setScanState("idle");
                }}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-gray-900 hover:bg-gray-800"
                onClick={capturePhoto}
              >
                <Camera className="mr-2 h-5 w-5" />
                Capture
              </Button>
            </div>
          </div>
        )}

        {/* ANALYZING STATE - Show captured image with loading */}
        {scanState === "analyzing" && imageData && (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={imageData}
                alt="Captured item"
                className="aspect-square w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <Loader2 className="h-12 w-12 animate-spin text-white" />
                <p className="mt-4 font-medium text-white">Analyzing...</p>
                <p className="mt-1 text-sm text-white/70">
                  Identifying item and fetching prices
                </p>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS STATE - Show analysis results */}
        {scanState === "results" && analysis && imageData && (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={imageData}
                alt="Scanned item"
                className="aspect-square w-full object-cover"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 bg-white/90 hover:bg-white"
                onClick={reset}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Identification */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-gray-500">Identified as</span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">
                      {analysis.possibleIdentification}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {analysis.suggestedCategory && (
                        <Badge variant="secondary">
                          {analysis.suggestedCategory}
                        </Badge>
                      )}
                      {analysis.year && (
                        <Badge variant="outline">{analysis.year}</Badge>
                      )}
                      {analysis.mint && (
                        <Badge variant="outline">{analysis.mint} Mint</Badge>
                      )}
                      {analysis.certification && (
                        <Badge variant="outline">{analysis.certification}</Badge>
                      )}
                    </div>
                  </div>
                  {/* Grade - prominent display */}
                  {analysis.estimatedGrade && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Grade</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {analysis.estimatedGrade}
                      </p>
                      {analysis.gradeConfidence && (
                        <p className="text-xs text-gray-400">
                          {Math.round(analysis.gradeConfidence * 100)}% conf
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {analysis.additionalNotes && (
                  <p className="mt-3 text-sm text-gray-600 border-t pt-3">
                    {analysis.additionalNotes}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Pricing */}
            {analysis.estimatedValue && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-gray-500">
                    Market Value
                  </h3>
                  <div className="flex items-end justify-between">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Low</p>
                      <p className="text-lg font-medium text-gray-600">
                        {formatCurrency(analysis.estimatedValue.low)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Market</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(analysis.estimatedValue.mid)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">High</p>
                      <p className="text-lg font-medium text-gray-600">
                        {formatCurrency(analysis.estimatedValue.high)}
                      </p>
                    </div>
                  </div>

                  {/* Market Indicators */}
                  <div className="mt-4 flex gap-4">
                    {analysis.marketTrend && (
                      <div className="flex items-center gap-1.5">
                        {getTrendIcon(analysis.marketTrend)}
                        <span className="text-sm capitalize text-gray-600">
                          {analysis.marketTrend}
                        </span>
                      </div>
                    )}
                    {analysis.demandLevel && (
                      <Badge className={getDemandColor(analysis.demandLevel)}>
                        {analysis.demandLevel} demand
                      </Badge>
                    )}
                    {analysis.avgDaysToSell && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          ~{analysis.avgDaysToSell}d to sell
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Factors */}
            {analysis.keyFactors && analysis.keyFactors.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-500">
                    Key Factors
                  </h3>
                  <ul className="space-y-1">
                    {analysis.keyFactors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recent Sales */}
            {comparables.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-gray-500">
                    Recent Sales
                  </h3>
                  <div className="space-y-2">
                    {comparables.slice(0, 3).map((comp, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <span className="truncate text-sm text-gray-700">
                          {comp.title}
                        </span>
                        <span className="ml-2 flex-shrink-0 font-medium text-gray-900">
                          {formatCurrency(comp.soldPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={reset}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Scan Another
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-gray-900 hover:bg-gray-800"
                onClick={saveToInventory}
              >
                <Save className="mr-2 h-4 w-4" />
                Save to Inventory
              </Button>
            </div>
          </div>
        )}

        {/* SAVING STATE */}
        {scanState === "saving" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
            <p className="mt-4 font-medium text-gray-700">Saving to inventory...</p>
          </div>
        )}

        {/* SAVED STATE */}
        {scanState === "saved" && (
          <div className="space-y-6 py-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Saved!</h2>
              <p className="mt-1 text-gray-500">
                Item added to your inventory as a draft
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={reset}>
                Scan Another
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-gray-900 hover:bg-gray-800"
                onClick={() => router.push("/inventory")}
              >
                View Inventory
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

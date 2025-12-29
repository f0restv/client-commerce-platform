"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
}

interface AIAnalysis {
  possibleIdentification: string;
  confidence: number;
  suggestedCategory: string;
  estimatedValue?: {
    low: number;
    mid: number;
    high: number;
  };
  marketTrend?: string;
  avgDaysToSell?: number;
}

interface SubmissionFormProps {
  onSubmit: (data: SubmissionData) => Promise<void>;
  defaultCategory?: string;
}

interface SubmissionData {
  title: string;
  description: string;
  category: string;
  estimatedValue?: number;
  images: string[];
  aiAnalysis?: AIAnalysis;
}

export function SubmissionForm({ onSubmit, defaultCategory }: SubmissionFormProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategory || "");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newImages: UploadedImage[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      uploading: true,
      uploaded: false,
    }));

    setImages((prev) => [...prev, ...newImages]);

    // Simulate upload (replace with actual upload logic)
    for (const image of newImages) {
      try {
        // In production: upload to UploadThing or S3
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, uploading: false, uploaded: true, url: image.preview }
              : img
          )
        );
      } catch {
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, uploading: false } : img
          )
        );
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 10,
  });

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (aiAnalysis) setAiAnalysis(null);
  };

  const analyzeWithAI = async () => {
    if (images.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => img.url).filter(Boolean),
          title,
          description,
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
      setAiAnalysis(data.analysis);

      // Auto-fill form with AI suggestions
      if (data.analysis.possibleIdentification && !title) {
        setTitle(data.analysis.possibleIdentification);
      }
      if (data.analysis.suggestedCategory && !category) {
        setCategory(data.analysis.suggestedCategory);
      }
    } catch {
      setError("AI analysis failed. You can still submit manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title,
        description,
        category,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
        images: images.map((img) => img.url!).filter(Boolean),
        aiAnalysis: aiAnalysis || undefined,
      });
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allImagesUploaded = images.length > 0 && images.every((img) => img.uploaded);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Image Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Photos</CardTitle>
          <CardDescription>
            Upload clear photos of your item. Include front, back, and any details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              isDragActive
                ? "border-amber-500 bg-amber-50"
                : "border-gray-300 hover:border-gray-400"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragActive
                ? "Drop the images here..."
                : "Drag & drop images here, or click to select"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Up to 10 images (JPEG, PNG, WebP)
            </p>
          </div>

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
              {images.map((image) => (
                <div key={image.id} className="group relative aspect-square">
                  <img
                    src={image.preview}
                    alt="Preview"
                    className="h-full w-full rounded-md object-cover"
                  />
                  {image.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AI Analysis Button */}
          {allImagesUploaded && !aiAnalysis && (
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={analyzeWithAI}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get AI Market Analysis
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              AI Market Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-gray-600">Identification</span>
              <p className="font-medium">{aiAnalysis.possibleIdentification}</p>
              <Badge variant="outline" className="mt-1">
                {Math.round(aiAnalysis.confidence * 100)}% confidence
              </Badge>
            </div>

            {aiAnalysis.estimatedValue && (
              <div>
                <span className="text-sm text-gray-600">Estimated Market Value</span>
                <div className="mt-1 flex items-center gap-4">
                  <div>
                    <span className="text-xs text-gray-500">Low</span>
                    <p className="font-medium">
                      {formatCurrency(aiAnalysis.estimatedValue.low)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Mid</span>
                    <p className="text-lg font-bold text-amber-600">
                      {formatCurrency(aiAnalysis.estimatedValue.mid)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">High</span>
                    <p className="font-medium">
                      {formatCurrency(aiAnalysis.estimatedValue.high)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-6">
              {aiAnalysis.marketTrend && (
                <div>
                  <span className="text-sm text-gray-600">Market Trend</span>
                  <p className="font-medium capitalize">{aiAnalysis.marketTrend}</p>
                </div>
              )}
              {aiAnalysis.avgDaysToSell && (
                <div>
                  <span className="text-sm text-gray-600">Avg. Time to Sell</span>
                  <p className="font-medium">{aiAnalysis.avgDaysToSell} days</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Item Details */}
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            Tell us about your item. The more details, the better!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Title / Description
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 1921 Morgan Silver Dollar MS65"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a category</option>
              <option value="coins-currency">Coins & Currency</option>
              <option value="comics">Comics</option>
              <option value="sports">Sports Cards & Memorabilia</option>
              <option value="vintage">Vintage Items</option>
              <option value="jewelry">Jewelry</option>
              <option value="misc">Misc Collectibles</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Additional Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include any relevant details: year, mint, grade, certification, condition notes..."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Your Estimated Value (optional)
            </label>
            <Input
              type="number"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="$0.00"
              min="0"
              step="0.01"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="gold"
        size="lg"
        className="w-full"
        disabled={!allImagesUploaded || !title || !category || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit for Review"
        )}
      </Button>

      <p className="text-center text-xs text-gray-500">
        By submitting, you agree to our terms and conditions.
      </p>
    </form>
  );
}

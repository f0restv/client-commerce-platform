'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Upload,
  X,
  Sparkles,
  Loader2,
  DollarSign,
  Clock,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import type { AIAnalysis, Category } from '@/types';

const submissionSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Please provide more details'),
  category_id: z.string().optional(),
  estimated_value: z.number().optional(),
  desired_price: z.number().optional(),
});

type SubmissionFormData = z.infer<typeof submissionSchema>;

interface SubmissionFormProps {
  categories: Category[];
  onSubmit: (data: SubmissionFormData, images: File[], analysis?: AIAnalysis) => Promise<void>;
}

export function SubmissionForm({ categories, onSubmit }: SubmissionFormProps) {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
  });

  const title = watch('title');
  const description = watch('description');

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 10) {
      alert('Maximum 10 images allowed');
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    // Generate previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, [images]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!title || images.length === 0) {
      alert('Please add a title and at least one image');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch('/api/claude/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || '',
          images: imagePreviews, // Base64 encoded
          category: categories.find((c) => c.id === watch('category_id'))?.name,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze item. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFormSubmit = async (data: SubmissionFormData) => {
    setSubmitting(true);
    try {
      await onSubmit(data, images, analysis || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Form Column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Submit Your Item</CardTitle>
            <CardDescription>
              Upload photos and provide details. Our AI will help estimate value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Photos (up to 10)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <Image
                        src={preview}
                        alt={`Upload ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {images.length < 10 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-gold-500 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Include front, back, and edge photos for best results
                </p>
              </div>

              {/* Title */}
              <Input
                label="Item Title"
                placeholder="e.g., 1921 Morgan Silver Dollar MS-65"
                error={errors.title?.message}
                {...register('title')}
              />

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="Describe your item's condition, history, any known details..."
                  rows={4}
                  className={cn(
                    'flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
                    'placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent',
                    'dark:border-gray-600 dark:bg-gray-800 dark:text-white',
                    errors.description && 'border-red-500'
                  )}
                  {...register('description')}
                />
                {errors.description && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Category
                </label>
                <select
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('category_id')}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Your Estimate (optional)"
                  type="number"
                  placeholder="$0.00"
                  {...register('estimated_value', { valueAsNumber: true })}
                />
                <Input
                  label="Desired Price (optional)"
                  type="number"
                  placeholder="$0.00"
                  {...register('desired_price', { valueAsNumber: true })}
                />
              </div>

              {/* AI Analysis Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAnalyze}
                disabled={analyzing || !title || images.length === 0}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 text-gold-500" />
                    Get AI Price Estimate
                  </>
                )}
              </Button>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="gold"
                className="w-full"
                disabled={submitting || images.length === 0}
                loading={submitting}
              >
                Submit for Review
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Results Column */}
      <div className="space-y-6">
        {analysis ? (
          <>
            {/* AI Analysis Card */}
            <Card className="border-gold-200 dark:border-gold-800">
              <CardHeader className="bg-gradient-to-r from-gold-50 to-gold-100 dark:from-gold-900/20 dark:to-gold-800/20 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gold-600" />
                  <CardTitle>AI Analysis</CardTitle>
                </div>
                <CardDescription>
                  Confidence: {Math.round(analysis.confidence * 100)}%
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Identified Item */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Identified As</h4>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {analysis.identified_item}
                  </p>
                </div>

                {/* Value Estimate */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h4 className="font-medium">Estimated Value</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Low</p>
                      <p className="font-bold text-lg">{formatCurrency(analysis.estimated_value_low)}</p>
                    </div>
                    <div className="border-x border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">Average</p>
                      <p className="font-bold text-xl text-green-600">
                        {formatCurrency(analysis.estimated_value_avg)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">High</p>
                      <p className="font-bold text-lg">{formatCurrency(analysis.estimated_value_high)}</p>
                    </div>
                  </div>
                </div>

                {/* Time to Sell */}
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Clock className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-500">Average Time to Sell</p>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">
                      {analysis.avg_days_to_sell} days
                    </p>
                  </div>
                </div>

                {/* Grade Estimate */}
                {analysis.grading_estimate && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Estimated Grade</h4>
                    <Badge variant="gold" size="md">{analysis.grading_estimate}</Badge>
                  </div>
                )}

                {/* Market Analysis */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Market Analysis</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {analysis.market_analysis}
                  </p>
                </div>

                {/* Recent Sales */}
                {analysis.recent_sales && analysis.recent_sales.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                      <h4 className="text-sm font-medium text-gray-500">Recent Comparable Sales</h4>
                    </div>
                    <div className="space-y-2">
                      {analysis.recent_sales.map((sale, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                        >
                          <div>
                            <span className="font-medium">{sale.platform}</span>
                            {sale.condition && (
                              <span className="text-gray-500 ml-2">{sale.condition}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{formatCurrency(sale.price)}</span>
                            <span className="text-gray-500 text-xs ml-2">{sale.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Recommendations</h4>
                    <ul className="space-y-2">
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="h-full flex items-center justify-center text-center p-12">
            <div>
              <Sparkles className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                AI-Powered Analysis
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                Add photos and a title, then click &quot;Get AI Price Estimate&quot; to receive
                instant market analysis and valuation.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

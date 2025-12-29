"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { CategorySelector, CategoryOption } from "@/components/portal/category-selector";
import { SubmissionForm } from "@/components/portal/submission-form";

export default function SubmitPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);

  // In production, get user from session
  const user = {
    name: "John Collector",
    email: "john@example.com",
    image: null,
    role: "CLIENT",
  };

  const handleCategorySelect = (category: CategoryOption) => {
    setSelectedCategory(category);
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  const handleSubmit = async (data: {
    title: string;
    description: string;
    category: string;
    estimatedValue?: number;
    images: string[];
  }) => {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        category: selectedCategory?.id || data.category,
      }),
    });

    if (response.ok) {
      router.push("/portal/submissions");
    } else {
      throw new Error("Submission failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {!selectedCategory ? (
          <>
            {/* Category Selection */}
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900">What are you selling?</h1>
              <p className="mt-2 text-lg text-gray-500">
                Select a category to get started. We&apos;ll use AI to analyze your items and find the best market value.
              </p>
            </div>

            <CategorySelector onSelect={handleCategorySelect} />

            <p className="mt-8 text-center text-sm text-gray-500">
              Not sure which category? Choose <strong>Misc Collectibles</strong> and we&apos;ll help identify your items.
            </p>
          </>
        ) : (
          <>
            {/* Form with selected category */}
            <button
              onClick={handleBack}
              className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Change category
            </button>

            <div className="mb-8 flex items-center gap-4">
              <div className={`
                inline-flex rounded-xl p-3 text-white
                bg-gradient-to-br ${selectedCategory.color}
              `}>
                <selectedCategory.icon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Submit {selectedCategory.name}
                </h1>
                <p className="text-gray-500">
                  Upload photos and details. We&apos;ll review and provide a market valuation.
                </p>
              </div>
            </div>

            <div className="max-w-2xl">
              <SubmissionForm 
                onSubmit={handleSubmit}
                defaultCategory={selectedCategory.id}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

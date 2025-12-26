"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubmissionForm } from "@/components/portal/submission-form";

export default function SubmitPage() {
  const router = useRouter();

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
      body: JSON.stringify(data),
    });

    if (response.ok) {
      router.push("/client-portal?submitted=true");
    } else {
      throw new Error("Submission failed");
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Back Link */}
      <Link
        href="/client-portal"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Submit New Items</h1>
        <p className="mt-1 text-gray-500">
          Upload photos and details for consignment or sale. Our team will
          review your submission and provide a market valuation.
        </p>
      </div>

      {/* Form */}
      <SubmissionForm onSubmit={handleSubmit} />
    </main>
  );
}

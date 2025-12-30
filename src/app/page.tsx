import Link from "next/link";
import { Camera, Zap, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section - Full viewport, centered */}
      <section className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Know what it's worth.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-xl text-gray-500">
            Scan any coin. Get instant pricing.
          </p>
          <div className="mt-10">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-4 text-lg font-medium text-white transition-all hover:bg-gray-800"
            >
              Start Scanning
            </Link>
          </div>
        </div>
      </section>

      {/* Simple features - minimal, below the fold */}
      <section className="border-t border-gray-100 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-16 md:grid-cols-3">
            <Feature
              icon={<Camera className="h-6 w-6" />}
              title="Point and scan"
              description="AI identifies your coin instantly"
            />
            <Feature
              icon={<TrendingUp className="h-6 w-6" />}
              title="Real-time pricing"
              description="Current market values at a glance"
            />
            <Feature
              icon={<Zap className="h-6 w-6" />}
              title="Instant results"
              description="No waiting, no guesswork"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center text-gray-900">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-500">{description}</p>
    </div>
  );
}

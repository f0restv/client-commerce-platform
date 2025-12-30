import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section - Apple-style minimal */}
      <section className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            Know what it&apos;s worth.
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-xl text-gray-500">
            AI-powered valuations for your collectibles. Instant. Accurate. Free.
          </p>
          <div className="mt-12">
            <Button
              size="lg"
              className="h-14 rounded-full bg-gray-900 px-8 text-lg font-medium text-white hover:bg-gray-800"
              asChild
            >
              <Link href="/scan">Start Scanning</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

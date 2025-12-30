"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

const COIN_TYPES = [
  { value: "morgan-dollar", label: "Morgan Dollar" },
  { value: "peace-dollar", label: "Peace Dollar" },
  { value: "walking-liberty-half", label: "Walking Liberty Half" },
  { value: "franklin-half", label: "Franklin Half" },
  { value: "kennedy-half", label: "Kennedy Half" },
  { value: "barber-half", label: "Barber Half" },
  { value: "seated-liberty-half", label: "Seated Liberty Half" },
  { value: "barber-quarter", label: "Barber Quarter" },
  { value: "standing-liberty-quarter", label: "Standing Liberty Quarter" },
  { value: "washington-quarter", label: "Washington Quarter" },
  { value: "barber-dime", label: "Barber Dime" },
  { value: "mercury-dime", label: "Mercury Dime" },
  { value: "roosevelt-dime", label: "Roosevelt Dime" },
  { value: "buffalo-nickel", label: "Buffalo Nickel" },
  { value: "jefferson-nickel", label: "Jefferson Nickel" },
  { value: "indian-head-cent", label: "Indian Head Cent" },
  { value: "lincoln-cent-wheat", label: "Lincoln Cent (Wheat)" },
  { value: "lincoln-cent-memorial", label: "Lincoln Cent (Memorial)" },
  { value: "saint-gaudens-double-eagle", label: "Saint-Gaudens $20" },
  { value: "liberty-head-double-eagle", label: "Liberty Head $20" },
  { value: "indian-head-eagle", label: "Indian Head $10" },
  { value: "liberty-head-eagle", label: "Liberty Head $10" },
  { value: "indian-head-half-eagle", label: "Indian Head $5" },
  { value: "liberty-head-half-eagle", label: "Liberty Head $5" },
  { value: "indian-head-quarter-eagle", label: "Indian Head $2.50" },
  { value: "other", label: "Other" },
];

const GRADES = [
  "AG3", "G4", "G6", "VG8", "VG10",
  "F12", "F15", "VF20", "VF25", "VF30", "VF35",
  "EF40", "EF45", "AU50", "AU53", "AU55", "AU58",
  "MS60", "MS61", "MS62", "MS63", "MS64", "MS65", "MS66", "MS67", "MS68", "MS69", "MS70",
  "PF60", "PF61", "PF62", "PF63", "PF64", "PF65", "PF66", "PF67", "PF68", "PF69", "PF70",
];

const MINTS = ["P", "D", "S", "O", "CC", "W", ""];

interface TrainingEntry {
  image: string;
  type: string;
  date: string;
  mint: string;
  grade: string;
  notes: string;
  capturedAt: string;
}

export default function TrainGradingPage() {
  const [mode, setMode] = useState<"capture" | "gallery">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coinType, setCoinType] = useState("");
  const [date, setDate] = useState("");
  const [mint, setMint] = useState("P");
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [gallery, setGallery] = useState<TrainingEntry[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!imageFile || !coinType || !date || !grade) {
      alert("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("type", coinType);
      formData.append("date", date);
      formData.append("mint", mint);
      formData.append("grade", grade);
      formData.append("notes", notes);

      const res = await fetch("/api/training/grading", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      setSuccessCount((c) => c + 1);
      // Reset form for next entry
      setImagePreview(null);
      setImageFile(null);
      setDate("");
      setNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save training data");
    } finally {
      setSubmitting(false);
    }
  };

  const loadGallery = async () => {
    setLoadingGallery(true);
    try {
      const res = await fetch("/api/training/grading");
      if (res.ok) {
        const data = await res.json();
        setGallery(data.entries || []);
      }
    } catch {
      console.error("Failed to load gallery");
    } finally {
      setLoadingGallery(false);
    }
  };

  const switchToGallery = () => {
    setMode("gallery");
    loadGallery();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Grading Training Data</h1>
          <div className="flex gap-2">
            <Button
              variant={mode === "capture" ? "default" : "outline"}
              onClick={() => setMode("capture")}
            >
              Capture
            </Button>
            <Button
              variant={mode === "gallery" ? "default" : "outline"}
              onClick={switchToGallery}
            >
              Gallery ({gallery.length || "..."})
            </Button>
          </div>
        </div>

        {mode === "capture" ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Image Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-100 transition-colors hover:border-gray-400"
                >
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Coin preview"
                      width={400}
                      height={400}
                      className="max-h-full max-w-full rounded object-contain"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <p className="text-lg font-medium">Drop photo here</p>
                      <p className="text-sm">or click to browse</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </CardContent>
            </Card>

            {/* Form Fields */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coin Type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Coin Type *
                  </label>
                  <select
                    value={coinType}
                    onChange={(e) => setCoinType(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select coin type...</option>
                    {COIN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date / Mint Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Date *
                    </label>
                    <Input
                      type="text"
                      placeholder="1921"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Mint
                    </label>
                    <select
                      value={mint}
                      onChange={(e) => setMint(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {MINTS.map((m) => (
                        <option key={m} value={m}>
                          {m || "(No mint mark)"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grade */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Grade *
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select grade...</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <Textarea
                    placeholder="cleaned, toned, CAC, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !imageFile || !coinType || !date || !grade}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? "Saving..." : "Save Training Data"}
                </Button>

                {successCount > 0 && (
                  <p className="text-center text-sm text-green-600">
                    {successCount} image{successCount !== 1 ? "s" : ""} saved this session
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Gallery View */
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Training Gallery ({gallery.length} images)</span>
                <Button variant="outline" size="sm" onClick={loadGallery}>
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingGallery ? (
                <div className="py-12 text-center text-gray-500">Loading...</div>
              ) : gallery.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  No training data yet. Start capturing!
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gallery.map((entry, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-lg border bg-white shadow-sm"
                    >
                      <div className="relative aspect-square">
                        <Image
                          src={`/api/training/grading/image?path=${encodeURIComponent(entry.image)}`}
                          alt={`${entry.type} ${entry.date}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">
                            {entry.date}-{entry.mint || "P"}
                          </span>
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-800">
                            {entry.grade}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {COIN_TYPES.find((t) => t.value === entry.type)?.label || entry.type}
                        </p>
                        {entry.notes && (
                          <p className="mt-1 text-xs text-gray-500">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

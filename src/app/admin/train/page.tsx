"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Upload,
  RotateCcw,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Trophy,
  Target,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const GRADES = [
  "AG3", "G4", "G6", "VG8", "VG10",
  "F12", "F15", "VF20", "VF25", "VF30", "VF35",
  "EF40", "EF45", "AU50", "AU53", "AU55", "AU58",
  "MS60", "MS61", "MS62", "MS63", "MS64", "MS65", "MS66", "MS67", "MS68", "MS69", "MS70",
  "PF60", "PF61", "PF62", "PF63", "PF64", "PF65", "PF66", "PF67", "PF68", "PF69", "PF70",
];

type State = "idle" | "capturing" | "analyzing" | "grading" | "saving" | "saved";

interface AIAnalysis {
  itemType: string;
  title: string;
  year?: string;
  mint?: string;
  grade: string;
  gradeConfidence: number;
  details: string;
}

export default function AdminTrainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [state, setState] = useState<State>("idle");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [actualGrade, setActualGrade] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check admin access
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/auth/login?callbackUrl=/admin/train");
      return;
    }
    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN" && role !== "STAFF") {
      router.push("/");
    }
  }, [session, status, router]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("capturing");
    } catch (err) {
      setError("Could not access camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImageData(dataUrl);

    // Convert to file
    canvas.toBlob((blob) => {
      if (blob) {
        setImageFile(new File([blob], `train-${Date.now()}.jpg`, { type: "image/jpeg" }));
      }
    }, "image/jpeg", 0.9);

    stopCamera();
    analyzeImage(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageData(dataUrl);
      analyzeImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (dataUrl: string) => {
    setState("analyzing");
    setError(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          mode: "grade", // Focus on grading
        }),
      });

      if (!res.ok) {
        throw new Error("Analysis failed");
      }

      const data = await res.json();

      setAiAnalysis({
        itemType: data.category || data.itemType || "Unknown",
        title: data.title || data.name || "Unknown Item",
        year: data.year?.toString(),
        mint: data.mint,
        grade: data.grade || data.estimatedGrade || "MS63",
        gradeConfidence: data.gradeConfidence || data.confidence || 0.7,
        details: data.description || data.details || "",
      });

      setState("grading");
    } catch (err) {
      setError("Failed to analyze image. Please try again.");
      setState("idle");
    }
  };

  const saveTrainingData = async () => {
    if (!imageFile || !aiAnalysis || !actualGrade) return;

    setState("saving");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("type", aiAnalysis.itemType.toLowerCase().replace(/\s+/g, "-"));
      formData.append("date", aiAnalysis.year || "unknown");
      formData.append("mint", aiAnalysis.mint || "P");
      formData.append("grade", actualGrade);
      formData.append("notes", `AI guessed: ${aiAnalysis.grade} (${Math.round(aiAnalysis.gradeConfidence * 100)}% conf). ${notes}`.trim());

      const res = await fetch("/api/training/grading", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      // Update stats
      const isCorrect = aiAnalysis.grade === actualGrade;
      setStats((s) => ({
        total: s.total + 1,
        correct: s.correct + (isCorrect ? 1 : 0),
      }));

      setState("saved");
    } catch (err) {
      setError("Failed to save training data");
      setState("grading");
    }
  };

  const reset = () => {
    setState("idle");
    setImageData(null);
    setImageFile(null);
    setAiAnalysis(null);
    setActualGrade("");
    setNotes("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("MS7") || grade.startsWith("PF7")) return "text-purple-600";
    if (grade.startsWith("MS6") || grade.startsWith("PF6")) return "text-blue-600";
    if (grade.startsWith("MS") || grade.startsWith("PF")) return "text-green-600";
    if (grade.startsWith("AU")) return "text-yellow-600";
    if (grade.startsWith("EF") || grade.startsWith("VF")) return "text-orange-600";
    return "text-gray-600";
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2 text-gray-400">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span>{stats.correct}/{stats.total}</span>
            </div>
            {stats.total > 0 && (
              <div className="text-sm text-gray-400">
                {Math.round((stats.correct / stats.total) * 100)}%
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Title */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">Grade Training</h1>
          <p className="text-sm text-gray-400">
            AI guesses, you verify
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* IDLE STATE */}
        {state === "idle" && (
          <div className="space-y-4">
            <Card className="border-gray-700 bg-gray-800">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700">
                    <Brain className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-center text-gray-400">
                    Take a photo of a graded coin or card.<br />
                    The AI will guess the grade.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-14 bg-blue-600 hover:bg-blue-700"
                onClick={startCamera}
              >
                <Camera className="mr-2 h-5 w-5" />
                Camera
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 border-gray-600 text-white hover:bg-gray-800"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload
              </Button>
            </div>
          </div>
        )}

        {/* CAPTURING STATE */}
        {state === "capturing" && (
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Crosshair overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-full border-2 border-white/30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="h-14 border-gray-600 text-white hover:bg-gray-800"
                onClick={() => {
                  stopCamera();
                  setState("idle");
                }}
              >
                <X className="mr-2 h-5 w-5" />
                Cancel
              </Button>
              <Button
                size="lg"
                className="h-14 bg-green-600 hover:bg-green-700"
                onClick={capturePhoto}
              >
                <Camera className="mr-2 h-5 w-5" />
                Capture
              </Button>
            </div>
          </div>
        )}

        {/* ANALYZING STATE */}
        {state === "analyzing" && imageData && (
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-xl">
              <Image
                src={imageData}
                alt="Analyzing"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500" />
                  <p className="mt-3 text-lg font-medium">AI is analyzing...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GRADING STATE - AI has guessed, user confirms */}
        {state === "grading" && imageData && aiAnalysis && (
          <div className="space-y-4">
            {/* Image */}
            <div className="relative aspect-square overflow-hidden rounded-xl">
              <Image
                src={imageData}
                alt="Item"
                fill
                className="object-cover"
              />
            </div>

            {/* AI Guess */}
            <Card className="border-blue-500/50 bg-blue-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
                    <Brain className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-300">AI thinks this is:</p>
                    <p className="font-medium">{aiAnalysis.title}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-2xl font-bold", getGradeColor(aiAnalysis.grade))}>
                      {aiAnalysis.grade}
                    </p>
                    <p className="text-xs text-gray-400">
                      {Math.round(aiAnalysis.gradeConfidence * 100)}% confident
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actual Grade Selection */}
            <Card className="border-gray-700 bg-gray-800">
              <CardContent className="p-4">
                <p className="mb-3 text-sm font-medium text-gray-300">
                  What&apos;s the ACTUAL grade?
                </p>

                {/* Quick match button */}
                <Button
                  variant="outline"
                  className={cn(
                    "mb-3 w-full border-green-500/50 text-green-400 hover:bg-green-900/30",
                    actualGrade === aiAnalysis.grade && "bg-green-900/30"
                  )}
                  onClick={() => setActualGrade(aiAnalysis.grade)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  AI is correct: {aiAnalysis.grade}
                </Button>

                {/* Grade grid */}
                <div className="grid grid-cols-5 gap-1.5">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setActualGrade(g)}
                      className={cn(
                        "rounded px-2 py-1.5 text-xs font-medium transition-colors",
                        actualGrade === g
                          ? "bg-white text-gray-900"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600",
                        g === aiAnalysis.grade && actualGrade !== g && "ring-1 ring-blue-500"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <Textarea
                    placeholder="Optional notes (toning, scratches, etc.)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="border-gray-600 bg-gray-700 text-white placeholder:text-gray-500"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="h-14 border-gray-600 text-white hover:bg-gray-800"
                onClick={reset}
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Start Over
              </Button>
              <Button
                size="lg"
                className="h-14 bg-green-600 hover:bg-green-700"
                onClick={saveTrainingData}
                disabled={!actualGrade}
              >
                <Check className="mr-2 h-5 w-5" />
                Save
              </Button>
            </div>
          </div>
        )}

        {/* SAVING STATE */}
        {state === "saving" && (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="mt-4 text-gray-400">Saving training data...</p>
          </div>
        )}

        {/* SAVED STATE */}
        {state === "saved" && aiAnalysis && (
          <div className="space-y-6">
            <Card className={cn(
              "border-2",
              aiAnalysis.grade === actualGrade
                ? "border-green-500 bg-green-900/20"
                : "border-yellow-500 bg-yellow-900/20"
            )}>
              <CardContent className="p-6 text-center">
                {aiAnalysis.grade === actualGrade ? (
                  <>
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
                      <Check className="h-8 w-8" />
                    </div>
                    <p className="text-xl font-bold text-green-400">AI was correct!</p>
                    <p className="mt-1 text-gray-400">Grade: {actualGrade}</p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-600">
                      <Target className="h-8 w-8" />
                    </div>
                    <p className="text-xl font-bold text-yellow-400">Training data saved</p>
                    <p className="mt-1 text-gray-400">
                      AI guessed {aiAnalysis.grade}, actual was {actualGrade}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="h-14 w-full bg-blue-600 hover:bg-blue-700"
              onClick={reset}
            >
              <Camera className="mr-2 h-5 w-5" />
              Train Another
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

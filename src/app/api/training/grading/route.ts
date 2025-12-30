import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const TRAINING_DIR = path.join(process.cwd(), "data/training/grading");
const METADATA_FILE = path.join(TRAINING_DIR, "metadata.json");

interface TrainingEntry {
  image: string;
  type: string;
  date: string;
  mint: string;
  grade: string;
  notes: string;
  capturedAt: string;
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function loadMetadata(): Promise<TrainingEntry[]> {
  try {
    if (existsSync(METADATA_FILE)) {
      const data = await readFile(METADATA_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    console.error("Failed to load metadata");
  }
  return [];
}

async function saveMetadata(entries: TrainingEntry[]) {
  await writeFile(METADATA_FILE, JSON.stringify(entries, null, 2));
}

export async function GET() {
  try {
    const entries = await loadMetadata();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error loading training data:", error);
    return NextResponse.json(
      { error: "Failed to load training data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const type = formData.get("type") as string;
    const date = formData.get("date") as string;
    const mint = formData.get("mint") as string || "";
    const grade = formData.get("grade") as string;
    const notes = formData.get("notes") as string || "";

    if (!image || !type || !date || !grade) {
      return NextResponse.json(
        { error: "Missing required fields: image, type, date, grade" },
        { status: 400 }
      );
    }

    // Create directory structure: data/training/grading/{coin-type}/
    const typeDir = path.join(TRAINING_DIR, type);
    await ensureDir(typeDir);

    // Generate filename: {date}-{mint}-{grade}-{timestamp}.jpg
    const timestamp = Date.now();
    const ext = image.name.split(".").pop() || "jpg";
    const mintLabel = mint || "P";
    const filename = `${date}-${mintLabel}-${grade}-${timestamp}.${ext}`;
    const relativePath = `${type}/${filename}`;
    const fullPath = path.join(typeDir, filename);

    // Save image file
    const bytes = await image.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    // Update metadata
    const entries = await loadMetadata();
    const newEntry: TrainingEntry = {
      image: relativePath,
      type,
      date,
      mint: mintLabel,
      grade,
      notes,
      capturedAt: new Date().toISOString().split("T")[0],
    };
    entries.push(newEntry);
    await saveMetadata(entries);

    return NextResponse.json({ success: true, entry: newEntry });
  } catch (error) {
    console.error("Error saving training data:", error);
    return NextResponse.json(
      { error: "Failed to save training data" },
      { status: 500 }
    );
  }
}

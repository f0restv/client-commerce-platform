import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const TRAINING_DIR = path.join(process.cwd(), "data/training/grading");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imagePath = searchParams.get("path");

    if (!imagePath) {
      return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    // Sanitize path to prevent directory traversal
    const sanitized = imagePath.replace(/\.\./g, "").replace(/^\/+/, "");
    const fullPath = path.join(TRAINING_DIR, sanitized);

    // Verify path is within training directory
    if (!fullPath.startsWith(TRAINING_DIR)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const data = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    const contentType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    }[ext] || "image/jpeg";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error serving training image:", error);
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
  }
}

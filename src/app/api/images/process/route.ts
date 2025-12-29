import { NextRequest, NextResponse } from 'next/server';
import { processImage } from '@/lib/services/image-processor';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for image processing

interface ProcessImageRequest {
  image: string; // base64 encoded image or URL
  imageType?: string; // 'base64' or 'url'
  mimeType?: string;
  folder?: string;
  skipAnalysis?: boolean;
  customEnhancements?: {
    autoLevels?: boolean;
    whiteBalance?: boolean;
    denoise?: boolean;
    sharpen?: boolean;
    removeBackground?: boolean;
  };
}

/**
 * POST /api/images/process
 * Process an image: analyze, enhance, resize, and upload
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProcessImageRequest;

    // Validate request
    if (!body.image) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Convert image to buffer
    let imageBuffer: Buffer;
    const imageType = body.imageType || 'base64';

    if (imageType === 'base64') {
      // Remove data URL prefix if present
      const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageType === 'url') {
      // Fetch image from URL
      const response = await fetch(body.image);
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch image from URL' },
          { status: 400 }
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json(
        { error: 'Invalid imageType. Must be "base64" or "url"' },
        { status: 400 }
      );
    }

    // Determine MIME type
    const mimeType = body.mimeType || 'image/jpeg';

    // Process the image
    const result = await processImage(imageBuffer, mimeType, {
      folder: body.folder,
      skipAnalysis: body.skipAnalysis,
      customEnhancements: body.customEnhancements,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process image' },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error('Error in /api/images/process:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

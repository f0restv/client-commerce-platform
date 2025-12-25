import { NextRequest, NextResponse } from 'next/server';
import { analyzeItem } from '@/lib/claude';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, images, category } = body;

    if (!title || !images || images.length === 0) {
      return NextResponse.json(
        { error: 'Title and at least one image are required' },
        { status: 400 }
      );
    }

    const analysis = await analyzeItem({
      title,
      description: description || '',
      images,
      category,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Claude API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze item' },
      { status: 500 }
    );
  }
}

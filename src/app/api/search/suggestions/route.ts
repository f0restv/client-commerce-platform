import { NextRequest, NextResponse } from 'next/server';
import { getSearchSuggestions, getTrendingSearches } from '@/lib/services/search';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      // Return trending searches if no query
      const trending = await getTrendingSearches(8);
      return NextResponse.json({ suggestions: trending, type: 'trending' });
    }

    const suggestions = await getSearchSuggestions(query, 10);
    return NextResponse.json({ suggestions, type: 'search' });
  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json(
      { suggestions: [], type: 'error' },
      { status: 500 }
    );
  }
}

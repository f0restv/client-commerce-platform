/**
 * eBay OAuth Authorization Route
 *
 * Initiates the OAuth flow by redirecting to eBay's authorization page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/integrations/ebay/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Optional clientId for client-specific integrations
  // If not provided, this will be a platform-wide connection
  const clientId = searchParams.get("clientId") || "platform";

  try {
    const authUrl = getAuthUrl(clientId);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("eBay OAuth authorize error:", err);

    return NextResponse.redirect(
      new URL(
        "/admin/integrations?error=auth_init_failed&description=Failed to initialize eBay OAuth",
        request.url
      )
    );
  }
}

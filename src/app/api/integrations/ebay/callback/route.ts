/**
 * eBay OAuth Callback Route
 *
 * Handles the OAuth callback from eBay after user authorization.
 * Exchanges the authorization code for tokens and stores them.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  storePlatformTokens,
  storeClientTokens,
} from "@/lib/integrations/ebay/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Contains clientId or other context
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error(`eBay OAuth error: ${error} - ${errorDescription}`);
    return NextResponse.redirect(
      new URL(
        `/admin/integrations?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || "")}`,
        request.url
      )
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/admin/integrations?error=missing_code&description=No authorization code received",
        request.url
      )
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code);

    // If state contains a clientId, store as client-specific integration
    // Otherwise, store as platform-wide connection
    if (state && state !== "platform") {
      await storeClientTokens(state, tokens);
    } else {
      await storePlatformTokens(tokens);
    }

    // Redirect to success page
    const redirectUrl = new URL("/admin/integrations", request.url);
    redirectUrl.searchParams.set("connected", "ebay");
    if (state && state !== "platform") {
      redirectUrl.searchParams.set("client", state);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("eBay OAuth callback error:", err);

    const errorMessage =
      err instanceof Error ? err.message : "Token exchange failed";

    return NextResponse.redirect(
      new URL(
        `/admin/integrations?error=token_exchange_failed&description=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}

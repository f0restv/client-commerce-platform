import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  acceptOffer,
  declineOffer,
  counterOffer,
  acceptCounterOffer,
  withdrawOffer,
} from "@/lib/services/offers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/offers/[id] - Update offer status (accept, decline, counter, withdraw)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: offerId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, amount, message, expiresInHours } = body;

    let result;

    switch (action) {
      case "accept":
        result = await acceptOffer(offerId, session.user.id);
        break;

      case "decline":
        result = await declineOffer(offerId, session.user.id);
        break;

      case "counter":
        if (typeof amount !== "number" || amount <= 0) {
          return NextResponse.json(
            { error: "Valid counter amount is required" },
            { status: 400 }
          );
        }
        result = await counterOffer(session.user.id, {
          offerId,
          amount,
          message,
          expiresInHours,
        });
        break;

      case "accept-counter":
        result = await acceptCounterOffer(offerId, session.user.id);
        break;

      case "withdraw":
        result = await withdrawOffer(offerId, session.user.id);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json({ offer: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update offer";
    console.error("Error updating offer:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

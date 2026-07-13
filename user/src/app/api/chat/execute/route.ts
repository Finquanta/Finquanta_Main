import { NextRequest, NextResponse } from "next/server";
import { executeAction, PendingAction } from "@/lib/finna/tools";

/**
 * Performs a write that Finna drafted and the user explicitly confirmed.
 *
 * This is the ONLY path where a chat message can change the books, and it is
 * never reached without the user pressing Confirm. The AI is not in the loop
 * here at all: the payload was built by our own code in propose_invoice /
 * propose_entry, and it runs against the backend on the user's own token, so it
 * can do nothing the user couldn't do by hand.
 */
export async function POST(req: NextRequest) {
  const { action, token, businessId } = await req.json();

  if (!token) {
    return NextResponse.json({ content: "You need to be signed in to do that." }, { status: 401 });
  }

  const a = action as PendingAction | undefined;
  if (!a || (a.type !== "create_invoice" && a.type !== "add_entry")) {
    return NextResponse.json({ content: "There's nothing to confirm." }, { status: 400 });
  }

  try {
    const content = await executeAction(a, { token, businessId: businessId ?? null });
    return NextResponse.json({ content, dataChanged: true });
  } catch (err) {
    return NextResponse.json(
      { content: err instanceof Error ? err.message : "That didn't work." },
      { status: 400 }
    );
  }
}

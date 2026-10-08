import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVapidKeys } from "@/lib/push";

// The public half of the VAPID key pair, needed by the browser to subscribe.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { publicKey } = await getVapidKeys();
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}

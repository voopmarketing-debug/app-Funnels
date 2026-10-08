import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendPushToUsers } from "@/lib/push";

// "Probar" button: a notification to the signed-in person's own devices.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await sendPushToUsers([session.user.id], {
    title: "🔔 Notificaciones activadas",
    body: "Así te avisaremos cuando un cliente te escriba por WhatsApp.",
    url: "/dashboard",
    tag: "test",
  });
  return NextResponse.json({ ok: true });
}

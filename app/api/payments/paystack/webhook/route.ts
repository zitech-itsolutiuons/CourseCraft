import { NextResponse } from "next/server";
import { verifyAndGrantReconstructionAccess, verifyPaystackSignature } from "@/lib/paystack";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature")))
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (event.event !== "charge.success") return NextResponse.json({ received: true });
  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
  try {
    await verifyAndGrantReconstructionAccess(reference);
  } catch (error) {
    console.error("[Paystack webhook] Payment verification failed", error);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

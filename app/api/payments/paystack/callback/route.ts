import { NextResponse } from "next/server";
import { appUrl as getAppUrl, verifyAndGrantReconstructionAccess } from "@/lib/paystack";

export async function GET(request: Request) {
  const callbackUrl = new URL("/reconstruct", getAppUrl());
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) {
    callbackUrl.searchParams.set("payment", "failed");
    return NextResponse.redirect(callbackUrl);
  }
  try {
    const result = await verifyAndGrantReconstructionAccess(reference);
    callbackUrl.searchParams.set("payment", result.verified ? "success" : "failed");
  } catch (error) {
    console.error("[Paystack callback] Payment verification failed", error);
    callbackUrl.searchParams.set("payment", "pending");
  }
  return NextResponse.redirect(callbackUrl);
}

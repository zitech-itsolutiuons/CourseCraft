import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ReconstructionAccess } from "@/lib/models/CourseReconstruction";
import { User } from "@/lib/models/User";
import { initializeReconstructionPayment } from "@/lib/paystack";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  await connectDB();
  if (await ReconstructionAccess.exists({ userId, active: true }))
    return NextResponse.json({ error: "You already have reconstruction access." }, { status: 409 });
  const user = await User.findById(userId).select("email").lean();
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  try {
    return NextResponse.json(await initializeReconstructionPayment(userId, user.email));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start payment.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

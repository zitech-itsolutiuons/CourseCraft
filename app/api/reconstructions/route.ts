import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { reconstructCourse } from "@/lib/jobs/reconstructCourse";
import { Course } from "@/lib/models/Course";
import { CourseReconstruction, ReconstructionAccess } from "@/lib/models/CourseReconstruction";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { currentReconstructionWeek, isDuplicateProcessingReconstruction, reconstructionUsage, reserveReconstruction, releaseReconstruction } from "@/lib/reconstruction";
import { hasPaystackConfiguration } from "@/lib/paystack";

export const runtime = "nodejs";
export const maxDuration = 300;
const STALE_JOB_AGE_MS = 10 * 60 * 1000;

const ReconstructionInput = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  prompt: z.string().trim().min(10).max(1200),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  await connectDB();
  const [access, settings, usage] = await Promise.all([
    ReconstructionAccess.findOne({ userId, active: true }).select("grantType").lean(),
    PlatformSettings.findOne({ key: "platform" }).select("reconstructionPriceNgn").lean(),
    reconstructionUsage(userId),
  ]);
  return NextResponse.json({
    entitled: Boolean(access),
    grantType: access?.grantType ?? null,
    priceNgn: settings?.reconstructionPriceNgn ?? 0,
    paymentConfigured: hasPaystackConfiguration(),
    usage,
  });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const input = ReconstructionInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Choose a course and enter a prompt of at least 10 characters." }, { status: 400 });

  const access = await getCourseAccess(input.data.courseId, userId);
  if (!access || access.course.status !== "ready") return NextResponse.json({ error: "That course is not available to reconstruct." }, { status: 404 });

  await connectDB();
  const entitlement = await ReconstructionAccess.exists({ userId, active: true });
  if (!entitlement) return NextResponse.json({ error: "Purchase or request course reconstruction access first." }, { status: 403 });

  const staleBefore = new Date(Date.now() - STALE_JOB_AGE_MS);
  const staleJobs = await CourseReconstruction.find({ userId, status: "processing", updatedAt: { $lt: staleBefore } })
    .select("resultCourseId")
    .lean();
  if (staleJobs.length) {
    await CourseReconstruction.updateMany(
      { userId, status: "processing", updatedAt: { $lt: staleBefore } },
      { $set: { status: "failed", error: "Reconstruction took too long. Please try again." } }
    );
    const staleCourseIds = staleJobs.flatMap((job) => job.resultCourseId ? [job.resultCourseId] : []);
    if (staleCourseIds.length) {
      await Course.updateMany(
        { _id: { $in: staleCourseIds }, status: "processing" },
        { $set: { status: "failed", stage: "failed", error: "Reconstruction took too long. Please try again." } }
      );
    }
  }

  const weekStart = currentReconstructionWeek();
  const reservation = await reserveReconstruction(userId, weekStart);
  if (!reservation) return NextResponse.json({ error: "You have used all 3 reconstructions for this week. Your limit resets Monday in Nigeria time." }, { status: 429 });

  let job;
  try {
    job = await CourseReconstruction.create({
      userId,
      sourceCourseId: access.course._id,
      prompt: input.data.prompt,
      weekStart,
      status: "processing",
    });
  } catch (error) {
    await releaseReconstruction(userId, weekStart);
    if (isDuplicateProcessingReconstruction(error))
      return NextResponse.json({ error: "A reconstruction is already in progress. Wait for it to finish before starting another." }, { status: 409 });
    throw error;
  }

  after(() => reconstructCourse(String(job._id)));
  return NextResponse.json({
    jobId: String(job._id),
    remaining: Math.max(0, 3 - reservation.used),
  }, { status: 202 });
}

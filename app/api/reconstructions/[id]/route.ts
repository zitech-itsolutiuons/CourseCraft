import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { CourseReconstruction } from "@/lib/models/CourseReconstruction";
import { validReconstructionId } from "@/lib/reconstruction";

const STALE_JOB_AGE_MS = 10 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  if (!validReconstructionId(id)) return NextResponse.json({ error: "Reconstruction not found" }, { status: 404 });
  await connectDB();
  const job = await CourseReconstruction.findOne({ _id: id, userId })
    .select("status resultCourseId error updatedAt")
    .lean();
  if (!job) return NextResponse.json({ error: "Reconstruction not found" }, { status: 404 });
  if (job.status === "processing" && Date.now() - job.updatedAt.getTime() > STALE_JOB_AGE_MS) {
    const resultCourseId = job.resultCourseId;
    const updated = await CourseReconstruction.updateOne(
      { _id: job._id, status: "processing", updatedAt: { $lt: new Date(Date.now() - STALE_JOB_AGE_MS) } },
      { $set: { status: "failed", error: "Reconstruction took too long. Please try again." } }
    );
    if (updated.modifiedCount > 0 && resultCourseId) {
      await Course.updateOne(
        { _id: resultCourseId, status: "processing" },
        { $set: { status: "failed", stage: "failed", error: "Reconstruction took too long. Please try again." } }
      );
      return NextResponse.json({ status: "failed", courseId: null, error: "Reconstruction took too long. Please try again." });
    }
  }
  return NextResponse.json({
    status: job.status,
    courseId: job.resultCourseId ? String(job.resultCourseId) : null,
    error: job.error ?? null,
  });
}

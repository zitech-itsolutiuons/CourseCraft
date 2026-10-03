import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getCourseAccess } from "@/lib/access";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { CourseMedia } from "@/lib/models/Course";

type Ctx = { params: Promise<{ id: string; index: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id, index: rawIndex } = await params;
  const index = Number(rawIndex);
  if (!isValidObjectId(id) || !Number.isSafeInteger(index) || index < 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  const userId = await getUserId();
  if (!userId || !(await getCourseAccess(id, userId))) return new NextResponse("Not found", { status: 404 });

  await connectDB();
  const media = await CourseMedia.findOne({ courseId: id, index }).select("contentType data").lean();
  if (!media) return new NextResponse("Not found", { status: 404 });

  const data = Buffer.from(media.data.buffer.subarray(0, media.data.position));
  return new NextResponse(data, {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
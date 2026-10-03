import { getUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCourseAccess } from "@/lib/access";
import { Chapter, StudentProgress } from "@/lib/models/Course";
import { QUIZ_PASS_THRESHOLD } from "@/lib/quizProgress";

const oid = z.string().regex(/^[a-f\d]{24}$/i);
const Body = z.object({
  courseId: oid,
  chapterId: oid,
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  answers: z.array(z.number().int()),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { courseId, chapterId, score, total, answers } = parsed.data;

  if (score > total) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await connectDB();
  if (!(await getCourseAccess(courseId, userId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await Chapter.exists({ _id: chapterId, courseId }))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await StudentProgress.findOneAndUpdate(
    { userId, courseId },
    {
      $set: { lastChapterId: chapterId },
      $push: { quizAttempts: { chapterId, score, total, answers, at: new Date() } },
      ...(score / total >= QUIZ_PASS_THRESHOLD ? { $addToSet: { completedChapterIds: chapterId } } : {}),
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}

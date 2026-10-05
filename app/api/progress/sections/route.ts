import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json, parseBody } from "@/lib/http";
import { parseChapterSections } from "@/lib/chapterSections";
import { Chapter, StudentProgress } from "@/lib/models/Course";
import { z } from "zod";

const id = z.string().regex(/^[a-f\d]{24}$/i);
const Body = z.object({
  courseId: id,
  chapterId: id,
  sectionId: z.string().regex(/^section-\d+-[a-z0-9-]+$/).max(64),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const body = await parseBody(req, Body);
  if ("res" in body) return body.res;

  const { courseId, chapterId, sectionId } = body.data;
  await connectDB();
  if (!(await getCourseAccess(courseId, userId))) return json({ error: "Course not found" }, 404);

  const chapter = await Chapter.findOne({ _id: chapterId, courseId }).select("contentMd").lean();
  if (!chapter) return json({ error: "Chapter not found" }, 404);
  if (!parseChapterSections(chapter.contentMd).some((section) => section.id === sectionId)) {
    return json({ error: "Section not found" }, 404);
  }

  await StudentProgress.findOneAndUpdate(
    { userId, courseId },
    { $addToSet: { completedSections: { chapterId, sectionId } } },
    { upsert: true }
  );
  return json({ ok: true });
}

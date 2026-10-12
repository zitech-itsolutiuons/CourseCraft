import { isValidObjectId } from "mongoose";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { CourseSummaryRequest } from "@/lib/models/CourseSummaryRequest";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { writeCourseSummary } from "@/mastra/generation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in to summarize this course." }, 401);

  const { id } = await params;
  if (!isValidObjectId(id)) return json({ error: "Course not found." }, 404);

  await connectDB();
  const access = await getCourseAccess(id, userId);
  if (!access || access.course.status !== "ready") {
    return json({ error: "This course is not available for summarization." }, 404);
  }

  const settings = await PlatformSettings.findOne({ key: "platform" })
    .select("courseSummarizationEnabled")
    .lean();
  if (!settings?.courseSummarizationEnabled) {
    return json({ error: "Course summarization is currently disabled by an administrator." }, 403);
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const requestCount = await CourseSummaryRequest.countDocuments({ userId, createdAt: { $gte: hourAgo } });
  if (requestCount >= 10) {
    return json({ error: "You have reached the limit of 10 course summaries per hour. Please try again later." }, 429);
  }

  const chapters = await Chapter.find({ courseId: access.course._id })
    .sort({ index: 1 })
    .select("title summary contentMd")
    .lean();
  if (!chapters.length) return json({ error: "This course does not have material to summarize yet." }, 409);

  await CourseSummaryRequest.create({ userId, courseId: access.course._id });
  const totalBudget = 36_000;
  const perChapterBudget = Math.max(1, Math.floor(totalBudget / chapters.length));
  const sourceChapters = chapters.map((chapter) => ({
    title: chapter.title,
    summary: (chapter.summary.trim() || chapter.contentMd).slice(0, perChapterBudget),
  }));

  try {
    const summary = await writeCourseSummary({
      courseTitle: access.course.title,
      description: access.course.description ?? "",
      chapters: sourceChapters,
    });
    return json({ summary });
  } catch (error) {
    console.error("[course-summary] generation failed", error);
    return json({ error: "The course summary could not be generated. Please try again." }, 502);
  }
}

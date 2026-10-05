import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { OnDemandAssessment } from "@/lib/models/OnDemandAssessment";
import { generateOnDemandAssessment } from "@/mastra/onDemandAssessment";

const RequestSchema = z.object({
  courseId: z.string().refine(isValidObjectId),
  questionType: z.enum(["objective", "theory"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionCount: z.number().int().min(1).max(20),
});

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in to create an assessment." }, 401);
  const body = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "Choose a valid course, format, difficulty, and question count (1-20)." }, 400);

  await connectDB();
  const access = await getCourseAccess(body.data.courseId, userId);
  if (!access || access.course.status !== "ready") {
    return json({ error: "This course is not available for assessment." }, 404);
  }
  const recentCount = await OnDemandAssessment.countDocuments({
    userId,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recentCount >= 10) {
    return json({ error: "You have reached the limit of 10 generated assessments per hour. Please try again later." }, 429);
  }

  const chapters = await Chapter.find({ courseId: access.course._id })
    .sort({ index: 1 })
    .select("title contentMd")
    .lean();
  const usableChapters = chapters.filter((chapter) => chapter.contentMd.trim().length > 0);
  if (!usableChapters.length) return json({ error: "This course does not have study material to build an assessment yet." }, 409);

  const characterBudget = Math.floor(60_000 / usableChapters.length);
  const sourceChapters = usableChapters.map((chapter) => ({
    title: chapter.title,
    contentMd: chapter.contentMd.slice(0, characterBudget),
  }));
  try {
    const questions = await generateOnDemandAssessment({
      courseTitle: access.course.title,
      chapters: sourceChapters,
      difficulty: body.data.difficulty,
      questionType: body.data.questionType,
      questionCount: body.data.questionCount,
    });
    const assessment = await OnDemandAssessment.create({
      userId,
      courseId: access.course._id,
      courseTitle: access.course.title,
      questionType: body.data.questionType,
      difficulty: body.data.difficulty,
      objectiveQuestions: body.data.questionType === "objective" ? questions : [],
      theoryQuestions: body.data.questionType === "theory" ? questions : [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const safeQuestions = body.data.questionType === "objective"
      ? assessment.objectiveQuestions.map(({ question, options }) => ({ question, options }))
      : assessment.theoryQuestions.map(({ question }) => ({ question }));
    return json({
      assessmentId: String(assessment._id),
      courseTitle: assessment.courseTitle,
      difficulty: assessment.difficulty,
      questionType: assessment.questionType,
      questions: safeQuestions,
      expiresAt: assessment.expiresAt,
    });
  } catch (error) {
    console.error("[assessments] generation failed", error);
    return json({ error: "The assessment could not be generated. Please try again." }, 502);
  }
}

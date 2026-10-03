import { isValidObjectId } from "mongoose";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Chapter, CourseFinalAssessment, Quiz, StudentProgress } from "@/lib/models/Course";
import { QUIZ_PASS_THRESHOLD } from "@/lib/quizProgress";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const Submission = z.object({
  objectiveAnswers: z.array(z.number().int().min(0).max(3)).max(15),
  theoryAnswers: z.array(z.string().trim().min(1).max(5000)).max(5),
});

export async function POST(req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const courseId = (await params).id;
  if (!isValidObjectId(courseId)) return json({ error: "Course not found" }, 404);
  const parsed = Submission.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid final assessment answers" }, 400);

  await connectDB();
  const access = await getCourseAccess(courseId, userId);
  if (!access) return json({ error: "Course not found" }, 404);
  const [assessment, chapters, quizzes, progress] = await Promise.all([
    CourseFinalAssessment.findOne({ courseId }).lean(),
    Chapter.find({ courseId }).select("_id").lean(),
    Quiz.find({ courseId }).select("chapterId questions").lean(),
    StudentProgress.findOne({ userId, courseId }).select("completedChapterIds").lean(),
  ]);
  if (!assessment) return json({ error: "The final assessment is not available yet" }, 404);

  const quizzesByChapter = new Map(quizzes.map((quiz) => [String(quiz.chapterId), quiz.questions.length]));
  const requiredChapterIds = chapters
    .filter((chapter) => (quizzesByChapter.get(String(chapter._id)) ?? 0) > 0)
    .map((chapter) => String(chapter._id));
  const completed = new Set((progress?.completedChapterIds ?? []).map(String));
  if (access.role !== "owner" && requiredChapterIds.some((chapterId) => !completed.has(chapterId))) {
    return json({ error: "Pass every chapter quiz before taking the final assessment." }, 403);
  }

  const { objectiveAnswers, theoryAnswers } = parsed.data;
  if (
    objectiveAnswers.length !== assessment.objectiveQuestions.length ||
    theoryAnswers.length !== assessment.theoryQuestions.length ||
    objectiveAnswers.some((answer, index) => answer >= assessment.objectiveQuestions[index].options.length)
  ) {
    return json({ error: "Answer every question before submitting." }, 400);
  }

  const objectiveScore = objectiveAnswers.reduce(
    (score, answer, index) => score + (answer === assessment.objectiveQuestions[index].correctIndex ? 1 : 0),
    0
  );
  await StudentProgress.findOneAndUpdate(
    { userId, courseId },
    {
      $push: {
        finalAssessmentAttempts: {
          objectiveScore,
          objectiveTotal: objectiveAnswers.length,
          objectiveAnswers,
          theoryAnswers,
          at: new Date(),
        },
      },
    },
    { upsert: true }
  );

  return json({ objectiveScore, objectiveTotal: objectiveAnswers.length, passedChapterQuizThreshold: QUIZ_PASS_THRESHOLD });
}
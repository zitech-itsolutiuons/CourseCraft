import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { OnDemandAssessment } from "@/lib/models/OnDemandAssessment";
import { gradeTheoryAssessment } from "@/mastra/onDemandAssessment";

type Context = { params: Promise<{ id: string }> };
const SubmissionSchema = z.object({
  answers: z.array(z.union([z.number().int().min(0).max(3), z.string().trim().max(2000)])).min(1).max(20),
});

export async function POST(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in to submit your assessment." }, 401);
  const { id } = await params;
  if (!isValidObjectId(id)) return json({ error: "Assessment not found." }, 404);
  const body = SubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "Submit one valid answer for every question." }, 400);

  await connectDB();
  const assessment = await OnDemandAssessment.findOne({
    _id: id,
    userId,
    expiresAt: { $gt: new Date() },
  });
  if (!assessment) return json({ error: "Assessment not found or it has expired." }, 404);
  if (assessment.result) return json({ result: assessment.result, alreadySubmitted: true });

  const questions = assessment.questionType === "objective" ? assessment.objectiveQuestions : assessment.theoryQuestions;
  if (body.data.answers.length !== questions.length) {
    return json({ error: "Submit one answer for every question." }, 400);
  }
  if (assessment.questionType === "objective" && body.data.answers.some((answer, index) =>
    typeof answer !== "number" || answer >= assessment.objectiveQuestions[index].options.length
  )) {
    return json({ error: "One or more selected options are invalid." }, 400);
  }
  if (assessment.questionType === "theory" && body.data.answers.some((answer) =>
    typeof answer !== "string" || answer.length === 0
  )) {
    return json({ error: "Write an answer for every question before submitting." }, 400);
  }
  const objectiveAnswers = body.data.answers.flatMap((answer) => typeof answer === "number" ? [answer] : []);
  const theoryAnswers = body.data.answers.flatMap((answer) => typeof answer === "string" ? [answer] : []);

  const claim = await OnDemandAssessment.findOneAndUpdate(
    {
      _id: id,
      userId,
      result: null,
      expiresAt: { $gt: new Date() },
      $or: [{ gradingStartedAt: null }, { gradingStartedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }],
    },
    { $set: { gradingStartedAt: new Date() } },
    { new: true }
  );
  if (!claim) {
    const latest = await OnDemandAssessment.findOne({ _id: id, userId }).select("result").lean();
    if (latest?.result) return json({ result: latest.result, alreadySubmitted: true });
    return json({ error: "This assessment is already being submitted. Please wait a moment." }, 409);
  }

  try {
    let score = 0;
    let maxScore = 0;
    let objectiveResults: { selectedIndex: number; correctIndex: number; explanation: string }[] = [];
    let theoryResults: { score: number; maxScore: number; feedback: string }[] = [];
    if (claim.questionType === "objective") {
      objectiveResults = claim.objectiveQuestions.map((question, index) => {
        const selectedIndex = objectiveAnswers[index];
        const correct = selectedIndex === question.correctIndex;
        score += correct ? 1 : 0;
        maxScore += 1;
        return { selectedIndex, correctIndex: question.correctIndex, explanation: question.explanation };
      });
    } else {
      const grades = await gradeTheoryAssessment({
        courseTitle: claim.courseTitle,
        questions: claim.theoryQuestions,
        answers: theoryAnswers,
      });
      theoryResults = grades.map((grade) => ({
        score: grade.score,
        maxScore: 10,
        feedback: grade.feedback,
      }));
      score = theoryResults.reduce((total, result) => total + result.score, 0);
      maxScore = theoryResults.length * 10;
    }
    const result = {
      score,
      maxScore,
      percentage: maxScore ? Math.round((score / maxScore) * 100) : 0,
      objectiveResults,
      theoryResults,
    };
    const saved = await OnDemandAssessment.updateOne(
      { _id: id, userId, gradingStartedAt: claim.gradingStartedAt, expiresAt: { $gt: new Date() } },
      { $set: { result, submittedAt: new Date() }, $unset: { gradingStartedAt: 1 } }
    );
    if (!saved.modifiedCount) return json({ error: "This assessment has expired. Generate a new one to continue." }, 410);
    return json({ result });
  } catch (error) {
    await OnDemandAssessment.updateOne(
      { _id: id, userId, gradingStartedAt: claim.gradingStartedAt },
      { $unset: { gradingStartedAt: 1 } }
    );
    console.error("[assessments] grading failed", error);
    return json({ error: "Your answers could not be graded. Your assessment is still available; please try again." }, 502);
  }
}

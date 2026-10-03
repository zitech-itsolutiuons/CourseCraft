import { notFound, redirect } from "next/navigation";
import CourseEditor, { type Ch } from "@/components/CourseEditor";
import ManageTabs from "@/components/ManageTabs";
import SiteHeader from "@/components/SiteHeader";
import { getCourseAccess } from "@/lib/access";
import { getUserId } from "@/lib/auth";
import { Chapter, CourseFinalAssessment, Quiz } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  const access = await getCourseAccess(id, userId);
  if (!access || access.role !== "owner") notFound();
  const { course } = access;

  const [chapters, quizzes, finalAssessment] = await Promise.all([
    Chapter.find({ courseId: id }).sort({ index: 1 }).lean(),
    Quiz.find({ courseId: id }).lean(),
    CourseFinalAssessment.findOne({ courseId: id }).lean(),
  ]);
  if (course.status !== "ready" || chapters.length === 0) redirect(`/courses/${id}`);

  const quizBy = new Map(quizzes.map((q) => [String(q.chapterId), q.questions]));
  const initial: Ch[] = chapters.map((c) => ({
    id: String(c._id),
    title: c.title,
    contentMd: c.contentMd,
    videoUrl: c.videoUrl ?? "",
    quiz: (quizBy.get(String(c._id)) ?? []).map((q) => ({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    })),
  }));

  return (
    <>
      <SiteHeader />
      <ManageTabs courseId={id} title={course.title} active="edit" />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <CourseEditor
          courseId={id}
          initialTitle={course.title}
          initialDescription={course.description ?? ""}
          initialChapters={initial}
          initialFinalAssessment={finalAssessment ? {
            objectiveQuestions: finalAssessment.objectiveQuestions.map((question) => ({
              question: question.question,
              options: [...question.options],
              correctIndex: question.correctIndex,
              explanation: question.explanation,
            })),
            theoryQuestions: finalAssessment.theoryQuestions.map((question) => ({
              question: question.question,
              sampleAnswer: question.sampleAnswer,
              gradingPoints: [...question.gradingPoints],
            })),
          } : null}
        />
      </main>
    </>
  );
}

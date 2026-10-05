import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import BuildProgress from "@/components/BuildProgress";
import ChapterReader, { type ChapterView } from "@/components/reader/ChapterReader";
import { connectDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { Chapter, CourseFinalAssessment, Quiz, StudentNote, StudentProgress } from "@/lib/models/Course";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { UserProfile } from "@/lib/models/UserProfile";
import { QUIZ_PASS_THRESHOLD } from "@/lib/quizProgress";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;
  const studentName = session.user.name?.trim() || session.user.email?.split("@")[0] || "there";
  await connectDB();
  const access = await getCourseAccess(id, userId, { allowCatalogPreview: true });
  if (!access) notFound();
  const { course } = access;

  if (course.status === "comingSoon") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Coming soon</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
          {course.description && <p className="mt-4 max-w-[65ch] text-sm leading-6 text-slate-600">{course.description}</p>}
          <p className="mt-5 text-sm leading-6 text-slate-600">Study materials are being prepared. Check back later to study this course.</p>
          {access.role === "owner" && (
            <Link href={`/admin/courses/${id}`} className="mt-7 inline-flex border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              Add study materials
            </Link>
          )}
          <Link href="/courses" className="mt-7 block text-sm font-medium text-blue-700 hover:text-blue-900">Back to courses</Link>
        </main>
      </>
    );
  }

  const [chapters, quizzes, progress, settings, profile, finalAssessment, savedNotes] = await Promise.all([
    Chapter.find({ courseId: id }).sort({ index: 1 }).lean(),
    Quiz.find({ courseId: id }).lean(),
    StudentProgress.findOne({ userId, courseId: id }).lean(),
    PlatformSettings.findOne({ key: "platform" }).select("studentQuizQuestionLimit").lean(),
    UserProfile.findOne({ userId }).select("displayName avatarData").lean(),
    CourseFinalAssessment.findOne({ courseId: id }).lean(),
    StudentNote.find({ userId, courseId: id }).select("chapterId content").lean(),
  ]);

  if (course.status === "processing") {
    if (access.role === "catalog") {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Coming soon</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
            <p className="mt-5 text-sm leading-6 text-slate-600">Study materials are being prepared. Check back later to study this course.</p>
            <Link href="/courses" className="mt-7 inline-block text-sm font-medium text-blue-700 hover:text-blue-900">Back to courses</Link>
          </main>
        </>
      );
    }
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
          <BuildProgress
            courseId={id}
            initial={{
              status: "processing",
              stage: course.stage ?? "queued",
              title: course.title,
              totalChapters: course.totalChapters ?? 0,
              lecturesDone: course.lecturesDone ?? 0,
              quizzesDone: course.quizzesDone ?? 0,
            }}
          />
        </main>
      </>
    );
  }

  if (course.status === "failed" || chapters.length === 0) {
    if (access.role === "catalog") {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Coming soon</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
            <p className="mt-5 text-sm leading-6 text-slate-600">Study materials are being updated. Check back later to study this course.</p>
            <Link href="/courses" className="mt-7 inline-block text-sm font-medium text-blue-700 hover:text-blue-900">Back to courses</Link>
          </main>
        </>
      );
    }
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
          <h1 className="text-2xl font-semibold">This course could not be built</h1>
          <p className="mt-4 border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
            {course.error ?? "Something went wrong. Upload the document again."}
          </p>
          <Link href="/courses" className="mt-6 inline-block text-sm underline underline-offset-4 text-blue-700">
            Back to your courses
          </Link>
        </main>
      </>
    );
  }

  const quizByChapter = new Map(quizzes.map((q) => [String(q.chapterId), q.questions]));
  const quizQuestionLimit = access.role === "owner"
    ? 15
    : Math.min(15, Math.max(1, settings?.studentQuizQuestionLimit ?? 15));
  const views: ChapterView[] = chapters.map((c) => ({
    id: String(c._id),
    index: c.index,
    title: c.title,
    contentMd: c.contentMd,
    videoUrl: c.videoUrl ?? "",
    quiz: (quizByChapter.get(String(c._id)) ?? []).slice(0, quizQuestionLimit).map((q) => ({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    })),
  }));

  return (
    <ChapterReader
      courseId={id}
      courseTitle={course.title}
      studentName={profile?.displayName || studentName}
      studentAvatar={profile?.avatarData || ""}
      isOwner={access.role === "owner"}
      isAdmin={await isAdmin(userId)}
      chapters={views}
      completedSections={Object.fromEntries(
        (progress?.completedSections ?? []).reduce<Map<string, string[]>>((byChapter, section) => {
          const chapterId = String(section.chapterId);
          byChapter.set(chapterId, [...(byChapter.get(chapterId) ?? []), section.sectionId]);
          return byChapter;
        }, new Map())
      )}
      notesByChapter={Object.fromEntries(savedNotes.map((note) => [String(note.chapterId), note.content]))}
      finalAssessment={finalAssessment ? {
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
      completedIds={[
        ...new Set(
          (progress?.quizAttempts ?? [])
            .filter((attempt) =>
              typeof attempt.score === "number" &&
              typeof attempt.total === "number" &&
              attempt.total > 0 &&
              attempt.score / attempt.total >= QUIZ_PASS_THRESHOLD
            )
            .map((attempt) => String(attempt.chapterId))
        ),
      ]}
    />
  );
}

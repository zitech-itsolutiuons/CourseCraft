import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import AssessmentBuilder from "@/components/assessments/AssessmentBuilder";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction, StudentProgress } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  await connectDB();

  const [restrictions, progress] = await Promise.all([
    CourseRestriction.find({ userId }).select("courseId").lean(),
    StudentProgress.find({ userId }).select("courseId").lean(),
  ]);
  const restrictedIds = restrictions.map(({ courseId }) => courseId);
  const joinedIds = progress.map(({ courseId }) => courseId);
  const courses = await Course.find({
    status: "ready",
    archivedAt: null,
    _id: { $nin: restrictedIds },
    $or: [
      { ownerId: userId },
      { catalogVisible: true },
      { _id: { $in: joinedIds } },
    ],
  })
    .sort({ title: 1 })
    .select("title")
    .lean();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Build a practice assessment</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Choose a course and challenge level. Questions are generated from its study material, so each practice session is focused on what you are learning.
          </p>
        </div>
        <div className="mt-9 border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <AssessmentBuilder courses={courses.map((course) => ({ id: String(course._id), title: course.title }))} />
        </div>
        <p className="mt-5 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          Assessments are automatically removed after 24 hours. To keep generation responsive for everyone, you can create up to 10 per hour.
        </p>
      </main>
    </>
  );
}

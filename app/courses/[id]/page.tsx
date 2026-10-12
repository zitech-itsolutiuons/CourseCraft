import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import CourseSummary from "@/components/CourseSummary";
import { getCourseAccess } from "@/lib/access";
import { Chapter } from "@/lib/models/Course";
import { PlatformSettings } from "@/lib/models/PlatformSettings";

export const dynamic = "force-dynamic";

export default async function CourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const session = await auth();
  if (!session?.user) redirect("/signin");
  const access = await getCourseAccess(id, session.user.id, { allowCatalogPreview: true });
  if (!access) notFound();

  const [chapters, settings] = await Promise.all([
    Chapter.find({ courseId: id }).sort({ index: 1 }).select("title summary").lean(),
    PlatformSettings.findOne({ key: "platform" })
      .select("courseSummarizationEnabled")
      .lean(),
  ]);
  const { course } = access;
  const canLearn = course.status === "ready" && chapters.length > 0;
  const statusLabel = course.status === "comingSoon"
    ? "Coming soon"
    : course.status === "processing"
      ? "Preparing materials"
      : course.status === "failed"
        ? "Materials need attention"
        : "Ready to learn";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl min-w-0 space-y-8 px-3 py-7 sm:space-y-10 sm:px-6 sm:py-10 lg:px-8">
        <div>
          <Link href="/courses" className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200">
            Back to your courses
          </Link>
          <div className="mt-6 flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Course details</p>
              <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-slate-950 [overflow-wrap:anywhere] dark:text-white sm:text-4xl">
                {course.title}
              </h1>
              <p className="mt-3 max-w-[65ch] whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                {course.description || "Explore the course outline and review its learning materials."}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
              {canLearn ? (
                <Link
                  href={`/courses/${id}/learn`}
                  className="inline-flex min-h-11 items-center justify-center border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Proceed to learn
                </Link>
              ) : access.role === "owner" ? (
                <Link
                  href={`/admin/courses/${id}`}
                  className="inline-flex min-h-11 items-center justify-center border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Manage materials
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <section aria-label="Course information" className="flex flex-wrap gap-x-8 gap-y-4 border-b border-slate-200 pb-6 text-sm dark:border-slate-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
            <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{statusLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Chapters</p>
            <p className="mt-1 font-medium tabular-nums text-slate-900 dark:text-slate-100">{chapters.length}</p>
          </div>
        </section>

        {canLearn && (
          <section aria-label="Course summary" className="border-b border-slate-200 pb-6 dark:border-slate-800">
            <CourseSummary courseId={id} enabled={Boolean(settings?.courseSummarizationEnabled)} />
          </section>
        )}

        {chapters.length > 0 ? (
          <section aria-labelledby="course-outline-heading">
            <h2 id="course-outline-heading" className="text-xl font-semibold text-slate-950 dark:text-white">Course outline</h2>
            <ol className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {chapters.map((chapter, index) => (
                <li key={String(chapter._id)} className="flex gap-4 py-4">
                  <span className="mt-0.5 w-8 shrink-0 text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words font-medium text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{chapter.title}</h3>
                    {chapter.summary && (
                      <p className="mt-1 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{chapter.summary}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="border-y border-slate-200 py-6 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {course.status === "processing"
              ? "Course materials are being prepared. The outline will appear here when they are ready."
              : course.status === "failed"
                ? course.error || "Course materials could not be prepared yet."
                : "The course outline will appear here when study materials are available."}
          </p>
        )}
      </main>
    </>
  );
}

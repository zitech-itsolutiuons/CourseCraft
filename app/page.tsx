import Link from "next/link";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction } from "@/lib/models/Course";
import { defaultHomepageContent, HomepageContent } from "@/lib/models/HomepageContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  await connectDB();
  const restrictedIds = session?.user
    ? await CourseRestriction.find({ userId: session.user.id }).distinct("courseId")
    : [];
  const [savedContent, availableCourses] = await Promise.all([
    HomepageContent.findOne({ key: "home" }).lean(),
    Course.find({ catalogVisible: true, status: "ready", archivedAt: null, _id: { $nin: restrictedIds } })
      .sort({ title: 1 })
      .select("title description chapterCount")
      .lean(),
  ]);
  const content = savedContent
    ? { ...defaultHomepageContent, ...savedContent }
    : defaultHomepageContent;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-blue-100 bg-[#eff5ff] dark:border-slate-700 dark:bg-[#101d32]">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-12 md:px-10 md:py-16 lg:min-h-[620px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-20">
            <div>
              <h1 className="max-w-[15ch] text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
                {content.heroTitle}
              </h1>
              <p className="mt-6 max-w-[52ch] text-base leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
                {content.heroDescription}
              </p>
              <p className="mt-5 text-sm font-medium text-slate-700 dark:text-slate-200">
                {content.institution} <span className="mx-2 text-blue-500 dark:text-cyan-300">/</span> {content.program} <span className="mx-2 text-blue-500 dark:text-cyan-300">/</span> {content.level}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex min-h-12 items-center justify-center rounded-[15px] border border-blue-800 bg-blue-800 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(29,78,216,0.16)] transition-all hover:-translate-y-0.5 hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  {content.primaryCta}
                </Link>
                <Link
                  href="/signin"
                  className="inline-flex min-h-12 items-center justify-center rounded-[15px] border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  {content.secondaryCta}
                </Link>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{content.heroFootnote}</p>
            </div>

            <div className="mx-auto hidden w-full max-w-[500px] lg:ml-auto lg:block">
              <div className="overflow-hidden rounded-[16px] border-t border-cyan-400 bg-[#10243a] text-white shadow-[0_24px_60px_rgba(15,35,60,0.18)]">
                <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">{content.outlineEyebrow}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{content.outlineTitle}</h2>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/20 px-2.5 py-1.5 text-[11px] font-medium text-slate-200">{content.outlineLevel}</span>
                </div>

                <ol className="border-y border-white/10 px-6">
                  {content.topics.map((topic, index) => (
                    <li key={topic} className="flex items-center gap-4 border-b border-white/10 py-3.5 last:border-b-0">
                      <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-cyan-200">{String(index + 1).padStart(2, "0")}</span>
                      <span className="text-sm leading-5 text-slate-100">{topic}</span>
                    </li>
                  ))}
                </ol>

                <p className="px-6 py-4 text-xs text-slate-300">{content.outlineNote}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-[#0b1220]">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-16">
            <h2 className="max-w-[24ch] text-2xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 dark:text-white sm:text-3xl">
              {content.workflowTitle}
            </h2>
            <div className="mt-8 grid gap-7 border-t border-slate-200 pt-6 dark:border-slate-700 md:grid-cols-3 md:gap-8">
              {content.workflowSteps.map((item, index) => (
                <article key={item.title} className="md:border-r md:border-slate-200 md:pr-8 last:md:border-r-0 dark:md:border-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-700 dark:text-cyan-300">
                    {String(index + 1).padStart(2, "0")} <span className="ml-2 text-slate-900 dark:text-white">{item.title}</span>
                  </p>
                  <p className="mt-3 max-w-[34ch] text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="available-courses" className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-16">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">Available courses</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Browse published courses and start studying.</p>
              </div>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{availableCourses.length} {availableCourses.length === 1 ? "course" : "courses"}</span>
            </header>

            {availableCourses.length ? (
              <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {availableCourses.map((course) => {
                  const courseUrl = `/courses/${course._id}`;
                  const href = session?.user ? courseUrl : `/signup?callbackUrl=${encodeURIComponent(courseUrl)}`;
                  return (
                    <li key={String(course._id)}>
                      <Link
                        href={href}
                        className="group flex flex-col justify-between gap-4 px-4 py-5 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 dark:hover:bg-slate-800 sm:flex-row sm:items-center sm:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block text-base font-semibold text-slate-900 dark:text-slate-100">{course.title}</span>
                          {course.description && <span className="mt-1 block max-w-[72ch] text-sm leading-6 text-slate-600 dark:text-slate-300">{course.description}</span>}
                          <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">{course.chapterCount} chapters</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-blue-700 group-hover:text-blue-900 dark:text-blue-300 dark:group-hover:text-blue-200">
                          {session?.user ? "Open course" : "Sign up to study"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-y border-slate-200 bg-white py-7 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                No courses are available yet. Check back soon.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import UploadForm from "@/components/UploadForm";
import { joinCourseByCode } from "@/app/courses/actions";
import { connectDB } from "@/lib/db";
import { getUserId, isAdmin } from "@/lib/auth";
import { Course, CourseGroupSettings, CourseRestriction, StudentProgress } from "@/lib/models/Course";
import { UserProfile } from "@/lib/models/UserProfile";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; description?: string | null; note: string; completed?: number; total?: number };

function CourseList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="border-y border-slate-200 py-7 text-sm text-slate-500 dark:border-slate-800">No courses here yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {rows.map((c) => (
        <li key={c.id}>
          <Link
            href={`/courses/${c.id}`}
            className="block px-4 py-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{c.title}</p>
                {c.description && <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{c.description}</p>}
              </div>
              <span className="shrink-0 text-xs font-medium text-blue-700 dark:text-blue-300">Open</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.note}</p>
            {typeof c.completed === "number" && typeof c.total === "number" && c.total > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label={`${c.title} completion`}
                  aria-valuenow={Math.round((c.completed / c.total) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 min-w-0 flex-1 bg-slate-100 dark:bg-slate-700"
                >
                  <div className="h-full bg-blue-700 dark:bg-blue-400" style={{ width: `${Math.round((c.completed / c.total) * 100)}%` }} />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{c.completed}/{c.total}</span>
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;
  await connectDB();
  const canUpload = await isAdmin(userId);

  const [restrictions, groupCodeSettings, profile] = await Promise.all([
    CourseRestriction.find({ userId }).select("courseId").lean(),
    CourseGroupSettings.findOne({ key: "course-groups" }).select("enabled").lean(),
    UserProfile.findOne({ userId }).select("displayName avatarData").lean(),
  ]);
  const groupCodesEnabled = !!groupCodeSettings?.enabled;
  const displayName = profile?.displayName || session.user.name || "there";
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  const restrictedIds = restrictions.map((restriction) => restriction.courseId);
  const [ownedCourses, catalogCourses] = await Promise.all([
    Course.find({ ownerId: userId }).sort({ createdAt: -1 }).select("title description status chapterCount catalogVisible").lean(),
    Course.find({ catalogVisible: true, _id: { $nin: restrictedIds } }).sort({ createdAt: -1 }).select("title description status chapterCount").lean(),
  ]);
  const restrictedIdSet = new Set(restrictedIds.map(String));
  const owned = ownedCourses.filter((course) => !restrictedIdSet.has(String(course._id)));
  const joinedProgress = await StudentProgress.find({ userId, courseId: { $nin: restrictedIds } }).select("courseId completedChapterIds").lean();
  const joinedIds = joinedProgress.map((progress) => progress.courseId);
  const joined = joinedIds.length
    ? await Course.find({ _id: { $in: joinedIds }, ownerId: { $ne: userId }, status: "ready" }).sort({ title: 1 }).select("title description chapterCount").lean()
    : [];
  const progressByCourse = new Map(joinedProgress.map((progress) => [String(progress.courseId), progress.completedChapterIds.length]));
  const catalogIds = new Set(catalogCourses.map((course) => String(course._id)));
  const ownedIds = new Set(owned.map((course) => String(course._id)));

  const ownedRows: Row[] = owned.map((c) => ({
    id: String(c._id),
    title: c.title,
    description: c.description,
    note: c.status === "comingSoon" ? "Coming soon" : c.status === "ready" ? `${c.chapterCount} chapters` : c.status === "processing" ? "Study materials are being prepared" : "Build failed. Add materials to try again.",
  }));
  const joinedRows: Row[] = joined
    .filter((course) => !catalogIds.has(String(course._id)))
    .map((course) => {
      const completed = Math.min(progressByCourse.get(String(course._id)) ?? 0, course.chapterCount);
      return {
        id: String(course._id),
        title: course.title,
        description: course.description,
        note: `${course.chapterCount} chapters`,
        completed,
        total: course.chapterCount,
      };
    });
  const catalogRows: Row[] = catalogCourses
    .filter((course) => !ownedIds.has(String(course._id)))
    .map((course) => ({
      id: String(course._id),
      title: course.title,
      description: course.description,
      note: course.status === "ready" ? `${course.chapterCount} chapters` : course.status === "processing" ? "Study materials are being prepared" : course.status === "failed" ? "Materials are being updated" : "Coming soon",
    }));
  const joinNotice = (await searchParams).join;
  const myRows = [...ownedRows, ...joinedRows];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-10 px-5 py-10 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-4">
            {profile?.avatarData ? (
              <img
                src={profile.avatarData}
                alt={`Profile photo of ${displayName}`}
                width={56}
                height={56}
                className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover sm:h-14 sm:w-14 dark:border-slate-700"
              />
            ) : (
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-800 sm:h-14 sm:w-14 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Your learning</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Welcome back, {displayName}. Continue a course or find your next one.</p>
            </div>
          </div>
          <Link href="/profile" className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200">
            Edit profile
          </Link>
        </header>

        {canUpload && (
          <section aria-labelledby="upload-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
            <h2 id="upload-heading" className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Create a course</h2>
            <UploadForm />
          </section>
        )}

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section aria-labelledby="my-courses-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 id="my-courses-heading" className="text-lg font-semibold text-slate-900 dark:text-white">My courses</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your teaching and enrolled courses in one place.</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">{myRows.length}</span>
            </div>
            {myRows.length === 0 ? (
              <p className="border-y border-slate-200 py-7 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {canUpload ? "No courses yet. Join one with a code or create your first course above." : "No courses yet. Join one with a code or browse available courses below."}
              </p>
            ) : <CourseList rows={myRows} />}
          </section>

          <aside aria-labelledby="join-course-heading" className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 id="join-course-heading" className="text-base font-semibold text-slate-900 dark:text-white">Join with a code</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Enter a course code shared by your instructor{groupCodesEnabled ? " or a group code to join several courses at once" : ""}.
            </p>
            {joinNotice === "success" && (
              <p role="status" className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Course access added to your account.</p>
            )}
            {joinNotice === "invalid" && (
              <p role="alert" className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">That code is invalid, disabled, or has no courses available to join.</p>
            )}
            <form action={joinCourseByCode} className="mt-4 space-y-3">
              <label htmlFor="course-code" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Course or group code
                <input
                  id="course-code"
                  name="code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                  required
                  className="mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <button type="submit" className="min-h-11 w-full border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                Join course
              </button>
            </form>
          </aside>
        </div>

        <section aria-labelledby="available-courses-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="available-courses-heading" className="text-lg font-semibold text-slate-900 dark:text-white">Available courses</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Published courses and upcoming study materials.</p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-slate-500 dark:text-slate-400">{catalogRows.length}</span>
          </div>
          {catalogRows.length === 0 ? (
            <p className="border-y border-slate-200 py-7 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">No courses have been published yet.</p>
          ) : <CourseList rows={catalogRows} />}
        </section>
      </main>
    </>
  );
}

import Link from "next/link";
import CourseManagementActions from "@/components/admin/CourseManagementActions";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));

const statusLabel = (status: string) =>
  status === "comingSoon" ? "Coming soon" : status.charAt(0).toUpperCase() + status.slice(1);

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const archived = (await searchParams).view === "archive";
  await connectDB();
  const [courses, activeCount, archivedCount] = await Promise.all([
    Course.find(archived ? { archivedAt: { $ne: null } } : { archivedAt: null })
      .sort({ updatedAt: -1 })
      .select("title status chapterCount createdAt")
      .lean(),
    Course.countDocuments({ archivedAt: null }),
    Course.countDocuments({ archivedAt: { $ne: null } }),
  ]);

  return (
    <section aria-labelledby="courses-heading" className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="courses-heading" className="text-xl font-semibold text-slate-950">Course library</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Manage active courses or restore courses from the archive. Archived courses are hidden from students until restored.
        </p>
      </header>

      <nav aria-label="Course library views" className="flex gap-6 border-b border-slate-200 text-sm">
        <Link
          href="/admin/courses"
          aria-current={!archived ? "page" : undefined}
          className={`border-b-2 py-3 ${!archived ? "border-blue-700 font-medium text-blue-800" : "border-transparent text-slate-600 hover:text-blue-700"}`}
        >
          Active <span className="ml-1 tabular-nums text-slate-500">{activeCount}</span>
        </Link>
        <Link
          href="/admin/courses?view=archive"
          aria-current={archived ? "page" : undefined}
          className={`border-b-2 py-3 ${archived ? "border-blue-700 font-medium text-blue-800" : "border-transparent text-slate-600 hover:text-blue-700"}`}
        >
          Archive <span className="ml-1 tabular-nums text-slate-500">{archivedCount}</span>
        </Link>
      </nav>

      {courses.length ? (
        <div className="overflow-x-auto border-y border-slate-200 bg-white">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Course</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => {
                const id = String(course._id);
                return (
                  <tr key={id}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{course.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{course.chapterCount} chapters</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{statusLabel(course.status)}</td>
                    <td className="px-4 py-4 tabular-nums text-slate-500">{dateLabel(course.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-3">
                        {!archived && (
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
                            <Link href={`/courses/${id}`} className="text-blue-700 hover:text-blue-900">Open</Link>
                            {(course.status === "comingSoon" || course.status === "failed") && (
                              <Link href={`/admin/courses/${id}`} className="text-blue-700 hover:text-blue-900">Add materials</Link>
                            )}
                            {course.status === "ready" && (
                              <Link href={`/courses/${id}/edit`} className="text-blue-700 hover:text-blue-900">Edit</Link>
                            )}
                            <Link href={`/courses/${id}/students`} className="text-blue-700 hover:text-blue-900">Students</Link>
                          </div>
                        )}
                        <CourseManagementActions courseId={id} courseTitle={course.title} archived={archived} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-y border-slate-200 py-8">
          <h3 className="font-medium text-slate-900">{archived ? "The archive is empty" : "No active courses"}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {archived
              ? "When you archive a course, it will appear here and can be restored at any time."
              : "Courses you create will appear here. You can archive them whenever they should no longer be available to students."}
          </p>
        </div>
      )}
    </section>
  );
}

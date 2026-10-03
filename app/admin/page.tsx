import Link from "next/link";
import { redirect } from "next/navigation";
import UploadForm from "@/components/UploadForm";
import { createComingSoonCourse } from "@/app/admin/actions";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { User } from "@/lib/models/User";

export const dynamic = "force-dynamic";

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));

export default async function AdminDashboardPage() {
  const adminId = await getUserId();
  if (!adminId) redirect("/signin");
  await connectDB();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [userCount, adminCount, newUserCount, courseCount, courseStatuses, recentUsers, managedCourses] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ createdAt: { $gte: since } }),
    Course.countDocuments(),
    Course.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]) as Promise<{ _id: string; count: number }[]>,
    User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt").lean(),
    Course.find({ ownerId: adminId }).sort({ createdAt: -1 }).limit(8).select("title status chapterCount createdAt").lean(),
  ]);

  const statusCounts = new Map(courseStatuses.map(({ _id, count }) => [_id, count]));
  const readyCount = statusCounts.get("ready") ?? 0;
  const comingSoonCount = statusCounts.get("comingSoon") ?? 0;
  const processingCount = statusCounts.get("processing") ?? 0;
  const failedCount = statusCounts.get("failed") ?? 0;
  const metrics = [
    { label: "Registered users", value: userCount, note: `${newUserCount} joined in the last 7 days`, tone: "blue" },
    { label: "Administrators", value: adminCount, note: "Accounts with elevated access", tone: "slate" },
    { label: "Courses", value: courseCount, note: `${readyCount} ready to study`, tone: "green" },
    { label: "In progress", value: processingCount, note: `${failedCount} need attention`, tone: "amber" },
  ];
  const statusRows = [
    { label: "Ready", count: readyCount, color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Coming soon", count: comingSoonCount, color: "bg-cyan-500", text: "text-cyan-700" },
    { label: "Processing", count: processingCount, color: "bg-blue-600", text: "text-blue-700" },
    { label: "Failed", count: failedCount, color: "bg-rose-500", text: "text-rose-700" },
  ];

  return (
    <div className="space-y-9">
      <section aria-labelledby="upload-heading" className="space-y-7">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Course operations</p>
          <h2 id="upload-heading" className="mt-1 text-xl font-semibold text-slate-900">Create a course</h2>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Create from a document</h3>
            <UploadForm />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">List it before materials are ready</h3>
            <form action={createComingSoonCourse} className="space-y-4 border border-slate-200 bg-white p-5">
              <label className="block text-sm font-medium text-slate-700">
                Course title
                <input name="title" required maxLength={200} className="mt-2 block w-full border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Description <span className="font-normal text-slate-500">(optional)</span>
                <textarea name="description" maxLength={1000} rows={3} className="mt-2 block w-full resize-y border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <p className="text-xs leading-5 text-slate-500">Students will see it in the course list as Coming soon until you add study materials.</p>
              <button type="submit" className="border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                Create coming-soon course
              </button>
            </form>
          </div>
        </div>
      </section>

      <section aria-label="Platform summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-600">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">{metric.value.toLocaleString()}</p>
            <p className={`mt-2 text-xs ${metric.tone === "green" ? "text-emerald-700" : metric.tone === "amber" ? "text-amber-700" : metric.tone === "blue" ? "text-blue-700" : "text-slate-500"}`}>
              {metric.note}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="managed-courses-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="managed-courses-heading" className="text-lg font-semibold text-slate-900">Courses you manage</h2>
            <p className="mt-1 text-sm text-slate-500">Edit course content, review student activity, or open a course.</p>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-slate-500">{managedCourses.length} recent</span>
        </div>
        {managedCourses.length ? (
          <div className="overflow-x-auto border-y border-slate-200 bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Course</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {managedCourses.map((course) => (
                  <tr key={String(course._id)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{course.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{course.chapterCount} chapters</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{course.status}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{dateLabel(course.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 whitespace-nowrap text-xs font-medium">
                        <Link href={`/courses/${course._id}`} className="text-blue-700 hover:text-blue-900">Open</Link>
                        {(course.status === "comingSoon" || course.status === "failed") && (
                          <Link href={`/admin/courses/${course._id}`} className="text-blue-700 hover:text-blue-900">Add materials</Link>
                        )}
                        {course.status === "ready" && (
                          <Link href={`/courses/${course._id}/edit`} className="text-blue-700 hover:text-blue-900">Edit</Link>
                        )}
                        <Link href={`/courses/${course._id}/students`} className="text-blue-700 hover:text-blue-900">Students</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No courses yet. Upload a document above to get started.</p>
        )}
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.35fr_0.85fr]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent signups</h2>
              <p className="mt-1 text-sm text-slate-500">The newest accounts on your platform.</p>
            </div>
            <Link href="/admin/users" className="shrink-0 text-sm font-medium text-blue-700 hover:text-blue-900">
              View all users <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
          {recentUsers.length ? (
            <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
              {recentUsers.map((user) => (
                <li key={String(user._id)} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center bg-blue-50 text-sm font-semibold text-blue-800">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-medium ${user.role === "admin" ? "text-blue-700" : "text-slate-500"}`}>{user.role}</p>
                    <p className="mt-1 text-xs tabular-nums text-slate-500">{dateLabel(user.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No users have signed up yet.</p>
          )}
        </div>

        <div className="space-y-9">
          <section aria-labelledby="course-status-heading">
            <div className="mb-4">
              <h2 id="course-status-heading" className="text-lg font-semibold text-slate-900">Course builds</h2>
              <p className="mt-1 text-sm text-slate-500">Current generation status across all courses.</p>
            </div>
            <div className="space-y-4 border-y border-slate-200 bg-white px-4 py-5">
              <div aria-hidden="true" className="flex h-2 overflow-hidden bg-slate-100">
                {courseCount > 0 && statusRows.map((status) => (
                  <span key={status.label} className={status.color} style={{ width: `${(status.count / courseCount) * 100}%` }} />
                ))}
              </div>
              {statusRows.map((status) => (
                <div key={status.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5 text-slate-600">
                    <span aria-hidden="true" className={`h-2 w-2 ${status.color}`} />
                    {status.label}
                  </span>
                  <span className={`font-semibold tabular-nums ${status.text}`}>{status.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </section>
    </div>
  );
}
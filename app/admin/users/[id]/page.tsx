import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { updateCourseAccess } from "@/app/admin/users/actions";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction } from "@/lib/models/Course";
import { User } from "@/lib/models/User";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  restricted: "Course access restricted for this user.",
  restored: "Course access restored for this user.",
  missing: "The selected user or course could not be found.",
};

export default async function UserCourseAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const [user, courses, restrictions] = await Promise.all([
    User.findById(id).select("name email role").lean(),
    Course.find().sort({ title: 1 }).select("title status chapterCount").lean(),
    CourseRestriction.find({ userId: id }).select("courseId").lean(),
  ]);
  if (!user) notFound();

  const restrictedIds = new Set(restrictions.map((restriction) => String(restriction.courseId)));
  const notice = notices[(await searchParams).notice ?? ""];

  return (
    <section aria-labelledby="course-access-heading">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm font-medium text-blue-700 hover:text-blue-900">
          Back to users
        </Link>
        <h2 id="course-access-heading" className="mt-4 text-xl font-semibold text-slate-900">Course access</h2>
        <p className="mt-1 text-sm text-slate-600">
          {user.name} <span className="text-slate-400">({user.email})</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Restricting access prevents this user from opening or rejoining a course. Their existing study progress is retained.
        </p>
      </div>

      {notice && <p role="status" className="mb-5 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</p>}

      {courses.length === 0 ? (
        <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No courses have been created yet.</p>
      ) : (
        <div className="overflow-x-auto border-y border-slate-200 bg-white">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Course</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Access</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => {
                const courseId = String(course._id);
                const restricted = restrictedIds.has(courseId);
                return (
                  <tr key={courseId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{course.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{course.chapterCount} chapters</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{course.status}</td>
                    <td className="px-4 py-3">
                      <span className={restricted ? "font-medium text-rose-700" : "text-slate-600"}>
                        {restricted ? "Restricted" : "Allowed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={updateCourseAccess}>
                        <input type="hidden" name="userId" value={id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="mode" value={restricted ? "restore" : "restrict"} />
                        <button
                          type="submit"
                          className={`whitespace-nowrap border px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${restricted ? "border-blue-200 text-blue-800 hover:bg-blue-50" : "border-rose-200 text-rose-700 hover:bg-rose-50"}`}
                        >
                          {restricted ? "Restore access" : "Restrict access"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
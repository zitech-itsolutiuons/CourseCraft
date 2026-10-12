import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canCreateCourses } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import { connectDB } from "@/lib/db";
import { joinByCode } from "@/lib/courseOps";
import { Course, CourseRestriction, StudentProgress } from "@/lib/models/Course";
import { ensureStudentProfile, hasRequiredStudentDetails, studentProfilePath } from "@/lib/studentProfile";
import PendingSubmitButton from "@/components/ui/PendingSubmitButton";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/signin?callbackUrl=${encodeURIComponent(`/join/${code}`)}`);
  const user = session.user;
  if (!(await canCreateCourses(user.id))) {
    const profile = await ensureStudentProfile(user.id, user.name ?? "Student");
    if (!hasRequiredStudentDetails(profile)) redirect(studentProfilePath(`/join/${code}`));
  }

  await connectDB();
  const course = await Course.findOne({ shareCode: code, sharingEnabled: true, status: "ready", archivedAt: null }).lean();

  if (!course) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-5 py-16">
          <h1 className="text-2xl font-semibold">This invitation is not valid</h1>
          <p className="mt-3 text-sm text-zinc-500">The link may have been replaced or switched off. Ask your instructor for a new one.</p>
          <Link href="/courses" className="mt-6 inline-block text-sm underline underline-offset-4">
            Go to your courses
          </Link>
        </main>
      </>
    );
  }

  if (await CourseRestriction.exists({ userId: user.id, courseId: course._id })) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-md px-5 py-16">
          <h1 className="text-2xl font-semibold">Course access restricted</h1>
          <p className="mt-3 text-sm text-zinc-500">You can’t join this course. Contact an administrator if you think this is a mistake.</p>
          <Link href="/courses" className="mt-6 inline-block text-sm underline underline-offset-4">
            Go to your courses
          </Link>
        </main>
      </>
    );
  }

  // The owner, or someone who already joined, goes straight to the course.
  if (course.ownerId === user.id || (await StudentProgress.exists({ userId: user.id, courseId: course._id })))
    redirect(`/courses/${course._id}`);

  async function join() {
    "use server";
    const s = await auth();
    if (!s?.user) redirect("/signin");
    if (!(await canCreateCourses(s.user.id))) {
      const profile = await ensureStudentProfile(s.user.id, s.user.name ?? "Student");
      if (!hasRequiredStudentDetails(profile)) redirect(studentProfilePath(`/join/${code}`));
    }
    const joined = await joinByCode(code, { id: s.user.id, name: s.user.name, email: s.user.email });
    redirect(joined ? `/courses/${joined._id}` : `/join/${code}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
        {course.description && <p className="mt-3 font-serif text-sm text-zinc-500">{course.description}</p>}
        <p className="mt-4 text-sm">{course.chapterCount} chapters, each with lecture notes, a quiz and a study assistant.</p>
        <p className="mt-4 border-0 border-l border-blue-200 pl-3 text-sm">
          The instructor will see your name and email, which chapters you finish, your quiz scores and how often you use the assistant.
        </p>
        <form action={join} className="mt-8">
          <PendingSubmitButton
            pendingLabel="Joining..."
            className="border border-blue-600 bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Join course
          </PendingSubmitButton>
        </form>
      </main>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ProfileForm from "@/components/ProfileForm";
import { auth } from "@/auth";
import { canCreateCourses } from "@/lib/auth";
import { ensureStudentProfile, hasRequiredStudentDetails } from "@/lib/studentProfile";
import { safePath } from "@/lib/safePath";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ onboarding?: string; callbackUrl?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=%2Fprofile");

  const params = await searchParams;
  const profile = await ensureStudentProfile(session.user.id, session.user.name ?? "Student");
  const displayName = profile.displayName || session.user.name || "Student";
  const requiredDetailsMissing = !(await canCreateCourses(session.user.id)) && !hasRequiredStudentDetails(profile);
  const onboardingRequired = params.onboarding === "required" || requiredDetailsMissing;
  const callbackUrl = safePath(params.callbackUrl);

  if (params.onboarding === "required" && !requiredDetailsMissing) redirect(callbackUrl);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          {!onboardingRequired && <Link href="/courses" className="text-sm font-medium text-blue-700 hover:text-blue-900">Back to your courses</Link>}
          <h1 className={`${onboardingRequired ? "" : "mt-5"} text-2xl font-semibold tracking-tight text-slate-950`}>
            {onboardingRequired ? "Complete your student profile" : "Your profile"}
          </h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600">
            {onboardingRequired
              ? "Add your department and level to finish setting up your account. These details help organize students into the right groups."
              : "Manage the details attached to your account and course activity."}
          </p>
        </div>
        <div className="max-w-4xl">
          <ProfileForm
            displayName={displayName}
            email={session.user.email ?? ""}
            studentId={profile.studentId}
            department={profile.department || profile.program || ""}
            level={profile.level ?? ""}
            bio={profile.bio ?? ""}
            avatarData={profile.avatarData ?? ""}
            redirectAfterSave={onboardingRequired ? callbackUrl : undefined}
          />
        </div>
      </main>
    </>
  );
}
import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ProfileForm from "@/components/ProfileForm";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=%2Fprofile");

  await connectDB();
  const profile = await UserProfile.findOne({ userId: session.user.id }).lean();
  const displayName = profile?.displayName || session.user.name || "Student";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <div className="mb-8 border-b border-slate-200 pb-6">
          <Link href="/courses" className="text-sm font-medium text-blue-700 hover:text-blue-900">Back to your courses</Link>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Your profile</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600">Manage the details attached to your account and course activity.</p>
        </div>
        <div className="max-w-4xl">
          <ProfileForm
            displayName={displayName}
            email={session.user.email ?? ""}
            studentId={profile?.studentId ?? ""}
            program={profile?.program ?? ""}
            level={profile?.level ?? ""}
            bio={profile?.bio ?? ""}
            avatarData={profile?.avatarData ?? ""}
          />
        </div>
      </main>
    </>
  );
}
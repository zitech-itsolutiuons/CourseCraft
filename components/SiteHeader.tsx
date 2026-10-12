import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { Announcement } from "@/lib/models/Announcement";
import { AnnouncementRead } from "@/lib/models/AnnouncementRead";
import SessionActivityTracker from "@/components/SessionActivityTracker";
import ThemeControl from "@/components/ThemeControl";
import PendingSubmitButton from "@/components/ui/PendingSubmitButton";

export default async function SiteHeader() {
  const session = await auth();
  const admin = session?.user?.id ? await isAdmin(session.user.id) : false;
  let displayName = session?.user?.name ?? session?.user?.email ?? "";
  let unreadAnnouncements = 0;
  if (session?.user?.id) {
    await connectDB();
    const [profile, lastRead] = await Promise.all([
      UserProfile.findOne({ userId: session.user.id }).select("displayName").lean(),
      AnnouncementRead.findOne({ userId: session.user.id }).select("readAt").lean(),
    ]);
    displayName = profile?.displayName || displayName;
    unreadAnnouncements = await Announcement.countDocuments(
      lastRead ? { createdAt: { $gt: lastRead.readAt } } : {}
    );
  }

  async function signOutCurrentUser() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <>
    {session?.user && <SessionActivityTracker isAdmin={admin} />}
    <header className="dashboard-header sticky top-0 z-50 h-14 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="flex h-full w-full items-center justify-between px-5 md:px-10">
        <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-slate-900">
          <span className="text-blue-700">CYB</span> 200lvl
        </Link>
        <nav aria-label="Main navigation" className="flex items-center text-sm">
          <div className="hidden items-center gap-5 sm:flex">
            <ThemeControl />
            {session?.user ? (
              <>
              <Link href="/profile" className="dashboard-secondary-link text-slate-600 transition-colors hover:text-blue-700">
                Profile
              </Link>
              <Link href="/courses" className="dashboard-secondary-link text-slate-600 transition-colors hover:text-blue-700">
                Your courses
              </Link>
              <Link
                href="/announcements"
                aria-label={`Announcements${unreadAnnouncements ? `, ${unreadAnnouncements} unread` : ""}`}
                className="dashboard-secondary-link inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-blue-700"
              >
                Announcements
                {unreadAnnouncements > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadAnnouncements > 9 ? "9+" : unreadAnnouncements}
                  </span>
                )}
              </Link>
              {admin && (
                <Link href="/admin" className="dashboard-secondary-link text-slate-600 transition-colors hover:text-blue-700">
                  Admin
                </Link>
              )}
              <span className="hidden max-w-[16ch] truncate text-slate-500 sm:inline">
                {displayName}
              </span>
              <form action={signOutCurrentUser}>
                <PendingSubmitButton pendingLabel="Signing out..." className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-blue-800 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                  Sign out
                </PendingSubmitButton>
              </form>
              </>
            ) : (
              <Link href="/signin" className="rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100 hover:shadow-sm">
                Sign in
              </Link>
            )}
          </div>
          <details className="relative sm:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Menu
            </summary>
            <div className="absolute right-0 top-full z-[60] mt-2 grid w-56 gap-1 border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {session?.user ? (
                <>
                  <Link href="/profile" className="dashboard-secondary-link px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Profile</Link>
                  <Link href="/courses" className="dashboard-secondary-link px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Your courses</Link>
                  <Link href="/announcements" className="dashboard-secondary-link flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                    Announcements
                    {unreadAnnouncements > 0 && <span className="ml-3 grid h-5 min-w-5 place-items-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold leading-none text-white">{unreadAnnouncements > 9 ? "9+" : unreadAnnouncements}</span>}
                  </Link>
                  {admin && <Link href="/admin" className="dashboard-secondary-link px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Admin</Link>}
                  <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700"><ThemeControl /></div>
                  <form action={signOutCurrentUser}>
                    <PendingSubmitButton pendingLabel="Signing out..." align="start" className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Sign out</PendingSubmitButton>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/signin" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Sign in</Link>
                  <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700"><ThemeControl /></div>
                </>
              )}
            </div>
          </details>
        </nav>
      </div>
    </header>
    </>
  );
}

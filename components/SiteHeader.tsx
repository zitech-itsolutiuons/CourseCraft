import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import SessionActivityTracker from "@/components/SessionActivityTracker";
import ThemeControl from "@/components/ThemeControl";

export default async function SiteHeader() {
  const session = await auth();
  const admin = session?.user?.id ? await isAdmin(session.user.id) : false;
  let displayName = session?.user?.name ?? session?.user?.email ?? "";
  if (session?.user?.id) {
    await connectDB();
    const profile = await UserProfile.findOne({ userId: session.user.id }).select("displayName").lean();
    displayName = profile?.displayName || displayName;
  }

  async function signOutCurrentUser() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <>
    {session?.user && <SessionActivityTracker isAdmin={admin} />}
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-10">
        <Link href="/" className="text-lg font-semibold tracking-[-0.04em] text-slate-900">
          <span className="text-blue-700">CYB</span> 200lvl
        </Link>
        <nav aria-label="Main navigation" className="flex items-center text-sm">
          <div className="hidden items-center gap-5 sm:flex">
            <ThemeControl />
            {session?.user ? (
              <>
              <Link href="/profile" className="text-slate-600 transition-colors hover:text-blue-700">
                Profile
              </Link>
              <Link href="/courses" className="text-slate-600 transition-colors hover:text-blue-700">
                Your courses
              </Link>
              {admin && (
                <Link href="/admin" className="text-slate-600 transition-colors hover:text-blue-700">
                  Admin
                </Link>
              )}
              <span className="hidden max-w-[16ch] truncate text-slate-500 sm:inline">
                {displayName}
              </span>
              <form action={signOutCurrentUser}>
                <button type="submit" className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-blue-800 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                  Sign out
                </button>
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
                  <Link href="/profile" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Profile</Link>
                  <Link href="/courses" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Your courses</Link>
                  {admin && <Link href="/admin" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Admin</Link>}
                  <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-700"><ThemeControl /></div>
                  <form action={signOutCurrentUser}>
                    <button type="submit" className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Sign out</button>
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

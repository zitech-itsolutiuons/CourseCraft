import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import UserDashboardLayout from "@/components/UserDashboardLayout";
import { markAnnouncementsRead } from "@/lib/announcements";
import { connectDB } from "@/lib/db";
import { Announcement } from "@/lib/models/Announcement";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=%2Fannouncements");

  await connectDB();
  const readAt = new Date();
  const announcements = await Announcement.find({ createdAt: { $lte: readAt } }).sort({ createdAt: -1 }).lean();
  await markAnnouncementsRead(session.user.id, readAt);

  return (
    <>
      <SiteHeader />
      <UserDashboardLayout>
        <main className="mx-auto max-w-4xl px-5 pt-5 pb-10 md:px-10 md:pt-6">
          <header className="border-b border-slate-200 pb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Announcements</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600">Updates and notices from the Course Craft team.</p>
          </header>
          {announcements.length === 0 ? (
            <p className="border-b border-slate-200 py-10 text-sm text-slate-500">There are no announcements yet. New updates will appear here.</p>
          ) : (
            <ol className="divide-y divide-slate-200">
              {announcements.map((announcement) => (
                <li key={String(announcement._id)} className="py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">{announcement.title}</h2>
                    <time dateTime={announcement.createdAt.toISOString()} className="text-xs tabular-nums text-slate-500">
                      {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(announcement.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{announcement.message}</p>
                </li>
              ))}
            </ol>
          )}
        </main>
      </UserDashboardLayout>
    </>
  );
}

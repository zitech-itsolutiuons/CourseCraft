import { connectDB } from "@/lib/db";
import { Announcement } from "@/lib/models/Announcement";
import { createAnnouncement } from "./actions";
import PendingSubmitButton from "@/components/ui/PendingSubmitButton";

export const dynamic = "force-dynamic";

const notices: Record<string, { text: string; tone: string }> = {
  sent: { text: "Announcement sent to all users.", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  invalid: { text: "Add a title and message within the length limits, then try again.", tone: "border-rose-200 bg-rose-50 text-rose-800" },
};

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connectDB();
  const [announcements, params] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }).limit(30).lean(),
    searchParams,
  ]);
  const notice = notices[params.notice ?? ""];

  return (
    <section aria-labelledby="announcements-heading" className="space-y-9">
      <div>
        <h2 id="announcements-heading" className="text-xl font-semibold text-slate-950">Announcements</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Send a message to everyone on Course Craft. New announcements appear in users’ announcement feed with an unread count.
        </p>
      </div>

      {notice && <p role="status" className={`border px-4 py-3 text-sm ${notice.tone}`}>{notice.text}</p>}

      <form action={createAnnouncement} className="max-w-3xl space-y-4 border-y border-slate-200 py-6">
        <h3 className="text-base font-semibold text-slate-900">Write an announcement</h3>
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            name="title"
            required
            maxLength={120}
            className="mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Message
          <textarea
            name="message"
            required
            maxLength={2000}
            rows={5}
            className="mt-2 block w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Up to 2,000 characters. Plain text is shown to all users.</span>
        </label>
        <PendingSubmitButton
          pendingLabel="Sending..."
          className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Send to all users
        </PendingSubmitButton>
      </form>

      <section aria-labelledby="recent-announcements-heading">
        <h3 id="recent-announcements-heading" className="mb-3 text-base font-semibold text-slate-900">Recently sent</h3>
        {announcements.length === 0 ? (
          <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No announcements have been sent yet.</p>
        ) : (
          <ol className="divide-y divide-slate-200 border-y border-slate-200">
            {announcements.map((announcement) => (
              <li key={String(announcement._id)} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                  <h4 className="font-medium text-slate-900">{announcement.title}</h4>
                  <time dateTime={announcement.createdAt.toISOString()} className="text-xs tabular-nums text-slate-500">
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(announcement.createdAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

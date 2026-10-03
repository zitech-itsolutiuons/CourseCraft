import StudentQuizLimitForm from "@/components/admin/StudentQuizLimitForm";
import { connectDB } from "@/lib/db";
import { PlatformSettings } from "@/lib/models/PlatformSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await connectDB();
  const settings = await PlatformSettings.findOne({ key: "platform" }).select("studentQuizQuestionLimit").lean();

  return (
    <section aria-labelledby="settings-heading" className="max-w-3xl space-y-5">
      <header>
        <h2 id="settings-heading" className="text-xl font-semibold text-slate-900">Platform settings</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Set how many questions students receive from each chapter’s quiz bank.</p>
      </header>
      <StudentQuizLimitForm limit={settings?.studentQuizQuestionLimit ?? 15} />
    </section>
  );
}
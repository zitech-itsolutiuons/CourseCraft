import StudentQuizLimitForm from "@/components/admin/StudentQuizLimitForm";
import ReconstructionPriceForm from "@/components/admin/ReconstructionPriceForm";
import CourseSummarizationForm from "@/components/admin/CourseSummarizationForm";
import { connectDB } from "@/lib/db";
import { PlatformSettings } from "@/lib/models/PlatformSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await connectDB();
  const settings = await PlatformSettings.findOne({ key: "platform" })
    .select("studentQuizQuestionLimit reconstructionPriceNgn courseSummarizationEnabled")
    .lean();

  return (
    <section aria-labelledby="settings-heading" className="max-w-3xl space-y-10">
      <header>
        <h2 id="settings-heading" className="text-xl font-semibold text-slate-900">Platform settings</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Manage student learning and paid feature settings.</p>
      </header>
      <section aria-labelledby="quiz-settings-heading" className="space-y-2">
        <h3 id="quiz-settings-heading" className="text-lg font-semibold text-slate-900">Chapter quizzes</h3>
        <StudentQuizLimitForm limit={settings?.studentQuizQuestionLimit ?? 15} />
      </section>
      <section aria-labelledby="reconstruction-settings-heading" className="space-y-2">
        <h3 id="reconstruction-settings-heading" className="text-lg font-semibold text-slate-900">AI course reconstruction</h3>
        <ReconstructionPriceForm priceNgn={settings?.reconstructionPriceNgn ?? 0} />
      </section>
      <section aria-labelledby="course-summary-settings-heading" className="space-y-2">
        <h3 id="course-summary-settings-heading" className="text-lg font-semibold text-slate-900">Course summaries</h3>
        <CourseSummarizationForm enabled={settings?.courseSummarizationEnabled ?? false} />
      </section>
    </section>
  );
}
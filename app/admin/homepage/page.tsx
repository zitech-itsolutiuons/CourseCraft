import { connectDB } from "@/lib/db";
import { defaultHomepageContent, HomepageContent } from "@/lib/models/HomepageContent";
import { saveHomepageContent } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const fieldClass = "mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";

const notices: Record<string, string> = {
  saved: "Homepage changes saved.",
  invalid: "Check that every field is filled in and within its character limit.",
};

function TextField({ name, label, value, maxLength }: { name: string; label: string; value: string; maxLength: number }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input name={name} required maxLength={maxLength} defaultValue={value} className={fieldClass} />
    </label>
  );
}

function TextArea({ name, label, value, maxLength, rows = 3 }: { name: string; label: string; value: string; maxLength: number; rows?: number }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea name={name} required maxLength={maxLength} rows={rows} defaultValue={value} className={`${fieldClass} resize-y`} />
    </label>
  );
}

export default async function AdminHomepagePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connectDB();
  const savedContent = await HomepageContent.findOne({ key: "home" }).lean();
  const content = savedContent ? { ...defaultHomepageContent, ...savedContent } : defaultHomepageContent;
  const notice = notices[(await searchParams).notice ?? ""];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Home page content</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Update the words shown on the public home page. Changes appear as soon as you save.
        </p>
      </div>

      {notice && (
        <p role="status" className={`border px-4 py-3 text-sm ${notice.startsWith("Homepage") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {notice}
        </p>
      )}

      <form action={saveHomepageContent} className="space-y-9">
        <section className="grid gap-5 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Hero</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The main message and actions visitors see first.</p>
          </div>
          <div className="grid gap-4">
            <TextField name="heroTitle" label="Heading" value={content.heroTitle} maxLength={120} />
            <TextArea name="heroDescription" label="Description" value={content.heroDescription} maxLength={1000} rows={4} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="institution" label="Institution" value={content.institution} maxLength={80} />
              <TextField name="program" label="Program" value={content.program} maxLength={100} />
              <TextField name="level" label="Level" value={content.level} maxLength={40} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="primaryCta" label="Primary button label" value={content.primaryCta} maxLength={60} />
              <TextField name="secondaryCta" label="Secondary button label" value={content.secondaryCta} maxLength={60} />
            </div>
            <TextField name="heroFootnote" label="Short note below the buttons" value={content.heroFootnote} maxLength={200} />
          </div>
        </section>

        <section className="grid gap-5 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Study outline</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The example panel beside the hero message.</p>
          </div>
          <div className="grid gap-4">
            <TextField name="outlineEyebrow" label="Small label" value={content.outlineEyebrow} maxLength={80} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="outlineTitle" label="Panel title" value={content.outlineTitle} maxLength={120} />
              <TextField name="outlineLevel" label="Level badge" value={content.outlineLevel} maxLength={40} />
            </div>
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium text-slate-700">Outline topics</legend>
              {content.topics.map((topic, index) => (
                <TextField key={index} name="topics" label={`Topic ${index + 1}`} value={topic} maxLength={140} />
              ))}
            </fieldset>
            <TextField name="outlineNote" label="Note below the topics" value={content.outlineNote} maxLength={240} />
          </div>
        </section>

        <section className="grid gap-5 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">How it works</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The heading and three steps shown below the hero.</p>
          </div>
          <div className="grid gap-4">
            <TextField name="workflowTitle" label="Section heading" value={content.workflowTitle} maxLength={140} />
            {content.workflowSteps.map((step, index) => (
              <fieldset key={index} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                <legend className="text-xs font-semibold uppercase text-slate-500">Step {index + 1}</legend>
                <TextField name={`stepTitle${index}`} label="Title" value={step.title} maxLength={100} />
                <TextArea name={`stepDetail${index}`} label="Description" value={step.detail} maxLength={300} />
              </fieldset>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-4">
          <a href="/" target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:text-blue-900">
            Preview home page
          </a>
          <button type="submit" className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Save home page
          </button>
        </div>
      </form>
    </div>
  );
}
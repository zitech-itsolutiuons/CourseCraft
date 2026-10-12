"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type CourseOption = { id: string; title: string; description: string; chapterCount: number };
type Props = {
  courses: CourseOption[];
  entitled: boolean;
  grantType: "admin" | "payment" | null;
  priceNgn: number;
  paymentConfigured: boolean;
  usage: { used: number; remaining: number };
  activeJobId: string | null;
  paymentNotice?: string;
};

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function ReconstructionWorkspace(props: Props) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(props.courses[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [jobId, setJobId] = useState<string | null>(props.activeJobId);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(props.usage);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(`/api/reconstructions/${jobId}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not check reconstruction status.");
        if (cancelled) return;
        if (result.status === "completed" && result.courseId) {
          router.push(`/courses/${result.courseId}`);
          return;
        }
        if (result.status === "failed") {
          setError(result.error || "Reconstruction failed. Please try again.");
          setJobId(null);
          const stateResponse = await fetch("/api/reconstructions", { cache: "no-store" });
          const state = await stateResponse.json();
          if (stateResponse.ok && !cancelled) setUsage(state.usage);
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Could not check reconstruction status.");
          timer = setTimeout(poll, 4000);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, router]);

  async function startReconstruction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/reconstructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, prompt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start reconstruction.");
      setUsage((current) => ({ used: current.used + 1, remaining: result.remaining }));
      setJobId(result.jobId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not start reconstruction.");
    } finally {
      setSubmitting(false);
    }
  }

  async function buyAccess() {
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/payments/paystack/initialize", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start payment.");
      window.location.assign(result.authorizationUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Could not start payment.");
      setPaying(false);
    }
  }

  const isBusy = submitting || Boolean(jobId);
  const selectedCourse = props.courses.find((course) => course.id === courseId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl border-b border-slate-200 pb-7 dark:border-slate-800">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Reconstruct a course your way</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Shape the lessons, examples, and depth around how you learn. The original course stays untouched; your version is private to you.
        </p>
      </header>

      {props.paymentNotice === "success" && (
        <p role="status" className="mt-6 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Payment confirmed. Your access details are up to date.
        </p>
      )}
      {props.paymentNotice === "failed" && (
        <p role="alert" className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Payment was not confirmed. You can try again when you’re ready.
        </p>
      )}
      {props.paymentNotice === "pending" && (
        <p role="status" className="mt-6 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          We’re still checking your payment. Refresh this page in a moment; access is only enabled after Paystack confirms it.
        </p>
      )}

      {!props.entitled ? (
        <section aria-labelledby="access-heading" className="mt-8 max-w-3xl border-y border-slate-200 py-6 dark:border-slate-800">
          <h2 id="access-heading" className="text-xl font-semibold text-slate-900 dark:text-white">Unlock reconstruction access</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Pay once to start up to three personalized course versions each week. Each started run uses one slot, and your allowance resets every Monday in Nigeria time.
          </p>
          {props.priceNgn > 0 && (
            <p className="mt-5 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">
              {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(props.priceNgn)}
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">one-time payment</span>
            </p>
          )}
          {props.priceNgn <= 0 && (
            <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">Checkout will be available when an administrator sets the access price.</p>
          )}
          <button
            type="button"
            onClick={buyAccess}
            disabled={paying || !props.paymentConfigured || props.priceNgn <= 0}
            className={`mt-5 inline-flex min-h-12 items-center justify-center gap-2 border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}
          >
            {paying && <LoadingSpinner />}
            {paying ? "Opening secure checkout…" : props.paymentConfigured ? "Buy access with Paystack" : "Payments are being set up"}
          </button>
          {!props.paymentConfigured && props.priceNgn > 0 && (
            <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">Payments are not configured yet. Please contact an administrator.</p>
          )}
        </section>
      ) : (
        <section aria-labelledby="workspace-heading" className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 id="workspace-heading" className="text-xl font-semibold text-slate-900 dark:text-white">Make your version</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {usage.remaining} of 3 reconstructions left this week
                {props.grantType === "admin" ? " · access granted by an administrator" : ""}
              </p>
            </div>
            <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{usage.used}/3 used</span>
          </div>
          <form onSubmit={startReconstruction} className="space-y-5 pt-5">
            <label htmlFor="source-course" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              Course to reconstruct
              <select
                id="source-course"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                required
                disabled={isBusy || props.courses.length === 0}
                className={`mt-2 block min-h-12 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${focus}`}
              >
                {props.courses.length === 0 && <option value="">No available courses</option>}
                {props.courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title} · {course.chapterCount} chapters</option>
                ))}
              </select>
              {selectedCourse?.description && <span className="mt-2 block text-sm font-normal leading-6 text-slate-600 dark:text-slate-400">{selectedCourse.description}</span>}
            </label>

            <label htmlFor="reconstruction-prompt" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              How should it be tailored?
              <textarea
                id="reconstruction-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                minLength={10}
                maxLength={1200}
                required
                disabled={isBusy}
                rows={5}
                placeholder="For example: Explain concepts in plain language, add practical examples from small businesses, and include more step-by-step exercises."
                className={`mt-2 block w-full resize-y border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400 ${focus}`}
              />
              <span className="mt-1 block text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{prompt.length}/1200</span>
            </label>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Your preference guides presentation, examples, and depth. The course’s subject and learning goals stay the same.
            </p>

            {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}

            {jobId ? (
              <div role="status" aria-live="polite" className="flex items-center gap-3 border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <LoadingSpinner />
                <span>Rewriting chapters and assessments for {selectedCourse?.title ?? "your course"}. You can keep this page open while we work.</span>
              </div>
            ) : (
              <button
                type="submit"
                disabled={submitting || usage.remaining === 0 || props.courses.length === 0}
                className={`inline-flex min-h-12 items-center justify-center gap-2 border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}
              >
                {submitting && <LoadingSpinner />}
                {submitting ? "Starting reconstruction…" : "Reconstruct course"}
              </button>
            )}
            {usage.remaining === 0 && <p className="text-sm text-amber-800 dark:text-amber-300">You’ve reached this week’s limit. Come back after Monday’s reset in Nigeria time.</p>}
            {props.courses.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Join or create a ready course before starting a reconstruction.</p>}
          </form>
        </section>
      )}

      {error && !props.entitled && <p role="alert" className="mt-5 max-w-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    </main>
  );
}

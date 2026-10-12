"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function CourseSummary({ courseId, enabled }: { courseId: string; enabled: boolean }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const noticeDialogRef = useRef<HTMLDialogElement>(null);

  async function summarizeCourse() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/${courseId}/summary`, { method: "POST" });
      const data: { summary?: string; error?: string } = await response.json();
      if (!response.ok || !data.summary) {
        setError(data.error || "The course summary could not be generated. Please try again.");
        return;
      }
      setSummary(data.summary);
    } catch {
      setError("The summary service could not complete this request. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function handleSummarizeClick() {
    if (!enabled) {
      noticeDialogRef.current?.showModal();
      return;
    }
    void summarizeCourse();
  }

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={handleSummarizeClick}
        disabled={loading}
        aria-busy={loading}
        className="inline-flex min-h-11 w-full items-center justify-center border border-slate-300 bg-white px-5 text-sm font-semibold text-blue-900 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-blue-100 dark:hover:bg-slate-800"
      >
        {loading && <LoadingSpinner />}
        {loading ? "Summarizing..." : summary ? "Refresh summary" : "Summarize course"}
      </button>
      <dialog
        ref={noticeDialogRef}
        aria-labelledby="summary-unavailable-title"
        aria-describedby="summary-unavailable-description"
        onClick={(event) => {
          if (event.target === noticeDialogRef.current) noticeDialogRef.current.close();
        }}
        className="fixed inset-0 m-auto w-[min(440px,calc(100%-2rem))] max-w-none border border-slate-300 bg-white p-0 text-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop:bg-black/45 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <section className="p-6">
          <h2 id="summary-unavailable-title" className="text-lg font-semibold">
            Course summaries unavailable
          </h2>
          <p id="summary-unavailable-description" className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            An admin has not activated this feature yet.
          </p>
          <button
            type="button"
            onClick={() => noticeDialogRef.current?.close()}
            className="mt-6 inline-flex min-h-10 items-center justify-center border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </section>
      </dialog>
      {error && <p role="alert" className="mt-3 max-w-md text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {summary && (
        <section aria-labelledby="generated-summary-heading" aria-live="polite" className="mt-5 w-full max-w-3xl border-y border-blue-200 bg-blue-50/70 px-4 py-4 text-left dark:border-blue-900 dark:bg-blue-950/40">
          <h2 id="generated-summary-heading" className="text-base font-semibold text-slate-950 dark:text-white">Course summary</h2>
          <div className="prose prose-sm mt-3 max-w-none break-words dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}

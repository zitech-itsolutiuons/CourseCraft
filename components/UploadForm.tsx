"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function UploadForm({ courseId }: { courseId?: string } = {}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    if (courseId) body.append("courseId", courseId);
    try {
      const res = await fetch("/api/courses", { method: "POST", body });
      if (res.status === 401) return router.push("/signin");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed. Try again.");
      router.push(courseId ? `/admin/courses/${courseId}` : `/courses/${data.courseId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="min-w-0 border border-blue-200 bg-blue-50/30 p-4 sm:p-5">
      <label htmlFor="file" className="block text-sm font-medium text-blue-700">
        Document (PDF, DOCX, TXT or Markdown, up to 15 MB)
      </label>
      <input
        id="file"
        type="file"
        accept=".pdf,.docx,.txt,.md"
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className={`mt-3 block min-h-11 w-full min-w-0 border border-blue-200 bg-white p-2 text-sm file:mr-3 file:border file:border-blue-200 file:bg-transparent file:px-3 file:py-1 file:text-sm ${focus}`}
      />
      <button
        type="submit"
        disabled={!file || busy}
        className={`mt-4 border border-blue-600 bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-30 hover:bg-blue-700 ${focus}`}
      >
        {busy ? "Uploading" : courseId ? "Add study materials" : "Create course"}
      </button>
      {busy && (
        <p role="status" className="mt-3 text-sm text-zinc-500">
          Uploading your document. The course builds in the background and you will see its progress next.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
          {error}
        </p>
      )}
    </form>
  );
}

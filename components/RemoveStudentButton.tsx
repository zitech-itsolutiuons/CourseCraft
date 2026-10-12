"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function RemoveStudentButton({ courseId, userId, label }: { courseId: string; userId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!confirm(`Remove ${label} from this course? Their access and progress will be deleted.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/${courseId}/students/${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not remove this student");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex items-center gap-2 border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-40"
      >
        {busy && <LoadingSpinner />}
        {busy ? "Removing..." : "Remove"}
      </button>
      {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
    </span>
  );
}

"use client";

import { useState } from "react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const btn =
  "border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function SharePanel({
  courseId,
  initialEnabled,
  initialCode,
  origin,
}: {
  courseId: string;
  initialEnabled: boolean;
  initialCode: string | null;
  origin: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState<"toggle" | "reset" | null>(null);
  const [copying, setCopying] = useState<"code" | "link" | null>(null);
  const [note, setNote] = useState("");

  async function update(body: { enabled?: boolean; reset?: boolean }) {
    setBusy(body.reset ? "reset" : "toggle");
    setNote("");
    try {
      const res = await fetch(`/api/courses/${courseId}/sharing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update sharing");
      setEnabled(data.sharingEnabled);
      setCode(data.shareCode);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const link = code ? `${origin}/join/${code}` : "";

  async function copy(value: string, kind: "code" | "link") {
    if (copying) return;
    setCopying(kind);
    setNote("");
    try {
      await navigator.clipboard.writeText(value);
      setNote(kind === "code" ? "Course code copied." : "Link copied.");
    } catch {
      setNote(`Could not copy the ${kind}. Select it and copy it manually.`);
    } finally {
      setCopying(null);
    }
  }

  return (
    <section aria-labelledby="share-heading" className="border border-blue-200 bg-blue-50/30 p-5">
      <h2 id="share-heading" className="text-lg font-semibold text-blue-700">
        Invite students
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Anyone with the link can join after signing in. You will see their name, email, progress and quiz scores.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" aria-pressed={enabled} disabled={busy !== null} aria-busy={busy === "toggle"} onClick={() => update({ enabled: !enabled })} className={`inline-flex items-center gap-2 ${btn}`}>
          {busy === "toggle" && <LoadingSpinner />}
          {busy === "toggle" ? enabled ? "Turning off link..." : "Turning on link..." : enabled ? "Link is on. Turn off" : "Turn on join link"}
        </button>
        {enabled && (
          <button
            type="button"
            disabled={busy !== null}
            aria-busy={busy === "reset"}
            onClick={() => confirm("The old link will stop working for new students. Create a new one?") && update({ reset: true })}
            className={`inline-flex items-center gap-2 ${btn}`}
          >
            {busy === "reset" && <LoadingSpinner />}
            {busy === "reset" ? "Creating link..." : "Create a new link"}
          </button>
        )}
      </div>

      {enabled && link && (
        <div className="mt-4 space-y-3">
          {code && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="course-share-code" className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                Course code
                <input
                  id="course-share-code"
                  readOnly
                  value={code}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-1 block min-h-10 w-full border border-blue-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                disabled={copying !== null}
                aria-busy={copying === "code"}
                className={`inline-flex items-center gap-2 self-end ${btn}`}
                onClick={() => copy(code, "code")}
              >
                {copying === "code" && <LoadingSpinner />}
                {copying === "code" ? "Copying..." : "Copy code"}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Join link"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={copying !== null}
              aria-busy={copying === "link"}
              className={`inline-flex items-center gap-2 ${btn}`}
              onClick={() => copy(link, "link")}
            >
              {copying === "link" && <LoadingSpinner />}
              {copying === "link" ? "Copying..." : "Copy link"}
            </button>
          </div>
        </div>
      )}
      {!enabled && <p className="mt-3 text-sm text-zinc-500">New students can't join. Students who already joined keep access.</p>}
      {note && (
        <p role="status" className="mt-3 text-sm">
          {note}
        </p>
      )}
    </section>
  );
}

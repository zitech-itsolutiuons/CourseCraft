"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CHAPTER_VIDEO_MARKER, resolveChapterVideo, splitChapterVideo } from "@/lib/chapterVideo";

export type Q = { question: string; options: string[]; correctIndex: number; explanation: string };
export type Ch = { id: string; title: string; contentMd: string; videoUrl: string; quiz: Q[] };
export type FinalAssessmentData = {
  objectiveQuestions: Q[];
  theoryQuestions: { question: string; sampleAnswer: string; gradingPoints: string[] }[];
};

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const line = "border border-blue-200";
const soft = "border border-blue-100 bg-blue-50/20";
const btn = `${line} px-3 py-1.5 text-sm hover:bg-blue-50 disabled:opacity-40 ${focus}`;
const solid = `border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-700 ${focus}`;
const field = `block w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`;

async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data as T;
}

export default function CourseEditor({
  courseId,
  initialTitle,
  initialDescription,
  initialChapters,
  initialFinalAssessment,
}: {
  courseId: string;
  initialTitle: string;
  initialDescription: string;
  initialChapters: Ch[];
  initialFinalAssessment?: FinalAssessmentData | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Ch[]>(initialChapters); // last saved state, in course order
  const [drafts, setDrafts] = useState<Record<string, Ch>>({}); // unsaved edits by chapter id
  const [sel, setSel] = useState(initialChapters[0].id);
  const [tab, setTab] = useState<"write" | "preview" | "quiz">("write");
  const [guidance, setGuidance] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [finalAssessment, setFinalAssessment] = useState(initialFinalAssessment ?? null);
  const lectureRef = useRef<HTMLTextAreaElement>(null);

  const savedCh = saved.find((c) => c.id === sel)!;
  const cur = drafts[sel] ?? savedCh;
  const isDirty = (id: string) => id in drafts && JSON.stringify(drafts[id]) !== JSON.stringify(saved.find((c) => c.id === id));
  const anyDirty = Object.keys(drafts).some(isDirty);

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const change = (patch: Partial<Ch>) => setDrafts((d) => ({ ...d, [sel]: { ...cur, ...patch } }));

  const insertVideoAtCursor = () => {
    const textarea = lectureRef.current;
    if (!textarea || !cur.videoUrl || !resolveChapterVideo(cur.videoUrl) || cur.contentMd.includes(CHAPTER_VIDEO_MARKER)) return;
    const start = textarea.selectionStart;
    const before = cur.contentMd.slice(0, start);
    const after = cur.contentMd.slice(start);
    const leadingSpace = before && !before.endsWith("\n\n") ? "\n\n" : "";
    const trailingSpace = after && !after.startsWith("\n\n") ? "\n\n" : "";
    const insertion = `${leadingSpace}${CHAPTER_VIDEO_MARKER}${trailingSpace}`;
    change({ contentMd: `${before}${insertion}${after}` });
    const cursor = start + insertion.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  async function run(name: string, fn: () => Promise<string | void>) {
    setBusy(name);
    setNote(null);
    try {
      const text = await fn();
      if (text) setNote({ ok: true, text });
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const saveChapter = () =>
    run("save", async () => {
      const d = drafts[sel];
      if (!d) return "Nothing to save.";
      if (d.title !== savedCh.title || d.contentMd !== savedCh.contentMd || d.videoUrl !== savedCh.videoUrl)
        await api(`/api/chapters/${sel}`, "PATCH", { title: d.title, contentMd: d.contentMd, videoUrl: d.videoUrl });
      if (JSON.stringify(d.quiz) !== JSON.stringify(savedCh.quiz)) await api(`/api/chapters/${sel}/quiz`, "PUT", { questions: d.quiz });
      setSaved((l) => l.map((c) => (c.id === sel ? d : c)));
      setDrafts(({ [sel]: _drop, ...rest }) => rest);
      return "Saved.";
    });

  const regenerate = (target: "lecture" | "quiz") =>
    run(target, async () => {
      const r = await api<{ contentMd?: string; questions?: Q[] }>(`/api/chapters/${sel}/regenerate`, "POST", {
        target,
        guidance: guidance || undefined,
        contentMd: target === "quiz" ? cur.contentMd : undefined,
      });
      if (r.contentMd) {
        change({ contentMd: r.contentMd });
        setTab("write");
      }
      if (r.questions) {
        change({ quiz: r.questions });
        setTab("quiz");
      }
      return "Generated. Review it, then choose Save changes. Nothing is saved until you do.";
    });

  const move = (i: number, dir: -1 | 1) =>
    run("move", async () => {
      const order = saved.map((c) => c.id);
      [order[i], order[i + dir]] = [order[i + dir], order[i]];
      await api(`/api/courses/${courseId}/chapters`, "PUT", { order });
      setSaved((l) => order.map((id) => l.find((c) => c.id === id)!));
    });

  const addChapter = () =>
    run("add", async () => {
      const ch = await api<Ch>(`/api/courses/${courseId}/chapters`, "POST", {});
      setSaved((l) => [...l, ch]);
      setSel(ch.id);
      setTab("write");
    });

  const removeChapter = (id: string) => {
    if (!confirm("Delete this chapter, its quiz and all student progress on it?")) return;
    run("delete", async () => {
      await api(`/api/chapters/${id}`, "DELETE");
      const rest = saved.filter((c) => c.id !== id);
      setSaved(rest);
      setDrafts(({ [id]: _drop, ...others }) => others);
      if (sel === id) setSel(rest[0].id);
    });
  };

  const saveDetails = () =>
    run("details", async () => {
      await api(`/api/courses/${courseId}`, "PATCH", { title, description });
      return "Course details saved.";
    });

  const deleteCourse = () => {
    if (!confirm("Delete this whole course, including every student's progress? This can't be undone.")) return;
    run("course", async () => {
      await api(`/api/courses/${courseId}`, "DELETE");
      router.push("/courses");
    });
  };

  const setQuiz = (quiz: Q[]) => change({ quiz });

  const generateFinalAssessment = () =>
    run("final-assessment", async () => {
      const assessment = await api<FinalAssessmentData>(`/api/courses/${courseId}/final-assessment`, "POST", {});
      setFinalAssessment(assessment);
      return "Course final assessment generated and saved.";
    });

  return (
    <div className="space-y-10">
      <div className="grid gap-8 md:grid-cols-[18rem_1fr]">
        <aside className="space-y-8">
          <section aria-labelledby="details-h" className="space-y-3">
            <h2 id="details-h" className="text-sm font-semibold">Course details</h2>
            <input aria-label="Course title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={field} />
            <textarea aria-label="Course description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className={field} />
            <button type="button" onClick={saveDetails} disabled={busy !== null} className={btn}>Save details</button>
          </section>

          <section aria-labelledby="chapters-h">
            <h2 id="chapters-h" className="mb-3 text-sm font-semibold">Chapters</h2>
            <ol className={`${line}`}>
              {saved.map((c, i) => (
                <li key={c.id} className="flex items-stretch border-0 border-b border-zinc-300 last:border-b-0 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setSel(c.id)}
                    aria-current={c.id === sel ? "true" : undefined}
                    className={`min-w-0 flex-1 px-3 py-2 text-left text-sm ${focus} ${c.id === sel ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                  >
                    <span className="block truncate">{i + 1}. {(drafts[c.id] ?? c).title || "Untitled"}</span>
                    {isDirty(c.id) && <span className="text-xs opacity-70">Unsaved changes</span>}
                  </button>
                  <div className="flex flex-col border-0 border-l border-zinc-300 dark:border-zinc-800">
                    <button type="button" disabled={i === 0 || busy !== null} onClick={() => move(i, -1)} aria-label={`Move chapter ${i + 1} up`} className="px-2 text-xs hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900">▲</button>
                    <button type="button" disabled={i === saved.length - 1 || busy !== null} onClick={() => move(i, 1)} aria-label={`Move chapter ${i + 1} down`} className="px-2 text-xs hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900">▼</button>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" onClick={addChapter} disabled={busy !== null} className={`${btn} mt-3`}>Add chapter</button>
          </section>
        </aside>

        <section aria-label="Chapter editor" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="ch-title" className="text-sm font-medium">Chapter title</label>
              <input id="ch-title" value={cur.title} onChange={(e) => change({ title: e.target.value })} maxLength={200} className={`${field} mt-1`} />
            </div>
            <button type="button" onClick={saveChapter} disabled={busy !== null || !isDirty(sel)} className={solid}>
              {busy === "save" ? "Saving" : "Save changes"}
            </button>
            <button type="button" onClick={() => removeChapter(sel)} disabled={busy !== null || saved.length <= 1} className={btn}>Delete chapter</button>
          </div>

          <section className={`${soft} space-y-4 p-4`} aria-labelledby="final-assessment-heading">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 id="final-assessment-heading" className="text-sm font-semibold">Course final assessment</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">A comprehensive exam drawn from every chapter, with objective questions and written theory prompts.</p>
                {finalAssessment && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    {finalAssessment.objectiveQuestions.length} objective questions · {finalAssessment.theoryQuestions.length} theory questions
                  </p>
                )}
              </div>
              <button type="button" onClick={generateFinalAssessment} disabled={busy !== null} className={`${btn} shrink-0`}>
                {busy === "final-assessment" ? "Generating assessment..." : finalAssessment ? "Regenerate final assessment" : "Generate final assessment"}
              </button>
            </div>
            {finalAssessment ? (
              <details className="border-t border-blue-100 pt-3">
                <summary className="w-fit cursor-pointer text-sm font-medium text-blue-800 hover:text-blue-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  Review assessment questions and answers
                </summary>
                <div className="mt-4 space-y-6 text-sm">
                  <section>
                    <h3 className="font-semibold">Objective questions</h3>
                    <ol className="mt-2 list-decimal space-y-4 pl-5">
                      {finalAssessment.objectiveQuestions.map((question, index) => (
                        <li key={index} className="pl-1">
                          <p className="font-medium">{question.question}</p>
                          <p className="mt-1 text-xs text-zinc-500">Correct answer: {question.options[question.correctIndex]}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-600">{question.explanation}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="border-t border-blue-100 pt-4">
                    <h3 className="font-semibold">Theory questions</h3>
                    <ol className="mt-2 list-decimal space-y-4 pl-5">
                      {finalAssessment.theoryQuestions.map((question, index) => (
                        <li key={index} className="pl-1">
                          <p className="font-medium">{question.question}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-600">Sample answer: {question.sampleAnswer}</p>
                          <ul className="mt-1 list-disc pl-4 text-xs leading-5 text-zinc-500">
                            {question.gradingPoints.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>
              </details>
            ) : (
              <p className="border-t border-blue-100 pt-3 text-xs text-zinc-500">No course final assessment has been generated yet.</p>
            )}
          </section>

          <section className={`${soft} space-y-3 p-4`} aria-labelledby="chapter-video-heading">
            <div>
              <h2 id="chapter-video-heading" className="text-sm font-semibold">Chapter video</h2>
              <p className="mt-1 text-xs text-zinc-500">Add a YouTube, Vimeo, or direct MP4/WebM/Ogg link. It will play above this chapter’s lesson.</p>
            </div>
            <label htmlFor="chapter-video-url" className="sr-only">Video URL</label>
            <input
              id="chapter-video-url"
              type="url"
              value={cur.videoUrl}
              onChange={(e) => change({ videoUrl: e.target.value })}
              maxLength={2000}
              placeholder="https://www.youtube.com/watch?v=..."
              className={field}
            />
            {cur.videoUrl && resolveChapterVideo(cur.videoUrl) && (
              <div className="aspect-video overflow-hidden border border-blue-200 bg-black">
                <ChapterVideo url={cur.videoUrl} title={cur.title} />
              </div>
            )}
            {cur.videoUrl && !resolveChapterVideo(cur.videoUrl) && (
              <p className="text-sm text-rose-700" role="status">Enter a supported YouTube, Vimeo, or direct video link.</p>
            )}
          </section>

          <div className={`${soft} space-y-3 p-4`}>
            <label htmlFor="guidance" className="text-sm font-medium">Regenerate with the model</label>
            <input id="guidance" value={guidance} onChange={(e) => setGuidance(e.target.value)} maxLength={300} placeholder="Optional guidance, e.g. more worked examples, simpler wording" className={field} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => regenerate("lecture")} disabled={busy !== null} className={btn}>{busy === "lecture" ? "Writing lecture" : "Regenerate lecture"}</button>
              <button type="button" onClick={() => regenerate("quiz")} disabled={busy !== null} className={btn}>{busy === "quiz" ? "Writing quiz" : "Regenerate quiz from this lecture"}</button>
            </div>
            <p className="text-xs text-zinc-500">The result appears here as an unsaved draft. Your saved version stays untouched until you save.</p>
          </div>

          {note && (
            <p role={note.ok ? "status" : "alert"} className="border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">{note.text}</p>
          )}

          <div role="tablist" aria-label="Chapter sections" className="flex">
            {(["write", "preview", "quiz"] as const).map((k, i) => {
              const label = k === "write" ? "Lecture" : k === "preview" ? "Preview" : `Quiz (${cur.quiz.length})`;
              return (
                <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`${line} px-4 py-1.5 text-sm ${i > 0 ? "-ml-px" : ""} ${focus} ${tab === k ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "write" && (
            <div>
              <label htmlFor="ch-md" className="sr-only">Lecture text (Markdown)</label>
              <textarea ref={lectureRef} id="ch-md" value={cur.contentMd} onChange={(e) => change({ contentMd: e.target.value })} rows={24} spellCheck className={`${field} font-mono leading-relaxed`} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">Markdown. Use ## for sections and **bold** for key terms.</p>
                <button
                  type="button"
                  onClick={insertVideoAtCursor}
                  disabled={!cur.videoUrl || !resolveChapterVideo(cur.videoUrl) || cur.contentMd.includes(CHAPTER_VIDEO_MARKER)}
                  className={btn}
                >
                  {cur.contentMd.includes(CHAPTER_VIDEO_MARKER) ? "Video inserted" : "Insert video at cursor"}
                </button>
              </div>
              {cur.videoUrl && cur.contentMd.includes(CHAPTER_VIDEO_MARKER) && (
                <p className="mt-1 text-xs text-zinc-500">The player will appear at the marker position in the lecture.</p>
              )}
            </div>
          )}
          {tab === "preview" && (
            <article className="prose prose-zinc max-w-[68ch] font-serif dark:prose-invert prose-headings:font-sans prose-code:before:content-none prose-code:after:content-none">
              <h1>{cur.title}</h1>
              {splitChapterVideo(cur.contentMd, cur.videoUrl).map((block) => block.kind === "video"
                ? <ChapterVideo key={block.key} url={cur.videoUrl} title={cur.title} />
                : <ReactMarkdown key={block.key} remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>)}
            </article>
          )}
          {tab === "quiz" && <QuizEditor quiz={cur.quiz} onChange={setQuiz} />}
        </section>
      </div>

      <section className={`${soft} p-5`}>
        <h2 className="text-sm font-semibold">Delete course</h2>
        <p className="mt-1 text-sm text-zinc-500">Removes the course, every chapter and quiz, and all student progress.</p>
        <button type="button" onClick={deleteCourse} disabled={busy !== null} className={`${btn} mt-3`}>Delete this course</button>
      </section>
    </div>
  );
}

function ChapterVideo({ url, title }: { url: string; title: string }) {
  const source = resolveChapterVideo(url);
  if (!source) return null;
  if (source.kind === "file") {
    return <video className="h-full w-full" controls preload="metadata" src={source.src} aria-label={`${title} video`} />;
  }
  return (
    <iframe
      className="h-full w-full"
      src={source.src}
      title={`${title} video preview`}
      loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

function QuizEditor({ quiz, onChange }: { quiz: Q[]; onChange: (q: Q[]) => void }) {
  const set = (i: number, patch: Partial<Q>) => onChange(quiz.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  return (
    <div className="space-y-6">
      {quiz.length === 0 && <p className="text-sm text-zinc-500">This chapter has no quiz. Add a question, or regenerate a quiz from the lecture.</p>}
      {quiz.map((q, i) => (
        <fieldset key={i} className={`${soft} space-y-3 p-4`}>
          <legend className="px-1 text-sm font-medium">Question {i + 1}</legend>
          <textarea aria-label={`Question ${i + 1}`} value={q.question} onChange={(e) => set(i, { question: e.target.value })} rows={2} className={field} />
          <p className="text-xs text-zinc-500">Select the radio button next to the correct option.</p>
          {q.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => set(i, { correctIndex: oi })} aria-label={`Option ${oi + 1} is correct`} className="h-4 w-4 accent-blue-600" />
              <input aria-label={`Option ${oi + 1}`} value={o} onChange={(e) => set(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} className={field} />
              <button type="button" disabled={q.options.length <= 2} aria-label={`Remove option ${oi + 1}`}
                onClick={() => set(i, { options: q.options.filter((_, k) => k !== oi), correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}
                className={btn}>Remove</button>
            </div>
          ))}
          <textarea aria-label={`Explanation for question ${i + 1}`} placeholder="Explanation shown after the student answers" value={q.explanation} onChange={(e) => set(i, { explanation: e.target.value })} rows={2} className={field} />
          <div className="flex gap-2">
            <button type="button" disabled={q.options.length >= 6} onClick={() => set(i, { options: [...q.options, ""] })} className={btn}>Add option</button>
            <button type="button" onClick={() => onChange(quiz.filter((_, k) => k !== i))} className={btn}>Delete question</button>
          </div>
        </fieldset>
      ))}
      <button type="button" disabled={quiz.length >= 15} onClick={() => onChange([...quiz, { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }])} className={btn}>Add question</button>
    </div>
  );
}

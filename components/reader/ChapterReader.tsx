"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QUIZ_PASS_THRESHOLD } from "@/lib/quizProgress";
import { CHAPTER_VIDEO_MARKER, resolveChapterVideo, splitChapterVideo } from "@/lib/chapterVideo";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { parseChapterSections } from "@/lib/chapterSections";
import SessionActivityTracker from "@/components/SessionActivityTracker";
import ChapterNotes from "@/components/reader/ChapterNotes";

/**
 * Monochrome reader. Meaning is carried by structure, not colour:
 *  - inverted (white on black) = current chapter / correct answer
 *  - dashed + struck-through   = the wrong answer you picked
 *  - filled square             = completed chapter
 * Pair with next/font: a serif for lectures (e.g. Source Serif 4) and a sans for UI.
 */

export type Question = { question: string; options: string[]; correctIndex: number; explanation: string };
export type FinalAssessmentView = {
  objectiveQuestions: Question[];
  theoryQuestions: { question: string; sampleAnswer: string; gradingPoints: string[] }[];
};
export type ChapterView = { id: string; index: number; title: string; contentMd: string; videoUrl?: string; quiz: Question[] };
type Props = { courseId: string; courseTitle: string; studentName: string; studentAvatar?: string; chapters: ChapterView[]; finalAssessment?: FinalAssessmentView | null; completedIds?: string[]; completedSections?: Record<string, string[]>; notesByChapter?: Record<string, string>; isOwner?: boolean; isAdmin?: boolean };
type Msg = { role: "user" | "assistant"; content: string };

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white";
const line = "border border-black dark:border-white";
const soft = "border border-zinc-300 dark:border-zinc-800";
const inverted = "bg-black text-white dark:bg-white dark:text-black";

/* ------------------------------ reader ------------------------------ */

export default function ChapterReader({ courseId, courseTitle, studentName, studentAvatar = "", chapters, finalAssessment = null, completedIds = [], completedSections = {}, notesByChapter: initialNotes = {}, isOwner = false, isAdmin = false }: Props) {
  const [activeId, setActiveId] = useState(chapters[0].id);
  const [done, setDone] = useState(() => new Set(completedIds));
  const [sectionProgress, setSectionProgress] = useState(completedSections);
  const [notesByChapter, setNotesByChapter] = useState(initialNotes);
  const [expandedIds, setExpandedIds] = useState(() => new Set([chapters[0].id]));
  const [activeSectionId, setActiveSectionId] = useState(() => parseChapterSections(chapters[0].contentMd)[0]?.id ?? "");
  const [progressError, setProgressError] = useState(false);
  const [retryingProgress, setRetryingProgress] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const recordedSections = useRef(new Set(Object.entries(completedSections).flatMap(([chapterId, sectionIds]) => sectionIds.map((sectionId) => `${chapterId}:${sectionId}`))));
  const failedSections = useRef(new Set<string>());

  const pos = chapters.findIndex((c) => c.id === activeId);
  const chapter = chapters[pos];
  const chapterSections = useMemo(() => parseChapterSections(chapter.contentMd), [chapter.id, chapter.contentMd]);
  const selectedSectionIndex = Math.max(0, chapterSections.findIndex((section) => section.id === activeSectionId));
  const selectedSection = chapterSections[selectedSectionIndex];
  const allChapterQuizzesPassed = chapters.every((item) => item.quiz.length === 0 || done.has(item.id));

  const saveSectionProgress = (chapterId: string, sectionId: string): Promise<void> => {
    const key = `${chapterId}:${sectionId}`;
    if (recordedSections.current.has(key)) return Promise.resolve();
    recordedSections.current.add(key);
    setSectionProgress((previous) => ({
      ...previous,
      [chapterId]: [...new Set([...(previous[chapterId] ?? []), sectionId])],
    }));
    return fetch("/api/progress/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, chapterId, sectionId }),
    }).then((response) => {
      if (!response.ok) throw new Error("Section progress could not be saved");
      failedSections.current.delete(key);
      setProgressError(failedSections.current.size > 0);
    }).catch(() => {
      failedSections.current.add(key);
      setProgressError(true);
    });
  };

  const retrySectionProgress = async () => {
    const retry = [...failedSections.current];
    failedSections.current.clear();
    setProgressError(false);
    setRetryingProgress(true);
    try {
      await Promise.all(retry.map((key) => {
        const separator = key.indexOf(":");
        recordedSections.current.delete(key);
        return saveSectionProgress(key.slice(0, separator), key.slice(separator + 1));
      }));
    } finally {
      setRetryingProgress(false);
    }
  };

  const isChapterUnlocked = (index: number) => {
    if (isOwner || index <= 0) return true;
    const previousChapter = chapters[index - 1];
    return Boolean(previousChapter && (previousChapter.quiz.length === 0 || done.has(previousChapter.id)));
  };

  const goToSection = (chapterIndex: number, sectionIndex: number) => {
    const target = chapters[chapterIndex];
    const targetSection = target && parseChapterSections(target.contentMd)[sectionIndex];
    if (!target || !targetSection || !isChapterUnlocked(chapterIndex)) return;
    setActiveId(target.id);
    setActiveSectionId(targetSection.id);
    setExpandedIds((previous) => new Set(previous).add(target.id));
    setNavOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const go = (id: string) => {
    const targetIndex = chapters.findIndex((c) => c.id === id);
    if (targetIndex >= 0) goToSection(targetIndex, 0);
  };

  const moveSubsection = (direction: -1 | 1) => {
    if (direction < 0 && selectedSectionIndex > 0) {
      goToSection(pos, selectedSectionIndex - 1);
    } else if (direction > 0 && selectedSectionIndex < chapterSections.length - 1) {
      goToSection(pos, selectedSectionIndex + 1);
    } else if (direction < 0 && pos > 0) {
      goToSection(pos - 1, parseChapterSections(chapters[pos - 1].contentMd).length - 1);
    } else if (direction > 0 && isChapterUnlocked(pos + 1)) {
      goToSection(pos + 1, 0);
    }
  };

  const selectSection = (chapterId: string, sectionId: string) => {
    const chapterIndex = chapters.findIndex((item) => item.id === chapterId);
    const sectionIndex = parseChapterSections(chapters[chapterIndex]?.contentMd ?? "").findIndex((section) => section.id === sectionId);
    if (chapterIndex >= 0 && sectionIndex >= 0) goToSection(chapterIndex, sectionIndex);
  };

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const headings = [...main.querySelectorAll<HTMLElement>("[data-section-heading]")];
    if (!headings.length) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort(
        (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
      );
      for (const entry of visible) {
        const sectionId = (entry.target as HTMLElement).dataset.sectionHeading;
        if (sectionId) saveSectionProgress(chapter.id, sectionId);
      }
      if (visible[0]) setActiveSectionId((visible[0].target as HTMLElement).dataset.sectionHeading ?? "");
    }, { root: main, rootMargin: "0px 0px -68% 0px", threshold: 0 });

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [chapter.id, chapterSections, courseId]);

  function handleQuizDone(score: number, total: number, answers: number[]): Promise<void> {
    if (score / total >= QUIZ_PASS_THRESHOLD) setDone((p) => new Set(p).add(chapter.id));
    return fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, chapterId: chapter.id, score, total, answers }),
    }).then(() => {}).catch(() => {});
  }

  return (
    <div className="page-enter flex h-dvh flex-col bg-white text-black dark:bg-black dark:text-white">
      <SessionActivityTracker isAdmin={isAdmin} />
      <header className={`border-0 border-b ${line} px-4 py-3`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <a href="/courses" className="shrink-0 text-xs underline underline-offset-4">
              All courses
            </a>
            {isOwner && (
              <>
                <a href={`/courses/${courseId}/edit`} className="shrink-0 text-xs underline underline-offset-4">
                  Edit
                </a>
                <a href={`/courses/${courseId}/students`} className="shrink-0 text-xs underline underline-offset-4">
                  Students
                </a>
              </>
            )}
            <h1 className="truncate font-sans text-sm font-semibold">{courseTitle}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              Chapter {pos + 1} of {chapters.length}
            </span>
            <button
              onClick={() => setNavOpen((o) => !o)}
              aria-expanded={navOpen}
              aria-controls="chapter-navigation"
              className={`${line} px-3 py-1.5 text-black dark:text-white ${focus}`}
            >
              Chapters
            </button>
          </div>
        </div>
        {/* One segment per chapter: filled = completed */}
        <div className="mt-3 flex gap-px" role="img" aria-label={`${done.size} of ${chapters.length} chapters completed`}>
          {chapters.map((c) => (
            <div key={c.id} className={`h-1 flex-1 ${done.has(c.id) ? inverted : "bg-zinc-300 dark:bg-zinc-800"}`} />
          ))}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col xl:flex-row">
        {navOpen && (
          <button
            type="button"
            aria-label="Close chapter navigation"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 z-20 cursor-default bg-black/20 dark:bg-white/10"
          />
        )}
        <nav
          id="chapter-navigation"
          aria-label="Chapters"
          className={`absolute inset-y-0 left-0 z-30 w-[min(20rem,88vw)] shrink-0 overflow-y-auto border-0 border-r ${line} bg-white shadow-xl shadow-black/10 dark:bg-black dark:shadow-black/40
            transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none
            xl:static xl:inset-auto xl:z-auto xl:flex xl:w-72 xl:translate-x-0 xl:visible xl:shadow-none
            ${navOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}
        >
          <ol>
            {chapters.map((c, i) => {
              const active = c.id === activeId;
              const locked = !isChapterUnlocked(i);
              const sections = parseChapterSections(c.contentMd);
              const completedSectionCount = (sectionProgress[c.id] ?? []).filter((sectionId) =>
                sections.some((section) => section.id === sectionId)
              ).length;
              const percentage = Math.round((completedSectionCount / sections.length) * 100);
              const expanded = expandedIds.has(c.id);
              return (
                <li key={c.id}>
                  <div className={`flex items-start gap-2 border-0 border-b ${soft} px-3 py-3 ${active ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}>
                    <button
                      disabled={locked}
                      onClick={() => go(c.id)}
                      aria-current={active ? "page" : undefined}
                      aria-label={locked ? `${c.title}. Locked. Score at least 65% on ${chapters[i - 1].title} to unlock.` : undefined}
                      className={`flex min-w-0 flex-1 items-start gap-3 text-left font-sans text-sm ${focus}
                        ${locked ? "cursor-not-allowed text-zinc-500 opacity-70" : active ? "" : "hover:text-blue-800 dark:hover:text-blue-200"}`}
                    >
                      {locked ? <LockIcon /> : (
                        <span
                          aria-label={done.has(c.id) ? "Quiz passed" : "Quiz not passed"}
                          className={`mt-1 h-3 w-3 shrink-0 border ${
                            done.has(c.id)
                              ? "border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400"
                              : active ? "border-current" : "border-black dark:border-white"
                          }`}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block">{i + 1}. {c.title}</span>
                        <span className={`mt-2 flex items-center gap-2 text-xs ${active ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500"}`}>
                          <SectionProgressRing completed={completedSectionCount} total={sections.length} title={c.title} />
                          <span>{completedSectionCount} of {sections.length} sections</span>
                        </span>
                        <span
                          role="progressbar"
                          aria-label={`${c.title} reading progress`}
                          aria-valuemin={0}
                          aria-valuemax={sections.length}
                          aria-valuenow={completedSectionCount}
                          className={`mt-1.5 block h-1 w-full ${active ? "bg-white/25 dark:bg-black/20" : "bg-zinc-200 dark:bg-zinc-800"}`}
                        >
                          <span className={`block h-full ${active ? "bg-white dark:bg-black" : "bg-black dark:bg-white"}`} style={{ width: `${percentage}%` }} />
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Hide" : "Show"} sections for ${c.title}`}
                      onClick={() => setExpandedIds((previous) => {
                        const next = new Set(previous);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })}
                      className={`shrink-0 px-1 py-0.5 text-xs ${locked ? "opacity-40" : ""} ${focus}`}
                    >
                      <ChevronIcon expanded={expanded} />
                    </button>
                  </div>
                  {expanded && !locked && (
                    <ol className={`border-b ${soft} py-1 ${active ? "bg-zinc-50 dark:bg-zinc-950" : ""}`}>
                      {sections.map((section, sectionIndex) => {
                        const completed = (sectionProgress[c.id] ?? []).includes(section.id);
                        const selected = active && activeSectionId === section.id;
                        return (
                          <li key={section.id}>
                            <button
                              type="button"
                              onClick={() => selectSection(c.id, section.id)}
                              aria-current={selected ? "location" : undefined}
                              aria-label={`${i + 1}.${sectionIndex + 1}, ${section.title}${selected ? ", current section" : ""}`}
                              className={`flex min-h-11 w-full items-start gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${focus}
                                ${selected
                                  ? "bg-blue-50 font-semibold text-blue-950 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/60 dark:text-blue-100 dark:ring-blue-900"
                                  : "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"}`}
                            >
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                  completed ? "bg-emerald-600 dark:bg-emerald-400" : selected ? "bg-blue-700 dark:bg-blue-300" : "bg-zinc-300 dark:bg-zinc-700"
                                }`}
                              />
                              <span className={`w-9 shrink-0 tabular-nums ${selected ? "font-semibold text-blue-800 dark:text-blue-200" : "text-zinc-500 dark:text-zinc-400"}`}>
                                {i + 1}.{sectionIndex + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block line-clamp-2 leading-5">{section.title}</span>
                                {selected && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">Current section</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <ChapterNotes
          key={chapter.id}
          courseTitle={courseTitle}
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          initialNote={notesByChapter[chapter.id] ?? ""}
          onNoteChange={(content) => setNotesByChapter((previous) => ({ ...previous, [chapter.id]: content }))}
        />

        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 md:px-12 md:py-12 xl:px-16">
          <article
            className="prose prose-zinc mx-auto w-full max-w-6xl font-serif dark:prose-invert prose-p:max-w-[75ch] prose-li:max-w-[75ch]
              prose-headings:font-sans prose-headings:font-semibold prose-a:underline
              prose-img:mx-auto prose-img:max-h-[70vh] prose-img:w-full prose-img:object-contain prose-img:border prose-img:border-zinc-200 dark:prose-img:border-zinc-800
              prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-none prose-pre:border prose-pre:border-zinc-300 dark:prose-pre:border-zinc-800"
          >
            <h1 className="mb-8">{chapter.title}</h1>
            {chapterSections.map((section, index) => (
              section.id === selectedSection.id && (
                <section key={section.id} id={`${chapter.id}-${section.id}`} className="scroll-mt-6">
                  <p className="not-prose mb-4 flex flex-wrap items-center gap-2 font-sans text-xs">
                    <span className="inline-flex min-h-8 items-center bg-blue-700 px-3 font-semibold tabular-nums text-white dark:bg-blue-300 dark:text-blue-950">
                      Section {pos + 1}.{index + 1}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">{chapter.title}</span>
                  </p>
                  <h2 data-section-heading={section.id} className="mt-0 text-2xl leading-tight md:text-3xl">
                    {section.title}
                  </h2>
                  {splitChapterVideo(
                    section.contentMd,
                    chapter.contentMd.includes(CHAPTER_VIDEO_MARKER) || index === 0 ? chapter.videoUrl : ""
                  ).map((block) => block.kind === "video"
                    ? <ChapterVideo key={block.key} url={chapter.videoUrl!} title={chapter.title} />
                    : <ReactMarkdown key={block.key} remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>)}
                </section>
              )
            ))}
          </article>

          <nav aria-label="Subsection navigation" className={`mx-auto mt-10 flex w-full max-w-6xl items-center justify-between gap-4 border-y ${soft} py-4 font-sans`}>
            <button
              type="button"
              disabled={pos === 0 && selectedSectionIndex === 0}
              onClick={() => moveSubsection(-1)}
              className={`${line} px-4 py-2 text-sm disabled:border-zinc-300 disabled:text-zinc-400 dark:disabled:border-zinc-800 dark:disabled:text-zinc-600 ${focus}`}
            >
              Previous
            </button>
            <span className="text-xs tabular-nums text-zinc-500">
              {pos + 1}.{selectedSectionIndex + 1} <span aria-hidden="true">/</span> {pos + 1}.{chapterSections.length}
            </span>
            <button
              type="button"
              disabled={selectedSectionIndex === chapterSections.length - 1 && (pos === chapters.length - 1 || !isChapterUnlocked(pos + 1))}
              onClick={() => moveSubsection(1)}
              className={`${inverted} border border-black px-4 py-2 text-sm disabled:opacity-30 dark:border-white ${focus}`}
            >
              {selectedSectionIndex < chapterSections.length - 1 ? "Next subsection" : pos < chapters.length - 1 ? "Next chapter" : "Course complete"}
            </button>
          </nav>

          {progressError && (
            <p role="status" className="mx-auto mt-4 flex w-full max-w-6xl items-center gap-3 text-sm text-red-700 dark:text-red-300">
              Reading progress could not be synced.
              <button type="button" onClick={() => void retrySectionProgress()} disabled={retryingProgress} aria-busy={retryingProgress} className="inline-flex items-center gap-2 font-semibold underline underline-offset-4 disabled:cursor-wait">
                {retryingProgress && <LoadingSpinner />}
                {retryingProgress ? "Retrying..." : "Retry"}
              </button>
            </p>
          )}

          {selectedSectionIndex === chapterSections.length - 1 && chapter.quiz.length > 0 && (
            <section className={`mx-auto mt-14 flex w-full max-w-6xl flex-col gap-5 border-y ${soft} py-6 font-sans sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <h2 className="text-lg font-semibold">Check your understanding</h2>
                <p className="mt-1 text-sm text-zinc-500">{chapter.quiz.length} questions</p>
              </div>
              <Quiz key={chapter.id} questions={chapter.quiz} onComplete={handleQuizDone} />
            </section>
          )}

          {selectedSectionIndex === chapterSections.length - 1 && pos === chapters.length - 1 && finalAssessment && (
            <FinalAssessmentExam
              key={courseId}
              courseId={courseId}
              assessment={finalAssessment}
              unlocked={isOwner || allChapterQuizzesPassed}
            />
          )}

          <div className="pb-24" />
        </main>
      </div>

      <AssistantDrawer key={chapter.id} chapterId={chapter.id} chapterTitle={chapter.title} studentName={studentName} studentAvatar={studentAvatar} />
    </div>
  );
}

function ChapterVideo({ url, title }: { url: string; title: string }) {
  const source = resolveChapterVideo(url);
  if (!source) return null;
  return (
    <figure className="my-8 not-prose overflow-hidden border border-zinc-200 bg-black dark:border-zinc-800">
      {source.kind === "file" ? (
        <video className="aspect-video w-full" controls preload="metadata" src={source.src} aria-label={`${title} video`} />
      ) : (
        <iframe
          className="aspect-video w-full"
          src={source.src}
          title={`${title} video`}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}
      <figcaption className="border-t border-zinc-200 bg-white px-3 py-2 font-sans text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        {title} video
      </figcaption>
    </figure>
  );
}

function FinalAssessmentExam({
  courseId,
  assessment,
  unlocked,
}: {
  courseId: string;
  assessment: FinalAssessmentView;
  unlocked: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [objectiveAnswers, setObjectiveAnswers] = useState<(number | null)[]>(() => assessment.objectiveQuestions.map(() => null));
  const [theoryAnswers, setTheoryAnswers] = useState<string[]>(() => assessment.theoryQuestions.map(() => ""));
  const [result, setResult] = useState<{ objectiveScore: number; objectiveTotal: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isComplete = objectiveAnswers.every((answer) => answer !== null) && theoryAnswers.every((answer) => answer.trim().length > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setObjectiveAnswers(assessment.objectiveQuestions.map(() => null));
    setTheoryAnswers(assessment.theoryQuestions.map(() => ""));
    setResult(null);
    setError("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/${courseId}/final-assessment/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveAnswers: objectiveAnswers as number[],
          theoryAnswers,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "The final assessment could not be submitted.");
      setResult({ objectiveScore: data.objectiveScore, objectiveTotal: data.objectiveTotal });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const percentage = result ? Math.round((result.objectiveScore / result.objectiveTotal) * 100) : 0;

  return (
    <section className={`mx-auto mt-14 max-w-[68ch] border-y ${soft} py-6 font-sans`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold">Final course assessment</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {assessment.objectiveQuestions.length} objective questions · {assessment.theoryQuestions.length} theory questions
          </p>
          {!unlocked && <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">Pass every chapter quiz to unlock the final assessment.</p>}
        </div>
        <button
          type="button"
          disabled={!unlocked}
          onClick={() => setOpen(true)}
          className={`${inverted} shrink-0 border border-black px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-white ${focus}`}
        >
          {result ? "Review final assessment" : "Begin final assessment"}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="final-assessment-title"
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto bg-white p-0 text-black shadow-2xl backdrop:bg-black/60 dark:bg-black dark:text-white dark:backdrop:bg-black/75"
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between gap-4 border-0 border-b ${line} bg-white px-5 py-4 dark:bg-black sm:px-8`}>
          <div>
            <h2 id="final-assessment-title" className="text-base font-semibold">Final course assessment</h2>
            {!result && <p className="mt-1 text-xs text-zinc-500">{assessment.objectiveQuestions.length} objective · {assessment.theoryQuestions.length} theory</p>}
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close final assessment" className={`${line} px-3 py-1.5 text-sm ${focus}`}>
            Close
          </button>
        </div>

        {result ? (
          <div className="px-5 py-7 sm:px-8 sm:py-9">
            <p className="text-5xl font-semibold tabular-nums">{percentage}<span className="text-2xl text-zinc-400">%</span></p>
            <p className="mt-1 text-sm text-zinc-500">{result.objectiveScore} of {result.objectiveTotal} objective questions correct. Theory responses are for review and are not auto-graded.</p>
            <ol className="mt-7 space-y-7">
              {assessment.objectiveQuestions.map((question, index) => (
                <li key={`objective-${index}`} className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <p className="text-sm font-semibold">{index + 1}. {question.question}</p>
                  <p className="mt-2 text-sm text-zinc-500">Your answer: {question.options[objectiveAnswers[index]!]}</p>
                  <p className="mt-1 text-sm">Correct answer: {question.options[question.correctIndex]}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{question.explanation}</p>
                </li>
              ))}
              {assessment.theoryQuestions.map((question, index) => (
                <li key={`theory-${index}`} className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <p className="text-sm font-semibold">Theory {index + 1}. {question.question}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">Your response: {theoryAnswers[index]}</p>
                  <p className="mt-3 text-sm font-medium">Sample answer</p>
                  <p className="mt-1 text-sm leading-relaxed">{question.sampleAnswer}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-zinc-500">
                    {question.gradingPoints.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
                  </ul>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex justify-end gap-3 border-t border-zinc-300 pt-5 dark:border-zinc-800">
              <button type="button" onClick={reset} className={`${line} px-4 py-2 text-sm ${focus}`}>Retake assessment</button>
              <button type="button" onClick={() => setOpen(false)} className={`${inverted} border border-black px-4 py-2 text-sm font-medium dark:border-white ${focus}`}>Return to course</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-8 px-5 py-7 sm:px-8 sm:py-9">
            <section aria-labelledby="final-objective-heading">
              <h3 id="final-objective-heading" className="mb-5 text-lg font-semibold">Objective questions</h3>
              <div className="space-y-7">
                {assessment.objectiveQuestions.map((question, questionIndex) => (
                  <fieldset key={questionIndex} className="space-y-2">
                    <legend className="mb-3 text-sm font-medium">{questionIndex + 1}. {question.question}</legend>
                    {question.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        type="button"
                        aria-pressed={objectiveAnswers[questionIndex] === optionIndex}
                        onClick={() => setObjectiveAnswers((answers) => answers.map((answer, index) => index === questionIndex ? optionIndex : answer))}
                        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm ${objectiveAnswers[questionIndex] === optionIndex ? "border border-emerald-500 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100" : `${soft} hover:bg-zinc-100 dark:hover:bg-zinc-900`} ${focus}`}
                      >
                        <span className="w-5 shrink-0 font-semibold">{String.fromCharCode(65 + optionIndex)}</span>
                        <span>{option}</span>
                      </button>
                    ))}
                  </fieldset>
                ))}
              </div>
            </section>

            <section aria-labelledby="final-theory-heading" className="border-t border-zinc-300 pt-6 dark:border-zinc-800">
              <h3 id="final-theory-heading" className="mb-5 text-lg font-semibold">Theory questions</h3>
              <div className="space-y-5">
                {assessment.theoryQuestions.map((question, index) => (
                  <label key={index} className="block text-sm font-medium">
                    <span>{index + 1}. {question.question}</span>
                    <textarea
                      value={theoryAnswers[index]}
                      onChange={(event) => setTheoryAnswers((answers) => answers.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                      maxLength={5000}
                      rows={5}
                      required
                      className={`mt-2 block w-full resize-y ${soft} bg-white px-3 py-2.5 text-sm font-normal dark:bg-zinc-950 ${focus}`}
                    />
                  </label>
                ))}
              </div>
            </section>

            {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="flex justify-end border-t border-zinc-300 pt-5 dark:border-zinc-800">
              <button type="submit" disabled={!isComplete || busy} aria-busy={busy} className={`inline-flex items-center gap-2 ${inverted} border border-black px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-white`}>
                {busy && <LoadingSpinner />}
                {busy ? "Submitting assessment..." : "Submit final assessment"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}

/* ------------------------------- quiz ------------------------------- */

function Quiz({
  questions,
  onComplete,
}: {
  questions: Question[];
  onComplete: (score: number, total: number, answers: number[]) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const score = answers.reduce<number>((s, a, i) => s + (a === questions[i].correctIndex ? 1 : 0), 0);
  const percentage = Math.round((score / questions.length) * 100);
  const currentQuestion = questions[questionIndex];
  const selected = answers[questionIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const resetQuiz = () => {
    setAnswers(questions.map(() => null));
    setQuestionIndex(0);
    setComplete(false);
    setSaving(false);
  };

  const advance = async () => {
    if (saving) return;
    if (questionIndex === questions.length - 1) {
      setSaving(true);
      try {
        await onComplete(score, questions.length, answers as number[]);
        setComplete(true);
      } finally {
        setSaving(false);
      }
      return;
    }
    setQuestionIndex((index) => index + 1);
  };

  return (
    <>
      <button
        onClick={() => {
          if (complete) resetQuiz();
          setOpen(true);
        }}
        className={`${inverted} inline-flex items-center justify-center gap-3 border border-black px-4 py-2.5 text-sm font-medium dark:border-white ${focus}`}
      >
        {complete ? "Retake quiz" : "Begin quiz"}
        <span aria-hidden="true">{questions.length}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="chapter-quiz-title"
        onClose={() => setOpen(false)}
        className={`fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto bg-white p-0 text-black shadow-2xl backdrop:bg-black/60 dark:bg-black dark:text-white dark:backdrop:bg-black/75`}
      >
        <div className="flex items-center justify-between gap-4 border-0 border-b border-zinc-300 px-5 py-4 dark:border-zinc-800 sm:px-7">
          <div className="min-w-0">
            <h2 id="chapter-quiz-title" className="truncate text-base font-semibold">Chapter quiz</h2>
            {!complete && (
              <p className="mt-1 text-xs text-zinc-500">Question {questionIndex + 1} of {questions.length}</p>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close quiz and save your place"
            className={`${line} shrink-0 px-3 py-1.5 text-sm ${focus}`}
          >
            Close
          </button>
        </div>

        {!complete ? (
          <>
            <div className="h-1 bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={questionIndex + 1} aria-label="Quiz progress">
              <div className="h-full bg-black transition-[width] dark:bg-white" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="px-5 py-7 sm:px-10 sm:py-9">
              <fieldset className="space-y-3">
                <legend className="mb-6 max-w-[60ch] text-lg font-semibold leading-snug sm:text-xl">
                  {currentQuestion.question}
                </legend>
                {currentQuestion.options.map((option, optionIndex) => {
                  const style = selected === optionIndex
                    ? "border border-emerald-500 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100"
                    : `${line} hover:bg-zinc-100 dark:hover:bg-zinc-900`;
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      onClick={() => {
                        setAnswers((previous) => previous.map((answer, index) => index === questionIndex ? optionIndex : answer));
                      }}
                      aria-pressed={selected === optionIndex}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm ${style} ${focus}`}
                    >
                      <span className="w-5 shrink-0 font-semibold">{String.fromCharCode(65 + optionIndex)}</span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </fieldset>

            </div>

            <div className="flex items-center justify-between gap-3 border-0 border-t border-zinc-300 px-5 py-4 dark:border-zinc-800 sm:px-7">
              <button
                type="button"
                disabled={questionIndex === 0}
                onClick={() => setQuestionIndex((index) => index - 1)}
                className={`${line} px-4 py-2 text-sm disabled:opacity-40 ${focus}`}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={selected === null || saving}
                aria-busy={saving}
                onClick={() => void advance()}
                className={`inline-flex items-center gap-2 ${inverted} border border-black px-4 py-2 text-sm font-medium disabled:opacity-30 dark:border-white ${focus}`}
              >
                {saving && <LoadingSpinner />}
                {saving ? "Saving progress..." : questionIndex === questions.length - 1 ? "Finish quiz" : "Next question"}
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 py-7 sm:px-10 sm:py-9">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-5xl font-semibold tabular-nums">{percentage}<span className="text-2xl text-zinc-400">%</span></p>
              <p className="pb-1 text-sm text-zinc-500">{score} of {questions.length} correct</p>
            </div>
            <div
              className="mt-4 h-2 bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-label="Quiz score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
            >
              <div className="h-full bg-emerald-600 transition-[width] dark:bg-emerald-400" style={{ width: `${percentage}%` }} />
            </div>
            <h3 className="mt-2 text-lg font-semibold">{score / questions.length >= 0.6 ? "Chapter complete" : "Keep practicing"}</h3>
            <p className="mt-1 text-sm text-zinc-500">Your answers and explanations</p>

            <ol className="mt-7 divide-y divide-zinc-200 dark:divide-zinc-800">
              {questions.map((question, index) => (
                <li key={index} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">{index + 1}. {question.question}</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    <strong>{answers[index] === question.correctIndex ? "Correct" : "Incorrect"}</strong>{" · "}
                    Your answer: {question.options[answers[index]!]} · Correct answer: {question.options[question.correctIndex]}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{question.explanation}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap justify-end gap-3 border-0 border-t border-zinc-300 pt-5 dark:border-zinc-800">
              <button type="button" onClick={() => { resetQuiz(); setOpen(true); }} className={`${line} px-4 py-2 text-sm ${focus}`}>
                Retake quiz
              </button>
              <button type="button" onClick={() => setOpen(false)} className={`${inverted} border border-black px-4 py-2 text-sm font-medium dark:border-white ${focus}`}>
                Return to lesson
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

/* ---------------------------- AI assistant --------------------------- */

function AssistantDrawer({ chapterId, chapterTitle, studentName, studentAvatar }: { chapterId: string; chapterTitle: string; studentName: string; studentAvatar: string }) {
  const [open, setOpen] = useState(false);
  const welcomeMessage = `Hello ${studentName}, I’m your AI study assistant for ${chapterTitle}. How can I help you study this chapter?`;
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: welcomeMessage }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const showStarterPrompts = msgs.length === 1 && msgs[0].role === "assistant";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  async function requestAnswer(history: Msg[]) {
    if (busy) return;
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, messages: history }), // ids + turns only, never chapter text
      });
      if (!res.ok || !res.body) throw new Error("The assistant request failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...history, { role: "assistant", content: acc }]);
      }
      acc += dec.decode();
      setMsgs([...history, { role: "assistant", content: acc }]);
    } catch {
      setMsgs(history);
      setError("The reply didn’t come through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setActivePrompt(question);
    try {
      await requestAnswer([...msgs, { role: "user", content: question }]);
    } finally {
      setActivePrompt(null);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await ask(input);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="study-assistant-panel"
        className={`fixed bottom-4 right-4 z-40 inline-flex min-h-14 max-w-[calc(100vw-2rem)] items-center gap-3 border border-blue-700 bg-blue-700 px-5 py-4 font-sans text-base font-semibold text-white hover:border-blue-800 hover:bg-blue-800 dark:border-blue-500 dark:bg-blue-600 dark:text-white dark:hover:border-blue-400 dark:hover:bg-blue-500 ${focus}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 18.5 4 20l1.5-3.5A8 8 0 1 1 7.5 18.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5" />
        </svg>
        <span>Ask AI study assistant</span>
      </button>

      <aside
        id="study-assistant-panel"
        aria-label="Study assistant"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-0 border-l ${line} bg-white font-sans dark:bg-black sm:w-[32rem] md:w-[36rem] xl:w-[40rem]
          transition-[transform,visibility] motion-reduce:transition-none
          ${open ? "visible translate-x-0" : "invisible translate-x-full"}`}
      >
        <div className={`flex items-center justify-between gap-3 border-0 border-b ${line} px-4 py-3`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Study assistant</p>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
            </div>
            <p className="truncate text-xs text-zinc-500">{chapterTitle}</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close study assistant" className={`${line} px-2 py-1 text-sm ${focus}`}>
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 text-sm sm:px-5" aria-busy={busy}>
          {msgs.length > 0 && (
            <div className="space-y-5">
              {msgs.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex w-fit max-w-full items-start gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    <ChatAvatar role={message.role} name={studentName} image={studentAvatar} />
                    <div className={`flex min-w-0 max-w-[calc(100%-2.5rem)] flex-col gap-1.5 ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <p className="px-1 text-[11px] font-medium text-zinc-500">{message.role === "user" ? "You" : "Study assistant"}</p>
                      {message.role === "user" ? (
                        <div className="max-w-full whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm leading-relaxed text-white dark:bg-blue-600">
                          {message.content}
                        </div>
                      ) : (
                        <div className="max-w-full text-left">
                          {message.content ? (
                            <TypewriterMarkdown content={message.content} active={open} />
                          ) : busy ? (
                            <ThinkingIndicator />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showStarterPrompts && (
            <div className="mr-3 mt-4 flex flex-col gap-2">
              {(["Summarize this chapter", "Explain a key concept", "Give me a practice question"]).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={busy}
                  aria-busy={activePrompt === prompt}
                  onClick={() => void ask(prompt)}
                  className={`inline-flex w-fit max-w-full items-center gap-2 ${soft} px-3 py-2.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-900 ${focus}`}
                >
                  {activePrompt === prompt && <LoadingSpinner />}
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className={`mt-4 flex items-center justify-between gap-3 ${soft} px-3 py-2.5`} role="alert">
              <p className="text-sm">{error}</p>
              <button
                type="button"
                onClick={() => void requestAnswer(msgs)}
                disabled={busy}
                aria-busy={busy}
                className={`inline-flex shrink-0 items-center gap-2 ${line} px-3 py-1.5 text-sm disabled:cursor-wait ${focus}`}
              >
                {busy && <LoadingSpinner />}
                {busy ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className={`border-0 border-t ${line} bg-white p-3 dark:bg-black`}>
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 shadow-sm transition focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-600/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400/10">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Message about this chapter..."
              aria-label="Ask the study assistant a question"
              maxLength={2000}
              rows={2}
              className="min-h-11 max-h-36 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm placeholder:text-zinc-500 focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-busy={busy}
              className="inline-flex h-11 min-w-20 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-700 px-4 text-sm font-semibold text-white hover:border-blue-800 hover:bg-blue-800 disabled:cursor-not-allowed disabled:border-blue-200 disabled:bg-blue-100 disabled:text-blue-800 dark:border-blue-500 dark:bg-blue-600 dark:hover:border-blue-400 dark:hover:bg-blue-500 dark:disabled:border-blue-900 dark:disabled:bg-blue-950 dark:disabled:text-blue-200"
            >
              {busy && <LoadingSpinner />}
              {busy ? "Sending" : "Send"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

function ChatAvatar({ role, name, image }: { role: Msg["role"]; name: string; image: string }) {
  if (role === "assistant") {
    return (
      <span aria-label="AI study assistant" className="grid h-8 w-8 shrink-0 place-items-center bg-blue-700 text-[10px] font-bold text-white dark:bg-blue-600">
        AI
      </span>
    );
  }

  return image ? (
    <img src={image} alt={`${name}'s profile`} className="h-8 w-8 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" />
  ) : (
    <span aria-label={`${name}'s profile`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {name.trim().slice(0, 1).toUpperCase() || "U"}
    </span>
  );
}

function TypewriterMarkdown({ content, active }: { content: string; active: boolean }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const latestContent = useRef(content);
  latestContent.current = content;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setVisibleLength((current) => Math.min(latestContent.current.length, current + 1));
    }, 30);
    return () => window.clearInterval(timer);
  }, [active]);

  const isComplete = visibleLength >= content.length;

  return (
    <div aria-live={isComplete ? "polite" : "off"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-sm prose-zinc max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-pre:overflow-x-auto prose-pre:rounded-none prose-pre:border prose-pre:border-zinc-300 dark:prose-pre:border-zinc-800"
      >
        {content.slice(0, visibleLength)}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1 text-sm text-zinc-500" role="status">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:-300ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:-150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
      </span>
      Thinking through the chapter
    </div>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V4.75a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
    >
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionProgressRing({ completed, total, title }: { completed: number; total: number; title: string }) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const circumference = 2 * Math.PI * 9;

  return (
    <svg
      aria-label={`${title} section progress`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-valuetext={`${completed} of ${total} sections complete`}
      className="h-6 w-6 shrink-0"
      role="progressbar"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-300 dark:text-zinc-700" />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percentage / 100)}
        strokeLinecap="round"
        strokeWidth="2.5"
        transform="rotate(-90 12 12)"
        className="text-emerald-600 transition-[stroke-dashoffset] motion-reduce:transition-none dark:text-emerald-400"
      />
      <text
        x="12"
        y="12"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-current font-sans text-[6px] font-semibold text-zinc-700 dark:text-zinc-300"
      >
        {percentage}
      </text>
    </svg>
  );
}

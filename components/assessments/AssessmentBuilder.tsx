"use client";

import Link from "next/link";
import { useState } from "react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type CourseOption = { id: string; title: string };
type QuestionType = "objective" | "theory";
type Difficulty = "easy" | "medium" | "hard";
type AssessmentQuestion = { question: string; options?: string[] };
type AssessmentSession = {
  assessmentId: string;
  courseTitle: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  questions: AssessmentQuestion[];
};
type AssessmentResult = {
  score: number;
  maxScore: number;
  percentage: number;
  objectiveResults: { selectedIndex: number; correctIndex: number; explanation: string }[];
  theoryResults: { score: number; maxScore: number; feedback: string }[];
};

const difficultyCopy: Record<Difficulty, string> = {
  easy: "Recall key ideas",
  medium: "Apply what you know",
  hard: "Analyze and connect ideas",
};

async function readResponse<T>(response: Response): Promise<T & { error?: string }> {
  return response.json() as Promise<T & { error?: string }>;
}

export default function AssessmentBuilder({ courses }: { courses: CourseOption[] }) {
  const [courseId, setCourseId] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("objective");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<(number | string | undefined)[]>([]);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsGenerating(true);
    try {
      const response = await fetch("/api/assessments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, questionType, difficulty, questionCount }),
      });
      const data = await readResponse<AssessmentSession>(response);
      if (!response.ok) throw new Error(data.error || "We couldn't create your assessment. Please try again.");
      setSession(data);
      setAnswers(Array(data.questions.length).fill(undefined));
      setResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't create your assessment. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function submit() {
    if (!session || answers.some((answer) => answer === undefined || answer === "")) {
      setError("Answer every question before submitting.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/assessments/${session.assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await readResponse<{ result: AssessmentResult }>(response);
      if (!response.ok) throw new Error(data.error || "Your answers could not be submitted. Please try again.");
      setResult(data.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your answers could not be submitted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startOver() {
    setSession(null);
    setAnswers([]);
    setResult(null);
    setError("");
  }

  if (!courses.length) {
    return (
      <section className="px-5 py-10 sm:px-8 sm:py-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">No courses ready yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Join a course or wait for its study material to finish processing. Once it is ready, you can make an assessment from it here.
        </p>
        <Link href="/courses" className="mt-5 inline-flex min-h-11 items-center border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          Browse courses
        </Link>
      </section>
    );
  }

  if (!session) {
    return (
      <form onSubmit={generate} className="grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="space-y-7">
          <label htmlFor="assessment-course" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
            Course
            <select
              id="assessment-course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              required
              className="mt-2 block min-h-12 w-full border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="" disabled>Select a course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Question format</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([
                ["objective", "Multiple choice", "Choose one answer from four options."],
                ["theory", "Written response", "Explain your thinking in your own words."],
              ] as const).map(([value, label, description]) => (
                <label key={value} className={`flex min-h-[5.5rem] cursor-pointer items-start gap-3 border px-4 py-3 transition-colors ${questionType === value ? "border-blue-700 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40" : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"}`}>
                  <input
                    type="radio"
                    name="questionType"
                    value={value}
                    checked={questionType === value}
                    onChange={() => setQuestionType(value)}
                    className="mt-1 h-4 w-4 accent-blue-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Difficulty</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(["easy", "medium", "hard"] as const).map((value) => (
                <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 border px-3 py-2 ${difficulty === value ? "border-blue-700 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40" : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"}`}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={value}
                    checked={difficulty === value}
                    onChange={() => setDifficulty(value)}
                    className="h-4 w-4 accent-blue-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold capitalize text-slate-900 dark:text-white">{value}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-300">{difficultyCopy[value]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="assessment-count" className="block max-w-xs text-sm font-semibold text-slate-800 dark:text-slate-100">
            Number of questions
            <select
              id="assessment-count"
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              className="mt-2 block min-h-12 w-full border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "question" : "questions"}</option>)}
            </select>
          </label>

          {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
          <button
            type="submit"
            disabled={!courseId || isGenerating}
            aria-busy={isGenerating}
            className="inline-flex min-h-12 w-full items-center justify-center bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
          >
            {isGenerating && <LoadingSpinner />}
            {isGenerating ? "Building your questions..." : "Generate assessment"}
          </button>
          {isGenerating && <p role="status" aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">Reviewing the course material and creating your practice questions. This may take a moment.</p>}
        </div>

        <aside className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">How your assessment works</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <li>Questions are based on the selected course chapters.</li>
            <li>Multiple choice is scored automatically. Written answers receive AI feedback against course-specific grading points.</li>
            <li>Your answer key and grading guidance stay hidden until after you submit.</li>
          </ul>
        </aside>
      </form>
    );
  }

  return (
    <section className="px-5 py-7 sm:px-8 sm:py-9">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{session.courseTitle}</p>
          <h2 className="mt-1 text-xl font-semibold capitalize text-slate-950 dark:text-white">
            {result ? "Assessment results" : `${session.difficulty} ${session.questionType === "objective" ? "multiple-choice" : "written"} assessment`}
          </h2>
        </div>
      </header>
      {result && (() => {
        const percentage = Math.min(100, Math.max(0, result.percentage));
        const circumference = 2 * Math.PI * 52;
        const isPass = percentage >= 50;
        const needsMorePractice = percentage < 35;
        const tone = isPass
          ? {
              ring: "text-emerald-600 dark:text-emerald-400",
              track: "text-emerald-100 dark:text-emerald-950",
              surface: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
              text: "text-emerald-950 dark:text-emerald-100",
              secondary: "text-emerald-900 dark:text-emerald-200",
              status: "Pass",
            }
          : needsMorePractice
            ? {
                ring: "text-rose-600 dark:text-rose-400",
                track: "text-rose-100 dark:text-rose-950",
                surface: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30",
                text: "text-rose-950 dark:text-rose-100",
                secondary: "text-rose-900 dark:text-rose-200",
                status: "Needs more practice",
              }
            : {
                ring: "text-amber-600 dark:text-amber-400",
                track: "text-amber-100 dark:text-amber-950",
                surface: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
                text: "text-amber-950 dark:text-amber-100",
                secondary: "text-amber-900 dark:text-amber-200",
                status: "Almost there",
              };

        return (
          <div className={`my-6 flex flex-col items-center gap-5 border p-5 text-center sm:my-7 sm:flex-row sm:gap-7 sm:p-6 sm:text-left ${tone.surface}`}>
            <svg
              className={`h-32 w-32 shrink-0 ${tone.ring}`}
              viewBox="0 0 120 120"
              role="progressbar"
              aria-label="Assessment score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
              aria-valuetext={`${percentage}% — ${tone.status}`}
            >
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="9" className={tone.track} />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - percentage / 100)}
                transform="rotate(-90 60 60)"
                className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
              />
              <text x="60" y="58" textAnchor="middle" dominantBaseline="middle" className={`fill-current text-[25px] font-bold ${tone.text}`}>
                {percentage}%
              </text>
              <text x="60" y="80" textAnchor="middle" dominantBaseline="middle" className={`fill-current text-[9px] font-semibold uppercase tracking-[0.12em] ${tone.secondary}`}>
                score
              </text>
            </svg>
            <div className="min-w-0">
              <p className={`text-sm font-bold uppercase tracking-[0.1em] ${tone.secondary}`}>{tone.status}</p>
              <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl ${tone.text}`}>
                {result.score} <span className="text-xl font-semibold">/ {result.maxScore}</span>
              </p>
              <p className={`mt-2 text-sm leading-6 ${tone.secondary}`}>
                {isPass
                  ? "You reached the 50% pass mark. Keep building on what you know."
                  : needsMorePractice
                    ? "Your score is below 35%. Review the feedback and try another assessment."
                    : "You are close to the 50% pass mark. Review the feedback and keep going."}
              </p>
              <p className={`mt-1 text-xs leading-5 ${tone.secondary}`}>Pass mark: 50% · Below 35%: more practice recommended</p>
            </div>
          </div>
        );
      })()}

      {result ? (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {session.questions.map((question, index) => {
            const objective = result.objectiveResults[index];
            const theory = result.theoryResults[index];
            return (
              <article key={index} className="py-6">
                <h3 className="font-semibold leading-6 text-slate-900 dark:text-white">Question {index + 1}: {question.question}</h3>
                {session.questionType === "objective" && objective && question.options && (
                  <div className="mt-3 space-y-2">
                    {question.options.map((option, optionIndex) => {
                      const isCorrect = optionIndex === objective.correctIndex;
                      const wasSelected = optionIndex === objective.selectedIndex;
                      return (
                        <p key={optionIndex} className={`border px-3 py-2 text-sm ${isCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : wasSelected ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200" : "border-slate-200 text-blue-900 dark:border-slate-700 dark:text-blue-200"}`}>
                          {option}{isCorrect ? " — Correct answer" : wasSelected ? " — Your answer" : ""}
                        </p>
                      );
                    })}
                  </div>
                )}
                {session.questionType === "objective" && objective && (
                  <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{objective.explanation}</p>
                )}
                {session.questionType === "theory" && theory && (
                  <>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{String(answers[index] ?? "")}</p>
                    <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Score: {theory.score} / {theory.maxScore}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{theory.feedback}</p>
                  </>
                )}
              </article>
            );
          })}
          <button type="button" onClick={startOver} className="mt-6 inline-flex min-h-11 items-center border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
            Create another assessment
          </button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {session.questions.map((question, index) => (
              <fieldset key={index} className="py-6">
                <legend className="font-semibold leading-6 text-slate-900 dark:text-white">
                  <span className="mr-2 text-sm font-medium text-slate-500 dark:text-slate-400">Question {index + 1}</span>{question.question}
                </legend>
                {session.questionType === "objective" && question.options ? (
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option, optionIndex) => (
                      <label key={optionIndex} className={`flex min-h-11 cursor-pointer items-start gap-3 border px-3 py-2.5 text-sm leading-5 transition-colors ${answers[index] === optionIndex ? "border-blue-700 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40" : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"}`}>
                        <input
                          type="radio"
                          name={`answer-${index}`}
                          checked={answers[index] === optionIndex}
                          onChange={() => setAnswers((previous) => previous.map((answer, answerIndex) => answerIndex === index ? optionIndex : answer))}
                          className="mt-0.5 h-4 w-4 accent-blue-700"
                        />
                        <span className="text-slate-800 dark:text-slate-100">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <label htmlFor={`answer-${index}`} className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Your answer
                    <textarea
                      id={`answer-${index}`}
                      value={typeof answers[index] === "string" ? answers[index] : ""}
                      onChange={(event) => setAnswers((previous) => previous.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                      maxLength={2000}
                      rows={5}
                      required
                      placeholder="Write your response..."
                      className="mt-2 block w-full resize-y border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal leading-6 text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">{typeof answers[index] === "string" ? answers[index].length : 0} / 2,000 characters</span>
                  </label>
                )}
              </fieldset>
            ))}
          </div>
          {error && <p role="alert" className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={submit} disabled={isSubmitting || answers.some((answer) => answer === undefined || answer === "")} aria-busy={isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto">
              {isSubmitting && <LoadingSpinner />}
              {isSubmitting ? "Scoring your answers..." : "Submit assessment"}
            </button>
            {isSubmitting && <p role="status" aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">Checking your answers and preparing feedback.</p>}
          </div>
        </>
      )}
    </section>
  );
}

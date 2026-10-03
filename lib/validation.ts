import { z } from "zod";
import { resolveChapterVideo } from "./chapterVideo";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const nonEmpty = (max: number, label: string) =>
  z.string().trim().min(1, `${label} can't be empty`).max(max, `${label} is too long`);

export const CoursePatch = z
  .object({ title: nonEmpty(200, "Title").optional(), description: z.string().trim().max(1000, "Description is too long").optional() })
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const NewCatalogCourse = z.object({
  title: nonEmpty(200, "Title"),
  description: z.string().trim().max(1000, "Description is too long"),
});

export const HomepageContentInput = z.object({
  heroTitle: nonEmpty(120, "Hero title"),
  heroDescription: nonEmpty(1000, "Hero description"),
  institution: nonEmpty(80, "Institution"),
  program: nonEmpty(100, "Program"),
  level: nonEmpty(40, "Level"),
  primaryCta: nonEmpty(60, "Primary button label"),
  secondaryCta: nonEmpty(60, "Secondary button label"),
  heroFootnote: nonEmpty(200, "Hero note"),
  outlineEyebrow: nonEmpty(80, "Outline label"),
  outlineTitle: nonEmpty(120, "Outline title"),
  outlineLevel: nonEmpty(40, "Outline level"),
  topics: z.array(nonEmpty(140, "Topic")).length(4),
  outlineNote: nonEmpty(240, "Outline note"),
  workflowTitle: nonEmpty(140, "Workflow heading"),
  workflowSteps: z.array(
    z.object({
      title: nonEmpty(100, "Step title"),
      detail: nonEmpty(300, "Step description"),
    })
  ).length(3),
});

export const NewCourseGroup = z.object({
  name: nonEmpty(100, "Group name"),
  courseIds: z.array(objectId).min(1, "Choose at least one course").max(100, "A group can include at most 100 courses"),
});

const ChapterVideoUrl = z.union([
  z.literal(""),
  z.string().trim().max(2000, "Video URL is too long").url("Enter a valid video URL").refine(
    (url) => resolveChapterVideo(url) !== null,
    "Use YouTube, Vimeo, or a direct MP4, WebM, or Ogg URL"
  ),
]);

export const ChapterPatch = z
  .object({
    title: nonEmpty(200, "Title").optional(),
    contentMd: nonEmpty(60_000, "Lecture text").optional(),
    videoUrl: ChapterVideoUrl.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const EditableQuestion = z
  .object({
    question: nonEmpty(500, "Question"),
    options: z.array(nonEmpty(300, "Option")).min(2, "Each question needs at least 2 options").max(6, "At most 6 options"),
    correctIndex: z.number().int().min(0),
    explanation: nonEmpty(400, "Explanation"),
  })
  .refine((q) => q.correctIndex < q.options.length, "Pick which option is correct");

export const QuizPut = z.object({ questions: z.array(EditableQuestion).max(15, "At most 15 questions") });
export const ReorderBody = z.object({ order: z.array(objectId).min(1) });
export const NewChapterBody = z.object({ title: nonEmpty(200, "Title").optional() });
export const SharingBody = z.object({ enabled: z.boolean().optional(), reset: z.boolean().optional() });
export const RegenerateBody = z.object({
  target: z.enum(["lecture", "quiz"]),
  guidance: z.string().trim().max(300, "Guidance is too long (300 characters max)").optional(),
  contentMd: z.string().max(60_000).optional(), // for quizzes: build from the (possibly unsaved) lecture text
});

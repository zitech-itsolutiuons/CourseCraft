import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const WorkflowStepSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    detail: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const HomepageContentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "home" },
    updatedBy: { type: String, required: true },
    heroTitle: { type: String, required: true, trim: true },
    heroDescription: { type: String, required: true, trim: true },
    institution: { type: String, required: true, trim: true },
    program: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    primaryCta: { type: String, required: true, trim: true },
    secondaryCta: { type: String, required: true, trim: true },
    heroFootnote: { type: String, required: true, trim: true },
    outlineEyebrow: { type: String, required: true, trim: true },
    outlineTitle: { type: String, required: true, trim: true },
    outlineLevel: { type: String, required: true, trim: true },
    topics: { type: [String], required: true },
    outlineNote: { type: String, required: true, trim: true },
    workflowTitle: { type: String, required: true, trim: true },
    workflowSteps: { type: [WorkflowStepSchema], required: true },
  },
  { timestamps: true }
);

export type HomepageContentDoc = InferSchemaType<typeof HomepageContentSchema>;

export const HomepageContent: Model<HomepageContentDoc> =
  models.HomepageContent || model<HomepageContentDoc>("HomepageContent", HomepageContentSchema);

export const defaultHomepageContent = {
  heroTitle: "A clear path through cybersecurity.",
  heroDescription:
    "Course Craft turns your course documents into structured chapter notes, short quizzes, and a study assistant grounded in your material.",
  institution: "FUTO",
  program: "Cybersecurity",
  level: "Level 200",
  primaryCta: "Create your account",
  secondaryCta: "Sign in",
  heroFootnote: "Your notes stay at the center of every study session.",
  outlineEyebrow: "Illustrative study outline",
  outlineTitle: "Network security",
  outlineLevel: "Level 200",
  topics: [
    "Security principles and risk",
    "Network layers and common protocols",
    "Identity, authentication, and access",
    "Threat analysis and incident response",
  ],
  outlineNote: "Example topics only; use your course materials to build your outline.",
  workflowTitle: "Move from course material to confident review.",
  workflowSteps: [
    { title: "Add your material", detail: "Upload a course PDF or DOCX to get started." },
    { title: "Study by chapter", detail: "Review structured notes built from your material." },
    { title: "Check your understanding", detail: "Use short quizzes and the chapter study assistant." },
  ],
} as const;

export type HomepageContentValues = typeof defaultHomepageContent;
import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ObjectiveQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const TheoryQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    sampleAnswer: { type: String, required: true },
    gradingPoints: { type: [String], required: true },
  },
  { _id: false }
);

const ResultSchema = new Schema(
  {
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    percentage: { type: Number, required: true },
    objectiveResults: [{
      selectedIndex: { type: Number, required: true },
      correctIndex: { type: Number, required: true },
      explanation: { type: String, required: true },
      _id: false,
    }],
    theoryResults: [{
      score: { type: Number, required: true },
      maxScore: { type: Number, required: true },
      feedback: { type: String, required: true },
      _id: false,
    }],
  },
  { _id: false }
);

const OnDemandAssessmentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    courseTitle: { type: String, required: true },
    questionType: { type: String, enum: ["objective", "theory"], required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    objectiveQuestions: { type: [ObjectiveQuestionSchema], default: [] },
    theoryQuestions: { type: [TheoryQuestionSchema], default: [] },
    gradingStartedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    result: { type: ResultSchema, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

OnDemandAssessmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OnDemandAssessmentDoc = InferSchemaType<typeof OnDemandAssessmentSchema>;
export const OnDemandAssessment: Model<OnDemandAssessmentDoc> =
  models.OnDemandAssessment || model<OnDemandAssessmentDoc>("OnDemandAssessment", OnDemandAssessmentSchema);

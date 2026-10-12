import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CourseSummaryRequestSchema = new Schema(
  {
    userId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
  },
  { timestamps: true }
);

CourseSummaryRequestSchema.index({ userId: 1, createdAt: -1 });
CourseSummaryRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

type CourseSummaryRequestDoc = InferSchemaType<typeof CourseSummaryRequestSchema>;
export const CourseSummaryRequest: Model<CourseSummaryRequestDoc> =
  models.CourseSummaryRequest || model<CourseSummaryRequestDoc>("CourseSummaryRequest", CourseSummaryRequestSchema);

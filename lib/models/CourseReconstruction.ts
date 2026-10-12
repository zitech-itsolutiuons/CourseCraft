import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ReconstructionAccessSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, required: true, default: true },
    grantType: { type: String, enum: ["admin", "payment"], required: true },
    grantedBy: String,
    paymentReference: String,
    grantedAt: { type: Date, required: true, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const PaystackPaymentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    reference: { type: String, required: true, unique: true },
    amountKobo: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["NGN"], required: true, default: "NGN" },
    status: { type: String, enum: ["pending", "success", "failed"], required: true, default: "pending" },
    paidAt: Date,
  },
  { timestamps: true }
);

const ReconstructionUsageSchema = new Schema(
  {
    userId: { type: String, required: true },
    weekStart: { type: Date, required: true },
    used: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);
ReconstructionUsageSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

const CourseReconstructionSchema = new Schema(
  {
    userId: { type: String, required: true },
    sourceCourseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    resultCourseId: { type: Schema.Types.ObjectId, ref: "Course" },
    prompt: { type: String, required: true, maxlength: 1200 },
    weekStart: { type: Date, required: true, index: true },
    status: { type: String, enum: ["processing", "completed", "failed"], required: true, default: "processing" },
    error: String,
  },
  { timestamps: true }
);
CourseReconstructionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "processing" } }
);
CourseReconstructionSchema.index({ userId: 1, weekStart: 1, status: 1 });

export type ReconstructionAccessDoc = InferSchemaType<typeof ReconstructionAccessSchema>;
export type PaystackPaymentDoc = InferSchemaType<typeof PaystackPaymentSchema>;
export type ReconstructionUsageDoc = InferSchemaType<typeof ReconstructionUsageSchema>;
export type CourseReconstructionDoc = InferSchemaType<typeof CourseReconstructionSchema>;

export const ReconstructionAccess: Model<ReconstructionAccessDoc> =
  models.ReconstructionAccess || model<ReconstructionAccessDoc>("ReconstructionAccess", ReconstructionAccessSchema);
export const PaystackPayment: Model<PaystackPaymentDoc> =
  models.PaystackPayment || model<PaystackPaymentDoc>("PaystackPayment", PaystackPaymentSchema);
export const ReconstructionUsage: Model<ReconstructionUsageDoc> =
  models.ReconstructionUsage || model<ReconstructionUsageDoc>("ReconstructionUsage", ReconstructionUsageSchema);
export const CourseReconstruction: Model<CourseReconstructionDoc> =
  models.CourseReconstruction || model<CourseReconstructionDoc>("CourseReconstruction", CourseReconstructionSchema);

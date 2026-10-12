import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ createdAt: -1 });

export type AnnouncementDoc = InferSchemaType<typeof AnnouncementSchema>;
export const Announcement: Model<AnnouncementDoc> =
  models.Announcement || model<AnnouncementDoc>("Announcement", AnnouncementSchema);

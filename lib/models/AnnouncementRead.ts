import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const AnnouncementReadSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  readAt: { type: Date, required: true },
});

export type AnnouncementReadDoc = InferSchemaType<typeof AnnouncementReadSchema>;
export const AnnouncementRead: Model<AnnouncementReadDoc> =
  models.AnnouncementRead || model<AnnouncementReadDoc>("AnnouncementRead", AnnouncementReadSchema);

import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const PlatformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "platform" },
    requireSignupCode: { type: Boolean, required: true, default: true },
    studentQuizQuestionLimit: { type: Number, required: true, min: 1, max: 15, default: 15 },
    reconstructionPriceNgn: { type: Number, required: true, min: 0, default: 0 },
    courseSummarizationEnabled: { type: Boolean, required: true, default: false },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export type PlatformSettingsDoc = InferSchemaType<typeof PlatformSettingsSchema>;

const cachedPlatformSettings = models.PlatformSettings as Model<PlatformSettingsDoc> | undefined;
if (
  cachedPlatformSettings &&
  (!cachedPlatformSettings.schema.path("reconstructionPriceNgn") ||
    !cachedPlatformSettings.schema.path("courseSummarizationEnabled"))
) {
  delete models.PlatformSettings;
}

export const PlatformSettings: Model<PlatformSettingsDoc> =
  models.PlatformSettings || model<PlatformSettingsDoc>("PlatformSettings", PlatformSettingsSchema);
import { Types } from "mongoose";
import { CourseReconstruction, ReconstructionUsage } from "@/lib/models/CourseReconstruction";

export const WEEKLY_RECONSTRUCTION_LIMIT = 3;
const RECONSTRUCTION_TIME_ZONE = "Africa/Lagos";

export function currentReconstructionWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RECONSTRUCTION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = Number(part("year"));
  const month = Number(part("month"));
  const day = Number(part("day"));
  const localMidnightUtc = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (localMidnightUtc.getUTCDay() + 6) % 7;
  localMidnightUtc.setUTCDate(localMidnightUtc.getUTCDate() - daysSinceMonday);
  const mondayDate = `${localMidnightUtc.getUTCFullYear()}-${String(localMidnightUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(localMidnightUtc.getUTCDate()).padStart(2, "0")}`;
  return new Date(`${mondayDate}T00:00:00+01:00`);
}

export async function reconstructionUsage(userId: string, weekStart = currentReconstructionWeek()) {
  const usage = await ReconstructionUsage.findOne({ userId, weekStart }).select("used").lean();
  const used = usage?.used ?? 0;
  return { used, remaining: Math.max(0, WEEKLY_RECONSTRUCTION_LIMIT - used), weekStart };
}

export function isDuplicateProcessingReconstruction(error: unknown) {
  return error instanceof Error && "code" in error && error.code === 11000;
}

export async function reserveReconstruction(userId: string, weekStart = currentReconstructionWeek()) {
  try {
    await ReconstructionUsage.updateOne(
      { userId, weekStart },
      { $setOnInsert: { used: 0 } },
      { upsert: true }
    );
  } catch (error) {
    if (!isDuplicateProcessingReconstruction(error)) throw error;
  }
  const reserved = await ReconstructionUsage.findOneAndUpdate(
    { userId, weekStart, used: { $lt: WEEKLY_RECONSTRUCTION_LIMIT } },
    { $inc: { used: 1 } },
    { new: true }
  ).select("used").lean();
  return reserved ? { used: reserved.used, weekStart } : null;
}

export async function releaseReconstruction(userId: string, weekStart: Date) {
  await ReconstructionUsage.updateOne(
    { userId, weekStart, used: { $gt: 0 } },
    { $inc: { used: -1 } }
  );
}

export function validReconstructionId(id: string) {
  return Types.ObjectId.isValid(id);
}

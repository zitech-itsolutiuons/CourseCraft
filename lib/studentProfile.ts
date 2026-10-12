import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";

export function makeStudentId(userId: string) {
  const suffix = createHash("sha256").update(userId).digest("hex").slice(0, 16).toUpperCase();
  return `CC-${suffix}`;
}

export async function ensureStudentProfile(userId: string, displayName = "Student") {
  await connectDB();
  let profile = await UserProfile.findOne({ userId });

  if (!profile) {
    try {
      profile = await UserProfile.findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            displayName: displayName.trim() || "Student",
            studentId: makeStudentId(userId),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      profile = await UserProfile.findOne({ userId });
      if (!profile) throw error;
    }
  }

  if (!profile) throw new Error("Student profile could not be created");

  const updates: { studentId?: string; department?: string; displayName?: string } = {};
  if (!profile.studentId) updates.studentId = makeStudentId(userId);
  if (!profile.department && profile.program) updates.department = profile.program;
  if (!profile.displayName.trim()) updates.displayName = displayName.trim() || "Student";

  if (Object.keys(updates).length) {
    await UserProfile.updateOne({ _id: profile._id }, { $set: updates });
    profile = await UserProfile.findById(profile._id);
  }

  if (!profile) throw new Error("Student profile could not be loaded");
  return profile;
}

export function hasRequiredStudentDetails(profile: { department?: string | null; level?: string | null }) {
  return Boolean(profile.department?.trim() && profile.level?.trim());
}

export function studentProfilePath(callbackUrl: string) {
  return `/profile?onboarding=required&callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

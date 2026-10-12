import { AnnouncementRead } from "@/lib/models/AnnouncementRead";

export async function markAnnouncementsRead(userId: string, readAt = new Date()) {
  try {
    await AnnouncementRead.updateOne({ userId }, { $set: { readAt } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const result = await AnnouncementRead.updateOne({ userId }, { $set: { readAt } });
    if (!result.matchedCount) throw error;
  }
}

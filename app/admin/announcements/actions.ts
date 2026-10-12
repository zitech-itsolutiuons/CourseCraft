"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Announcement } from "@/lib/models/Announcement";

const AnnouncementFields = z.object({
  title: z.string().trim().min(1, "Add a title.").max(120, "Keep the title under 120 characters."),
  message: z.string().trim().min(1, "Write an announcement message.").max(2000, "Keep the message under 2,000 characters."),
});

export async function createAnnouncement(formData: FormData) {
  const adminId = await getUserId();
  if (!adminId) redirect("/signin");
  if (!(await isAdmin(adminId))) redirect("/courses");

  const parsed = AnnouncementFields.safeParse({
    title: formData.get("title"),
    message: formData.get("message"),
  });
  if (!parsed.success) redirect("/admin/announcements?notice=invalid");

  await connectDB();
  await Announcement.create({ ...parsed.data, createdBy: adminId });
  revalidatePath("/admin/announcements");
  revalidatePath("/announcements");
  revalidatePath("/", "layout");
  redirect("/admin/announcements?notice=sent");
}

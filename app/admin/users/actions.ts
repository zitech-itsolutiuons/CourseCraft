"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction } from "@/lib/models/Course";
import { ReconstructionAccess } from "@/lib/models/CourseReconstruction";
import { User } from "@/lib/models/User";

export async function updateUserRole(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!Types.ObjectId.isValid(targetId)) redirect("/admin/users?notice=missing");
  if (!["admin", "instructor", "user"].includes(role)) redirect("/admin/users?notice=invalid");

  await connectDB();
  const target = await User.findById(targetId).select("role").lean();
  if (!target) redirect("/admin/users?notice=missing");
  if (actorId === targetId && role !== "admin") redirect("/admin/users?notice=self");
  if (target.role === "admin" && role === "user" && (await User.countDocuments({ role: "admin" })) <= 1)
    redirect("/admin/users?notice=lastAdmin");

  await User.updateOne({ _id: targetId }, { $set: { role } }, { runValidators: true });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect("/admin/users?notice=updated");
}

export async function updateCourseAccess(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const targetPath = `/admin/users/${encodeURIComponent(targetId)}`;
  if (!Types.ObjectId.isValid(targetId) || !Types.ObjectId.isValid(courseId) || !["restrict", "restore"].includes(mode))
    redirect("/admin/users");

  await connectDB();
  const [target, course] = await Promise.all([User.exists({ _id: targetId }), Course.exists({ _id: courseId })]);
  if (!target || !course) redirect(`${targetPath}?notice=missing`);

  if (mode === "restrict") {
    await CourseRestriction.updateOne(
      { userId: targetId, courseId },
      { $setOnInsert: { restrictedBy: actorId } },
      { upsert: true }
    );
  } else {
    await CourseRestriction.deleteOne({ userId: targetId, courseId });
  }

  revalidatePath("/courses");
  revalidatePath(targetPath);
  redirect(`${targetPath}?notice=${mode === "restrict" ? "restricted" : "restored"}`);
}

export async function setReconstructionAccess(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  if (!Types.ObjectId.isValid(targetId) || !["grant", "revoke"].includes(mode))
    redirect("/admin/users?notice=missing");
  await connectDB();
  if (!(await User.exists({ _id: targetId }))) redirect("/admin/users?notice=missing");

  if (mode === "grant") {
    await ReconstructionAccess.findOneAndUpdate(
      { userId: targetId },
      {
        $set: {
          active: true,
          grantType: "admin",
          grantedBy: actorId,
          grantedAt: new Date(),
          revokedAt: null,
        },
        $unset: { paymentReference: 1 },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  } else {
    await ReconstructionAccess.updateOne(
      { userId: targetId },
      { $set: { active: false, revokedAt: new Date() } }
    );
  }

  revalidatePath("/admin/users");
  revalidatePath("/reconstruct");
  redirect(`/admin/users?notice=reconstruction-${mode === "grant" ? "granted" : "revoked"}`);
}
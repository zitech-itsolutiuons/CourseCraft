"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { deleteCourse } from "@/lib/courseOps";
import { Course } from "@/lib/models/Course";

export type CourseActionState = { error?: string; success?: string };

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
}

function readCourseId(formData: FormData) {
  const courseId = formData.get("courseId");
  return typeof courseId === "string" && isValidObjectId(courseId) ? courseId : null;
}

function refreshCourseSurfaces() {
  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  revalidatePath("/admin/groups");
  revalidatePath("/admin/users");
  revalidatePath("/courses");
  revalidatePath("/");
  revalidatePath("/join/[code]", "page");
}

export async function archiveCourseAction(_previous: CourseActionState, formData: FormData): Promise<CourseActionState> {
  await requireAdmin();
  const courseId = readCourseId(formData);
  if (!courseId) return { error: "This course could not be identified." };

  await connectDB();
  const result = await Course.updateOne(
    { _id: courseId, archivedAt: null },
    { $set: { archivedAt: new Date() } }
  );
  if (!result.matchedCount) return { error: "This course is already archived or no longer exists." };

  refreshCourseSurfaces();
  return { success: "Course moved to the archive. Students can no longer access it." };
}

export async function restoreCourseAction(_previous: CourseActionState, formData: FormData): Promise<CourseActionState> {
  await requireAdmin();
  const courseId = readCourseId(formData);
  if (!courseId) return { error: "This course could not be identified." };

  await connectDB();
  const result = await Course.updateOne(
    { _id: courseId, archivedAt: { $ne: null } },
    { $unset: { archivedAt: 1 } }
  );
  if (!result.matchedCount) return { error: "This course is already active or no longer exists." };

  refreshCourseSurfaces();
  return { success: "Course restored to active courses." };
}

export async function permanentlyDeleteCourseAction(_previous: CourseActionState, formData: FormData): Promise<CourseActionState> {
  await requireAdmin();
  const courseId = readCourseId(formData);
  if (!courseId) return { error: "This course could not be identified." };

  await connectDB();
  const course = await Course.findById(courseId).select("status").lean();
  if (!course) return { error: "This course no longer exists." };
  if (course.status === "processing") {
    return { error: "This course is still being generated. Wait for generation to finish before deleting it." };
  }

  await deleteCourse(courseId);
  refreshCourseSurfaces();
  return { success: "Course and its associated student data were permanently deleted." };
}

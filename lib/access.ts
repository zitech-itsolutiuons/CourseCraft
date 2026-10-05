import { isValidObjectId } from "mongoose";
import { getUserId } from "./auth";
import { connectDB } from "./db";
import { json } from "./http";
import { Chapter, Course, CourseRestriction, StudentProgress } from "./models/Course";

/**
 * Roles: the course owner is the instructor. A student is anyone who joined through
 * the share link (a StudentProgress record exists). Everyone else gets "not found".
 */
export async function getCourseAccess(courseId: string, userId: string, options: { allowCatalogPreview?: boolean } = {}) {
  if (!isValidObjectId(courseId)) return null;
  await connectDB();
  const course = await Course.findById(courseId).lean();
  if (!course || course.archivedAt) return null;
  if (await CourseRestriction.exists({ userId, courseId: course._id })) return null;
  if (course.ownerId === userId) return { course, role: "owner" as const };
  if (course.catalogVisible && course.status === "ready") return { course, role: "student" as const };
  if (await StudentProgress.exists({ userId, courseId })) return { course, role: "student" as const };
  if (options.allowCatalogPreview && course.catalogVisible) return { course, role: "catalog" as const };
  return null;
}

/** For API routes that only the instructor may call. Returns the context, or a Response to send back. */
export async function authorizeOwner(courseId: string) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const access = await getCourseAccess(courseId, userId);
  if (!access) return json({ error: "Not found" }, 404);
  if (access.role !== "owner") return json({ error: "Only the course owner can do this" }, 403);
  return { userId, course: access.course };
}

export async function authorizeChapterOwner(chapterId: string) {
  if (!isValidObjectId(chapterId)) return json({ error: "Not found" }, 404);
  await connectDB();
  const chapter = await Chapter.findById(chapterId).select("courseId title index contentMd").lean();
  if (!chapter) return json({ error: "Not found" }, 404);
  const auth = await authorizeOwner(String(chapter.courseId));
  if (auth instanceof Response) return auth;
  return { ...auth, chapter };
}

import { auth } from "@/auth";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";

export type UserRole = "user" | "instructor" | "admin";

/**
 * The signed-in user's id, or null when signed out.
 * Callers decide the response: API routes return 401, pages redirect to /signin.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  await connectDB();
  return Boolean(await User.exists({ _id: userId, role: "admin" }));
}

export async function canCreateCourses(userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  await connectDB();
  return Boolean(await User.exists({ _id: userId, role: { $in: ["admin", "instructor"] } }));
}

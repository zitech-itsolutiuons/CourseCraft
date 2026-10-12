import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canCreateCourses } from "@/lib/auth";
import UserDashboardLayout from "@/components/UserDashboardLayout";
import { ensureStudentProfile, hasRequiredStudentDetails, studentProfilePath } from "@/lib/studentProfile";

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=%2Fcourses");
  if (!(await canCreateCourses(session.user.id))) {
    const profile = await ensureStudentProfile(session.user.id, session.user.name ?? "Student");
    if (!hasRequiredStudentDetails(profile)) redirect(studentProfilePath("/courses"));
  }

  return <UserDashboardLayout>{children}</UserDashboardLayout>;
}

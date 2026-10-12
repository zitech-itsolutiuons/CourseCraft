import type { ReactNode } from "react";
import UserDashboardLayout from "@/components/UserDashboardLayout";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <UserDashboardLayout>{children}</UserDashboardLayout>;
}

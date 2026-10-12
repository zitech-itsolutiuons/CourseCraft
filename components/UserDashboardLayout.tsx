"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function UserDashboardLayout({
  children,
  headerOutside = false,
}: {
  children: ReactNode;
  headerOutside?: boolean;
}) {
  const pathname = usePathname();
  const isCourseReader = /^\/courses\/[^/]+\/learn$/.test(pathname);

  if (isCourseReader) return <>{children}</>;

  return (
    <div className={`student-dashboard-frame dashboard-frame grid min-h-screen w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-x-8 lg:gap-y-4 ${headerOutside ? "student-dashboard-frame--header-outside" : ""}`}>
      <DashboardSidebar mode="student" />
      <div className="student-dashboard-content min-w-0">{children}</div>
    </div>
  );
}

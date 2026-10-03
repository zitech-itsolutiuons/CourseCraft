"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/signup-access", label: "Signup access" },
  { href: "/admin/homepage", label: "Home page" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/groups", label: "Course groups" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="mb-8 flex gap-6 border-b border-slate-200 text-sm">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/admin" && pathname.startsWith(`${tab.href}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 py-3 ${active ? "border-blue-700 font-medium text-blue-800" : "border-transparent text-slate-600 hover:text-blue-700"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardMode = "student" | "admin";

const navigation: Record<DashboardMode, { heading: string; items: { href: string; label: string; icon: string; featured?: boolean }[] }[]> = {
  student: [
    {
      heading: "Learning",
      items: [
        { href: "/courses", label: "Your courses", icon: "book" },
        { href: "/assessments", label: "Assessments", icon: "check" },
        { href: "/announcements", label: "Announcements", icon: "announcement" },
        { href: "/reconstruct", label: "Reconstruct course", icon: "reconstruct", featured: true },
      ],
    },
    {
      heading: "Account",
      items: [{ href: "/profile", label: "Profile", icon: "user" }],
    },
  ],
  admin: [
    {
      heading: "Workspace",
      items: [{ href: "/admin", label: "Overview", icon: "grid" }],
    },
    {
      heading: "Management",
      items: [
        { href: "/admin/courses", label: "Courses", icon: "book" },
        { href: "/admin/groups", label: "Course groups", icon: "group" },
        { href: "/admin/users", label: "Users", icon: "user" },
        { href: "/admin/signup-access", label: "Signup access", icon: "key" },
      ],
    },
    {
      heading: "Platform",
      items: [
        { href: "/admin/announcements", label: "Announcements", icon: "announcement" },
        { href: "/admin/homepage", label: "Home page", icon: "home" },
        { href: "/admin/settings", label: "Settings", icon: "settings" },
      ],
    },
  ],
};

function NavIcon({ name }: { name: string }) {
  const shared = {
    "aria-hidden": true as const,
    className: name === "lock" ? "h-3.5 w-3.5 shrink-0" : "h-[18px] w-[18px] shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "book":
      return <svg {...shared}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8m-8 4h8" /></svg>;
    case "check":
      return <svg {...shared}><path d="M8 4H5v17h14V4h-3" /><path d="M9 3h6v4H9zM8.5 14l2.3 2.3 4.7-5" /></svg>;
    case "user":
      return <svg {...shared}><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
    case "grid":
      return <svg {...shared}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
    case "group":
      return <svg {...shared}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8" /></svg>;
    case "key":
      return <svg {...shared}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2" /></svg>;
    case "home":
      return <svg {...shared}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" /></svg>;
    case "announcement":
      return <svg {...shared}><path d="M4 5.5h16v11H9l-5 4z" /><path d="M8 9h8m-8 4h5" /></svg>;
    case "settings":
      return <svg {...shared}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1.9-1.4 2.4-1.3-.6a8 8 0 0 1-1.6.9l-.2 1.4h-2.8l-.2-1.4a8 8 0 0 1-1.6-.9l-1.3.6-1.4-2.4 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.4-2.4 1.3.6a8 8 0 0 1 1.6-.9l.2-1.4h2.8l.2 1.4a8 8 0 0 1 1.6.9l1.3-.6 1.4 2.4-1.1.9a7 7 0 0 1-.1 1.7Z" transform="translate(-1 -1) scale(1.08)" /></svg>;
    case "lock":
      return <svg {...shared}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></svg>;
    case "reconstruct":
      return <svg {...shared}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></svg>;
    default:
      return null;
  }
}

export default function DashboardSidebar({ mode }: { mode: DashboardMode }) {
  const pathname = usePathname();
  const groups = navigation[mode];
  const isStudent = mode === "student";

  return (
    <aside
      aria-label={mode === "admin" ? "Admin workspace" : "Learning workspace"}
      className={isStudent
        ? "relative z-10 mx-3 w-auto shrink-0 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-lg shadow-slate-900/[0.04] dark:border-slate-800 dark:bg-slate-950/90 sm:mx-5 sm:px-5 lg:sticky lg:top-24 lg:my-1 lg:ml-8 lg:mr-0 lg:w-60 lg:self-start lg:px-4 lg:py-5"
        : "relative z-10 w-full shrink-0 rounded-2xl border border-slate-200 bg-white/95 px-3 py-4 shadow-lg shadow-slate-900/[0.04] dark:border-slate-800 dark:bg-slate-950/90 sm:px-5 lg:sticky lg:top-24 lg:my-1 lg:w-60 lg:self-start lg:px-4 lg:py-5"}
    >
      <nav
        aria-label={mode === "admin" ? "Admin sections" : "Student sections"}
        className={isStudent
          ? "flex w-full flex-wrap items-center gap-1 lg:block lg:space-y-6"
          : "flex flex-wrap gap-2 lg:block lg:space-y-6"}
      >
        {groups.map((group) => (
          <div key={group.heading} className="contents lg:block">
            <p className="hidden px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:mb-2 lg:block">
              {group.heading}
            </p>
            <div className="contents lg:block">
            {group.items.map((item) => {
              const active = mode === "admin" && item.href === "/admin"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group inline-flex min-h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isStudent ? "justify-center lg:w-full lg:justify-start" : "lg:flex"
                  } ${
                    item.featured
                      ? active || !isStudent
                        ? "bg-blue-700 font-semibold text-white shadow-sm shadow-blue-950/15"
                        : "font-semibold text-blue-800 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950/50"
                      : active
                        ? "bg-blue-50 font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                        : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                  {item.featured && (
                    <span className={`ml-2 inline-flex items-center gap-1 text-xs ${active ? "text-blue-100" : "text-blue-700 dark:text-blue-300"}`}>
                      <NavIcon name="lock" />
                      <span className="sr-only">Paid access</span>
                    </span>
                  )}
                </Link>
              );
            })}
            </div>
          </div>
        ))}
      </nav>
      <div className={`hidden border-t border-slate-200 px-3 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400 ${
        isStudent ? "hidden" : "mt-6 lg:block"
      }`}>
        {mode === "admin" ? "Course Craft administration" : "Your personal study space"}
      </div>
    </aside>
  );
}

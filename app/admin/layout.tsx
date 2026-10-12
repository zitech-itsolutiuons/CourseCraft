import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import SiteHeader from "@/components/SiteHeader";
import { getUserId, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");

  return (
    <div className="admin-dashboard-frame dashboard-frame min-w-0 overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] min-w-0 px-3 pb-12 pt-6 sm:px-5 sm:pb-16 sm:pt-8 md:px-8 xl:px-10">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Course Craft / Administration</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Admin console</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">Manage accounts and keep an eye on course activity.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            Admin access
          </div>
        </div>
        <div className="mt-6 grid min-w-0 items-start gap-6 sm:mt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <AdminNav />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
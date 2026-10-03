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
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-9 md:px-10">
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
        <AdminNav />
        {children}
      </main>
    </>
  );
}
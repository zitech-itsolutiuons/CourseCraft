import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { updateUserRole } from "./actions";

export const dynamic = "force-dynamic";

const notices: Record<string, { text: string; tone: string }> = {
  updated: { text: "User role updated.", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  self: { text: "You cannot remove your own administrator access.", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  lastAdmin: { text: "At least one administrator must remain.", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { text: "That account could not be found.", tone: "border-rose-200 bg-rose-50 text-rose-800" },
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connectDB();
  const users = await User.find().sort({ createdAt: -1 }).select("name email role createdAt").lean();
  const notice = notices[(await searchParams).notice ?? ""];

  return (
    <section aria-labelledby="users-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id="users-heading" className="text-lg font-semibold text-slate-900">All users</h2>
          <p className="mt-1 text-sm text-slate-500">Accounts registered on Course Craft.</p>
        </div>
        <p className="text-sm tabular-nums text-slate-500">{users.length.toLocaleString()} total</p>
      </div>

      {notice && <p role="status" className={`mb-5 border px-4 py-3 text-sm ${notice.tone}`}>{notice.text}</p>}

      {users.length === 0 ? (
        <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No users found.</p>
      ) : (
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3">Access</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Course restrictions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={String(user._id)} className="bg-white">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={user.role === "admin" ? "text-blue-700" : "text-slate-500"}>{user.role}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateUserRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={String(user._id)} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        aria-label={`Access level for ${user.email}`}
                        className="border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="submit"
                        className="border border-blue-700 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${user._id}`} className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-900">
                      Manage courses
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
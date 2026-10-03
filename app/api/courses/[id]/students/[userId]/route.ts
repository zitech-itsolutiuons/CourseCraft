import { authorizeOwner } from "@/lib/access";
import { removeStudent } from "@/lib/courseOps";
import { json } from "@/lib/http";

/** Removes a student: they lose access and their progress is deleted. They can rejoin while the link is on. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  if (userId === auth.userId) return json({ error: "You can't remove yourself" }, 400);
  return (await removeStudent(id, userId)) ? json({ ok: true }) : json({ error: "Student not found" }, 404);
}

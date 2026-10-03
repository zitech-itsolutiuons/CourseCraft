import { authorizeOwner } from "@/lib/access";
import { deleteCourse } from "@/lib/courseOps";
import { json, parseBody } from "@/lib/http";
import { Course } from "@/lib/models/Course";
import { CoursePatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Edit course title / description (owner only). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, CoursePatch);
  if ("res" in body) return body.res;
  await Course.updateOne({ _id: id }, { $set: body.data });
  return json({ ok: true });
}

/** Deletes the course with its chapters, quizzes and every student's progress. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  await deleteCourse(id);
  return json({ ok: true });
}

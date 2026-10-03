import { authorizeChapterOwner } from "@/lib/access";
import { deleteChapter } from "@/lib/courseOps";
import { json, parseBody } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { ChapterPatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a chapter's title and/or lecture Markdown. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await authorizeChapterOwner((await params).id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, ChapterPatch);
  if ("res" in body) return body.res;
  await Chapter.updateOne({ _id: auth.chapter._id }, { $set: body.data });
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await authorizeChapterOwner((await params).id);
  if (auth instanceof Response) return auth;
  const ok = await deleteChapter(String(auth.chapter.courseId), String(auth.chapter._id));
  return ok ? json({ ok: true }) : json({ error: "A course needs at least one chapter" }, 400);
}

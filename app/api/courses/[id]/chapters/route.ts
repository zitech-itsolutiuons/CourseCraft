import { authorizeOwner } from "@/lib/access";
import { addChapter, setChapterOrder } from "@/lib/courseOps";
import { json, parseBody } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { NewChapterBody, ReorderBody } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Add a blank chapter at the end. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, NewChapterBody);
  if ("res" in body) return body.res;
  const ch = await addChapter(id, body.data.title);
  return json({ id: String(ch._id), title: ch.title, contentMd: ch.contentMd, videoUrl: ch.videoUrl ?? "", quiz: [] }, 201);
}

/** Reorder: body.order must list every chapter id exactly once. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, ReorderBody);
  if ("res" in body) return body.res;

  const existing = (await Chapter.find({ courseId: id }).select("_id").lean()).map((c) => String(c._id));
  const { order } = body.data;
  const valid = order.length === existing.length && new Set(order).size === order.length && order.every((x) => existing.includes(x));
  if (!valid) return json({ error: "Order must list every chapter exactly once" }, 400);

  await setChapterOrder(id, order);
  return json({ ok: true });
}

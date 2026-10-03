"use server";

import { auth, unstable_update } from "@/auth";

export async function refreshUserActivityAction(): Promise<boolean> {
  const session = await auth();
  if (!session?.user || session.user.role !== "user") return false;
  await unstable_update({});
  return true;
}
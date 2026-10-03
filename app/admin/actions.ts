"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { HomepageContent } from "@/lib/models/HomepageContent";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { SignupCode } from "@/lib/models/SignupCode";
import { encryptSignupCode, hashSignupCode } from "@/lib/signupCodes";
import { HomepageContentInput, NewCatalogCourse } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type SignupCodeActionState = { error?: string; success?: string };

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

export async function saveSignupCodeRequirementAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  await connectDB();
  await PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $set: { requireSignupCode: formData.get("requireSignupCode") === "on", updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  revalidatePath("/admin");
  revalidatePath("/admin/signup-access");
  revalidatePath("/signup");
  return { success: "Signup setting saved." };
}

export async function saveStudentQuizQuestionLimitAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  const limit = Number(formData.get("studentQuizQuestionLimit"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) {
    return { error: "Choose a number from 1 to 15." };
  }

  await connectDB();
  await PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $set: { studentQuizQuestionLimit: limit, updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  revalidatePath("/admin/settings");
  revalidatePath("/courses/[id]", "page");
  return { success: "Student quiz limit saved." };
}

export async function generateSignupCodeAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  const quantity = Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25)
    return { error: "Choose between 1 and 25 codes." };

  await connectDB();
  const codes = Array.from({ length: quantity }, () => randomBytes(12).toString("hex").toUpperCase().match(/.{6}/g)!.join("-"));
  await SignupCode.insertMany(codes.map((code) => ({
    codeHash: hashSignupCode(code),
    encryptedCode: encryptSignupCode(code),
    createdBy: userId,
  })));
  revalidatePath("/admin");
  revalidatePath("/admin/signup-access");
  return { success: `${quantity} ${quantity === 1 ? "code" : "codes"} generated.` };
}

export async function revokeSignupCodeAction(formData: FormData) {
  await requireAdmin();
  const codeId = String(formData.get("codeId") ?? "");
  if (!/^[a-f\d]{24}$/i.test(codeId)) return;
  await connectDB();
  await SignupCode.updateOne({ _id: codeId }, { $set: { active: false } });
  revalidatePath("/admin");
  revalidatePath("/admin/signup-access");
}

export async function createComingSoonCourse(formData: FormData) {
  const ownerId = await getUserId();
  if (!ownerId) redirect("/signin");
  if (!(await isAdmin(ownerId))) redirect("/courses");

  const parsed = NewCatalogCourse.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) redirect("/admin");

  await connectDB();
  const course = await Course.create({
    ownerId,
    title: parsed.data.title,
    description: parsed.data.description,
    status: "comingSoon",
    stage: "comingSoon",
    catalogVisible: true,
  });
  redirect(`/admin/courses/${course.id}`);
}

export async function saveHomepageContent(formData: FormData) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");

  const parsed = HomepageContentInput.safeParse({
    heroTitle: formData.get("heroTitle"),
    heroDescription: formData.get("heroDescription"),
    institution: formData.get("institution"),
    program: formData.get("program"),
    level: formData.get("level"),
    primaryCta: formData.get("primaryCta"),
    secondaryCta: formData.get("secondaryCta"),
    heroFootnote: formData.get("heroFootnote"),
    outlineEyebrow: formData.get("outlineEyebrow"),
    outlineTitle: formData.get("outlineTitle"),
    outlineLevel: formData.get("outlineLevel"),
    topics: formData.getAll("topics"),
    outlineNote: formData.get("outlineNote"),
    workflowTitle: formData.get("workflowTitle"),
    workflowSteps: [0, 1, 2].map((index) => ({
      title: formData.get(`stepTitle${index}`),
      detail: formData.get(`stepDetail${index}`),
    })),
  });
  if (!parsed.success) redirect("/admin/homepage?notice=invalid");

  await connectDB();
  await HomepageContent.findOneAndUpdate(
    { key: "home" },
    { $set: { ...parsed.data, updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  revalidatePath("/");
  revalidatePath("/admin/homepage");
  redirect("/admin/homepage?notice=saved");
}
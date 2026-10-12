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

export type SignupCodeActionState = { error?: string; success?: string; savedPriceNgn?: number };

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

export async function saveCourseSummarizationAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  await connectDB();
  await PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $set: { courseSummarizationEnabled: formData.get("courseSummarizationEnabled") === "on", updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  revalidatePath("/admin/settings");
  revalidatePath("/courses/[id]", "page");
  return { success: "Course summarization setting saved." };
}

export async function saveReconstructionPriceAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  const rawPrice = formData.get("reconstructionPriceNgn");
  if (typeof rawPrice !== "string" || rawPrice.trim() === "") {
    return { error: "Enter a whole-number NGN price. Use 0 to disable checkout." };
  }
  const price = Number(rawPrice);
  if (!Number.isSafeInteger(price) || price < 0 || price > Math.floor(Number.MAX_SAFE_INTEGER / 100)) {
    return { error: "Enter a whole-number NGN price of zero or more." };
  }

  try {
    await connectDB();
    const result = await PlatformSettings.collection.updateOne(
      { key: "platform" },
      {
        $set: { reconstructionPriceNgn: price, updatedBy: userId },
        $setOnInsert: { requireSignupCode: true, studentQuizQuestionLimit: 15 },
      },
      { upsert: true }
    );
    if (result.matchedCount === 0 && result.upsertedCount === 0 && result.modifiedCount === 0) {
      throw new Error("MongoDB did not acknowledge the platform price update.");
    }
    const savedSettings = await PlatformSettings.collection.findOne(
      { key: "platform" },
      { projection: { reconstructionPriceNgn: 1 } }
    );
    if (savedSettings?.reconstructionPriceNgn !== price) {
      throw new Error("MongoDB did not return the submitted reconstruction price after the update.");
    }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("Unknown save failure");
    const code = "code" in failure && typeof failure.code === "number" ? failure.code : undefined;
    console.error("[saveReconstructionPriceAction] MongoDB write failed", {
      name: failure.name,
      code,
      message: failure.message,
    });
    return { error: "MongoDB could not save the price. Check the database connection and server log, then try again." };
  }

  try {
    revalidatePath("/admin/settings");
    revalidatePath("/reconstruct");
    return { success: "Reconstruction access price saved.", savedPriceNgn: price };
  } catch (error) {
    console.error("[saveReconstructionPriceAction] Price saved but cache revalidation failed", error);
    return { success: "Reconstruction access price saved.", savedPriceNgn: price };
  }
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
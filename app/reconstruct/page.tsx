import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ReconstructionWorkspace from "@/components/ReconstructionWorkspace";
import UserDashboardLayout from "@/components/UserDashboardLayout";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction, StudentProgress } from "@/lib/models/Course";
import { CourseReconstruction, ReconstructionAccess } from "@/lib/models/CourseReconstruction";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { reconstructionUsage } from "@/lib/reconstruction";
import { hasPaystackConfiguration } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export default async function ReconstructPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  await connectDB();

  const [restrictions, progress, access, settings, usage, activeJob] = await Promise.all([
    CourseRestriction.find({ userId }).select("courseId").lean(),
    StudentProgress.find({ userId }).select("courseId").lean(),
    ReconstructionAccess.findOne({ userId, active: true }).select("grantType").lean(),
    PlatformSettings.findOne({ key: "platform" }).select("reconstructionPriceNgn").lean(),
    reconstructionUsage(userId),
    CourseReconstruction.findOne({ userId, status: "processing" }).sort({ createdAt: -1 }).select("_id").lean(),
  ]);
  const excludedIds = restrictions.map((item) => item.courseId);
  const joinedIds = progress.map((item) => item.courseId);
  const courses = await Course.find({
    $or: [{ ownerId: userId }, { catalogVisible: true }, { _id: { $in: joinedIds } }],
    status: "ready",
    archivedAt: null,
    _id: { $nin: excludedIds },
  }).sort({ title: 1 }).select("title description chapterCount").lean();
  const paymentNotice = (await searchParams).payment;

  return (
    <>
      <SiteHeader />
      <UserDashboardLayout headerOutside>
        <ReconstructionWorkspace
          courses={courses.map((course) => ({
            id: String(course._id),
            title: course.title,
            description: course.description ?? "",
            chapterCount: course.chapterCount,
          }))}
          entitled={Boolean(access)}
          grantType={access?.grantType ?? null}
          priceNgn={settings?.reconstructionPriceNgn ?? 0}
          paymentConfigured={hasPaystackConfiguration()}
          usage={usage}
          activeJobId={activeJob ? String(activeJob._id) : null}
          paymentNotice={paymentNotice}
        />
      </UserDashboardLayout>
    </>
  );
}

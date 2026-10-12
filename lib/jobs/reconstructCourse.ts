import { connectDB } from "@/lib/db";
import {
  Chapter,
  Course,
  CourseFinalAssessment,
  CourseMedia,
  Quiz,
} from "@/lib/models/Course";
import { CourseReconstruction } from "@/lib/models/CourseReconstruction";
import { linkSourceImages, writeFinalAssessment, writeLecture, writeQuiz } from "@/mastra/generation";

export async function reconstructCourse(jobId: string) {
  await connectDB();
  const job = await CourseReconstruction.findOne({ _id: jobId, status: "processing" }).lean();
  if (!job) return;

  let newCourseId: string | undefined;
  try {
    const sourceCourse = await Course.findOne({
      _id: job.sourceCourseId,
      status: "ready",
      archivedAt: null,
    }).lean();
    if (!sourceCourse) throw new Error("The source course is no longer available.");

    const sourceChapters = await Chapter.find({ courseId: sourceCourse._id })
      .select("+sourceText")
      .sort({ index: 1 })
      .lean();
    if (sourceChapters.length === 0) throw new Error("The source course has no chapters to reconstruct.");

    const course = await Course.create({
      ownerId: job.userId,
      title: sourceCourse.title,
      description: sourceCourse.description,
      sourceFileName: `Reconstructed from ${sourceCourse.title}`,
      status: "processing",
      chapterCount: 0,
      totalChapters: sourceChapters.length,
      stage: "reconstructing",
      catalogVisible: false,
      sharingEnabled: false,
    });
    newCourseId = String(course._id);
    await CourseReconstruction.updateOne({ _id: job._id, status: "processing" }, { $set: { resultCourseId: course._id } });

    const sourceMedia = await CourseMedia.find({ courseId: sourceCourse._id }).sort({ index: 1 }).lean();
    if (sourceMedia.length) {
      await CourseMedia.insertMany(sourceMedia.map((media) => ({
        courseId: course._id,
        index: media.index,
        contentType: media.contentType,
        data: Buffer.from(media.data.value()),
      })));
    }

    const reconstructedChapters: { title: string; contentMd: string }[] = [];
    for (const [index, sourceChapter] of sourceChapters.entries()) {
      const originalContent = sourceChapter.sourceText?.trim() || sourceChapter.contentMd;
      const generated = await writeLecture({
        courseTitle: sourceCourse.title,
        outline: sourceChapters.map((chapter) => chapter.title),
        index,
        title: sourceChapter.title,
        sourceText: originalContent,
        guidance: `Learner preference: ${job.prompt}. Adapt presentation, examples, and depth only. Keep the original subject, learning goals, and factual scope.`,
      });
      const contentMd = linkSourceImages(generated, originalContent, newCourseId);
      const chapter = await Chapter.create({
        courseId: course._id,
        index: sourceChapter.index,
        title: sourceChapter.title,
        summary: sourceChapter.summary,
        contentMd,
        sourceText: originalContent,
        videoUrl: sourceChapter.videoUrl,
      });
      const questions = await writeQuiz({
        title: sourceChapter.title,
        contentMd,
        guidance: `Learner preference: ${job.prompt}. Keep questions aligned to this chapter's original subject and learning goals.`,
      });
      await Quiz.create({ courseId: course._id, chapterId: chapter._id, questions });
      reconstructedChapters.push({ title: sourceChapter.title, contentMd });
      await Course.updateOne(
        { _id: course._id },
        { $set: { lecturesDone: index + 1, quizzesDone: index + 1, stage: "reconstructing" } }
      );
    }

    const assessment = await writeFinalAssessment({
      courseTitle: sourceCourse.title,
      chapters: reconstructedChapters,
      guidance: job.prompt,
    });
    await CourseFinalAssessment.create({ courseId: course._id, ...assessment });
    await Course.updateOne(
      { _id: course._id },
      {
        $set: {
          status: "ready",
          stage: "complete",
          chapterCount: sourceChapters.length,
          totalChapters: sourceChapters.length,
        },
        $unset: { error: 1 },
      }
    );
    await CourseReconstruction.updateOne({ _id: job._id, status: "processing" }, { $set: { status: "completed" } });
  } catch (error) {
    console.error(`[reconstructCourse] Job ${jobId} failed`, error);
    if (newCourseId) {
      await Course.updateOne(
        { _id: newCourseId },
        { $set: { status: "failed", stage: "failed", error: "Course reconstruction failed. You can try again." } }
      );
    }
    await CourseReconstruction.updateOne(
      { _id: job._id, status: "processing" },
      { $set: { status: "failed", error: "Course reconstruction failed. Please try again." } }
    );
  }
}

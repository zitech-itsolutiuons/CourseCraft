export type ChapterVideoSource = { kind: "embed" | "file"; src: string };
export const CHAPTER_VIDEO_MARKER = "{{chapter-video}}";

export type ChapterContentBlock =
  | { kind: "markdown"; key: string; content: string }
  | { kind: "video"; key: string };

export function resolveChapterVideo(value: string): ChapterVideoSource | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/)?.[1];
    return id ? { kind: "embed", src: `https://player.vimeo.com/video/${id}` } : null;
  }

  return /\.(?:mp4|webm|ogg|ogv)$/i.test(url.pathname)
    ? { kind: "file", src: url.toString() }
    : null;
}

export function splitChapterVideo(contentMd: string, videoUrl?: string): ChapterContentBlock[] {
  const hasVideo = Boolean(videoUrl && resolveChapterVideo(videoUrl));
  if (!contentMd.includes(CHAPTER_VIDEO_MARKER)) {
    return [
      ...(hasVideo ? [{ kind: "video" as const, key: "video" }] : []),
      ...(contentMd ? [{ kind: "markdown" as const, key: "content", content: contentMd }] : []),
    ];
  }

  return contentMd.split(CHAPTER_VIDEO_MARKER).flatMap((content, index, parts) => [
    ...(content ? [{ kind: "markdown" as const, key: `content-${index}`, content }] : []),
    ...(hasVideo && index < parts.length - 1 ? [{ kind: "video" as const, key: `video-${index}` }] : []),
  ]);
}